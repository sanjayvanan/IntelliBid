// backend/jobs/auctionQueue.js
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const db = require('../db/postgres');
const User = require('../models/userModel');
const { sendWinnerEmail } = require('../utils/email');

// 1. Setup Redis Connection
const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// 2. Define the Queue
const auctionQueue = new Queue('auction-expiry', { connection });

// 3. Helper: Schedule a Job
const scheduleAuctionEnd = async (itemId, endTime) => {
  const delay = new Date(endTime).getTime() - Date.now();
  
  // If time has already passed, set delay to 0 to process immediately
  const finalDelay = delay > 0 ? delay : 0;

  // We use the itemId as the Job ID to prevent duplicates
  await auctionQueue.add(
    'expire-item', 
    { itemId }, 
    { 
      delay: finalDelay,
      jobId: `auction-${itemId}`, // De-duplication key
      removeOnComplete: true
    }
  );
  
  console.log(`[BullMQ] Scheduled Item ${itemId} to close in ${Math.round(finalDelay/1000/60)} mins`);
};

// 4. Define the Worker (The Processor)
const worker = new Worker('auction-expiry', async (job) => {
  const { itemId } = job.data;
  console.log(`[BullMQ] Processing expiry for Item: ${itemId}`);

  const client = await db.connect();
  try {
    // A. Double-check status (Concurrency safety)
    const { rows } = await client.query(
      `UPDATE items 
       SET status = 'ended' 
       WHERE id = $1 AND status = 'active' AND end_time <= NOW() 
       RETURNING *`,
      [itemId]
    );

    if (rows.length === 0) {
      console.log(`[BullMQ] Item ${itemId} already ended or date extended.`);
      return;
    }

    const item = rows[0];

    // B. Find Winner
    const bidQuery = `SELECT * FROM bids WHERE item_id = $1 ORDER BY amount DESC LIMIT 1`;
    const { rows: bids } = await client.query(bidQuery, [itemId]);

    if (bids.length > 0) {
      const winningBid = bids[0];
      // Fetch user from Mongo
      const winner = await User.findById(winningBid.bidder_id);

      if (winner) {
        // C. Update Payment Status
        await client.query(
          `UPDATE items SET winner_id = $1, payment_status = 'pending' WHERE id = $2`,
          [winner._id.toString(), itemId]
        );

        console.log(`[BullMQ] Winner found: ${winner.email}`);
        
        // D. Send Email
        const paymentLink = `${process.env.FRONTEND_PORT || 'http://localhost:5173'}/profile`;
        await sendWinnerEmail(winner.email, item.name, winningBid.amount, paymentLink);
      }
    } else {
      console.log(`[BullMQ] Auction ${itemId} closed with no bids.`);
    }

  } catch (err) {
    console.error(`[BullMQ] Error processing item ${itemId}:`, err);
    throw err; // Retry the job
  } finally {
    client.release();
  }
}, { connection });

// 5. Safety Sync: Schedule jobs for ALL active items on restart
// (In case Redis was flushed or server crashed)
const syncActiveAuctions = async () => {
  console.log('🔄 Syncing active auctions to Job Queue...');
  const { rows } = await db.query(
    `SELECT id, end_time FROM items WHERE status = 'active'`
  );

  for (const item of rows) {
    await scheduleAuctionEnd(item.id, item.end_time);
  }
  console.log(`✅ Synced ${rows.length} active auctions.`);
};

worker.on('failed', (job, err) => {
  console.error(`[BullMQ] Job ${job.id} failed:`, err);
});

module.exports = { scheduleAuctionEnd, syncActiveAuctions };