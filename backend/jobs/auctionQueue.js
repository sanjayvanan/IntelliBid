require("dotenv").config();

const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const db = require('../db/postgres');
const User = require('../models/userModel');
const { sendWinnerEmail } = require('../utils/email');

// 2. Setup Redis Connection
const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// 3. Define the Queue
const auctionQueue = new Queue('auction-expiry', { connection });

// --- HELPER 1: Schedule Auction End ---
const scheduleAuctionEnd = async (itemId, endTime) => {
  const delay = new Date(endTime).getTime() - Date.now();
  const finalDelay = delay > 0 ? delay : 0;

  await auctionQueue.add(
    'expire-item', 
    { itemId }, 
    { 
      delay: finalDelay,
      jobId: `auction-${itemId}`,
      removeOnComplete: true
    }
  );
};

// --- HELPER 2: Schedule Payment Expiry ---
const schedulePaymentExpiry = async (itemId) => {
  // Check in 24 hours
  const delay = 24 * 60 * 60 * 1000; 
  // const delay = 60 * 1000; // Testing: 1 minute

  await auctionQueue.add(
    'expire-payment',
    { itemId },
    {
      delay: delay,
      jobId: `pay-check-${itemId}`,
      removeOnComplete: true
    }
  );
  console.log(`[BullMQ] Scheduled 24h payment check for Item ${itemId}`);
};

