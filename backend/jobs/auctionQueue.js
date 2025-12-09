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
  
  // Optional: Comment out log to reduce noise for 1M items
  // console.log(`[BullMQ] Scheduled Item ${itemId}`);
};

// 4. Define the Worker (The Processor)
// ... (The worker code remains exactly the same as before) ...
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
// SCALABILITY FIX: Batched processing
const syncActiveAuctions = async () => {
  console.log('🔄 Starting background sync of active auctions...');
  
  let lastId = 0;
  let hasMore = true;
  let totalSynced = 0;
  const BATCH_SIZE = 10; // Process 10 items at a time (My application scale... batch 10 items for testing)

  try {
    while (hasMore) {
        // Fetch a batch where id > lastId
        // This is keyset pagination
        const queryText = `
            SELECT id, end_time 
            FROM items 
            WHERE status = 'active' AND id > $1 
            ORDER BY id ASC 
            LIMIT $2
        `;
        const { rows } = await db.query(queryText, [lastId, BATCH_SIZE]);
        
        if (rows.length === 0) {
            hasMore = false;
            break;
        }

        // Process batch in parallel (non-blocking)
        const promises = rows.map(item => scheduleAuctionEnd(item.id, item.end_time));
        await Promise.all(promises);

        // Update cursor to the last ID seen
        lastId = rows[rows.length - 1].id;
        totalSynced += rows.length;

        // Small breathing room for the Event Loop so we don't starve other requests
        await new Promise(resolve => setTimeout(resolve, 50));
        
        console.log(`[Sync] Processed batch. Total synced: ${totalSynced}`);
    }
    console.log(`✅ Sync complete. Total active auctions: ${totalSynced}`);
  } catch (error) {
    console.error("❌ Error during auction sync:", error);
  }
};

worker.on('failed', (job, err) => {
  console.error(`[BullMQ] Job ${job.id} failed:`, err);
});

module.exports = { scheduleAuctionEnd, syncActiveAuctions };