// 4. The Worker (Handles Expiry & Deadbeats)
const worker = new Worker('auction-expiry', async (job) => {
    const { itemId } = job.data;
    
    // PREVENT POOL EXHAUSTION: Get a client and ensure it's released
    const client = await db.connect();

    try {
      // ====================================================
      // CASE A: STANDARD AUCTION END
      // ====================================================
      if (job.name === 'expire-item') {
        console.log(`[BullMQ] Processing expiry for Item: ${itemId}`);
      
        // 1. Close Auction
        const { rows } = await client.query(
          `UPDATE items 
           SET status = 'ended' 
           WHERE id = $1 AND status = 'active' AND end_time <= NOW() 
           RETURNING *`,
          [itemId]
        );
    
        if (rows.length === 0) {
            console.log(`[BullMQ] Item ${itemId} already ended or invalid.`);
            return;
        }
        const item = rows[0];
    
        // 2. Find Winner
        const bidQuery = `SELECT * FROM bids WHERE item_id = $1 ORDER BY amount DESC LIMIT 1`;
        const { rows: bids } = await client.query(bidQuery, [itemId]);
    
        if (bids.length > 0) {
          const winningBid = bids[0];
          const winner = await User.findById(winningBid.bidder_id);
    
          if (winner) {
            // 3. Mark Pending
            await client.query(
              `UPDATE items SET winner_id = $1, payment_status = 'pending' WHERE id = $2`,
              [winner._id.toString(), itemId]
            );
            
            // 4. Send Email
            console.log(`[BullMQ] 📧 Sending 'You Won' email to: ${winner.email}`);
            const paymentLink = `${process.env.FRONTEND_PORT || 'http://localhost:5173'}/profile`;
            
            try {
                await sendWinnerEmail(winner.email, item.name, winningBid.amount, paymentLink);
                console.log(`[BullMQ] ✅ Email sent.`);
            } catch (emailErr) {
                console.error(`[BullMQ] ❌ FAILED to send email:`, emailErr.message);
            }
            
            // 5. Start Payment Timer
            await schedulePaymentExpiry(itemId);
          }
        } else {
            console.log(`[BullMQ] Auction ${itemId} closed with no bids.`);
        }
      } 
      
      // ====================================================
      // CASE B: DEADBEAT BIDDER CHECK
      // ====================================================
      else if (job.name === 'expire-payment') {
        console.log(`[BullMQ] Checking payment status for Item: ${itemId}`);

        const { rows } = await client.query(`SELECT * FROM items WHERE id = $1`, [itemId]);
        if (rows.length === 0) return;
        const item = rows[0];

        if (item.payment_status === 'paid') {
            console.log(`[BullMQ] Item ${itemId} is paid. Closing job.`);
            return;
        }

        if (item.payment_status === 'pending') {
             console.log(`[BullMQ] Item ${itemId} UNPAID. Triggering recovery...`);
             
             const deadbeatId = item.winner_id; // The user who failed to pay

             // 1. DELETE ALL BIDS FROM THE DEADBEAT
             // This solves the issue if the deadbeat placed 5 bids. We remove them ALL.
             if (deadbeatId) {
                 await client.query(
                    `DELETE FROM bids WHERE item_id = $1 AND bidder_id = $2`,
                    [itemId, deadbeatId]
                 );
                 console.log(`[BullMQ] 🗑️ Wiped ALL bids from deadbeat user: ${deadbeatId}`);
             }

             // 2. FIND THE NEW HIGHEST BIDDER (The real runner-up)
             const { rows: newBids } = await client.query(
                `SELECT * FROM bids WHERE item_id = $1 ORDER BY amount DESC LIMIT 1`,
                [itemId]
             );

             // --- OPTION A: SECOND CHANCE ---
             if (newBids.length > 0) {
                 const newWinnerBid = newBids[0];
                 const newWinner = await User.findById(newWinnerBid.bidder_id);

                 if (newWinner) {
                     console.log(`[BullMQ] Offering Second Chance to ${newWinner.email}`);

                     // Update Item to New Winner
                     await client.query(
                        `UPDATE items 
                         SET winner_id = $1, 
                             current_price = $2, 
                             payment_status = 'pending'
                         WHERE id = $3`,
                        [newWinner._id.toString(), newWinnerBid.amount, itemId]
                     );

                     // Email New Winner
                     console.log(`[BullMQ] 📧 Sending 'Second Chance' email.`);
                     const paymentLink = `${process.env.FRONTEND_PORT || 'http://localhost:5173'}/profile`;
                     try {
                        await sendWinnerEmail(newWinner.email, item.name, newWinnerBid.amount, paymentLink);
                        console.log(`[BullMQ] ✅ Second chance email sent.`);
                     } catch (e) { console.error(e); }

                     // Restart Timer for New Winner
                     await schedulePaymentExpiry(itemId);
                 }
             } 
             // --- OPTION B: AUTO-RELIST ---
             else {
                 console.log(`[BullMQ] No valid bids remaining. Relisting Item ${itemId}`);
                 
                 // Reset Item
                 await client.query(
                    `UPDATE items 
                     SET status = 'active', 
                         end_time = NOW() + INTERVAL '3 days',
                         winner_id = NULL,
                         payment_status = NULL,
                         current_price = start_price
                     WHERE id = $1`,
                    [itemId]
                 );
                 
                 // Schedule New Close
                 const { rows: updated } = await client.query(`SELECT end_time FROM items WHERE id=$1`, [itemId]);
                 await scheduleAuctionEnd(itemId, updated[0].end_time);
             }
        }
      }

    } catch (err) {
      console.error(`[BullMQ] Error processing job ${job.name}:`, err);
      throw err; 
    } finally {
      // CRITICAL: Always release the client back to the pool
      // This fixes the "DB closing not optimized" issue
      client.release();
    }
  }, { connection });

// 5. Safety Sync: Schedule jobs for ALL active items on restart
const syncActiveAuctions = async () => {
  console.log('🔄 Starting background sync...');
  let lastId = 0;
  let hasMore = true;
  const BATCH_SIZE = 100; // Increased for efficiency

  try {
    while (hasMore) {
        const queryText = `
            SELECT id, end_time FROM items 
            WHERE status = 'active' AND id > $1 
            ORDER BY id ASC LIMIT $2
        `;
        const { rows } = await db.query(queryText, [lastId, BATCH_SIZE]);
        
        if (rows.length === 0) break;

        const promises = rows.map(item => scheduleAuctionEnd(item.id, item.end_time));
        await Promise.all(promises);

        lastId = rows[rows.length - 1].id;
        // Non-blocking wait to protect event loop
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log(`✅ Sync complete.`);
  } catch (error) {
    console.error("❌ Error during auction sync:", error);
  }
};

worker.on('failed', (job, err) => {
  console.error(`[BullMQ] Job ${job.id} failed:`, err);
});

module.exports = { scheduleAuctionEnd, syncActiveAuctions };