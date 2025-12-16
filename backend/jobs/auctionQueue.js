require("dotenv").config();

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
  // 🕒 PRODUCTION: Check in 24 hours
  const delay = 24 * 60 * 60 * 1000; 
  
  // 🧪 TESTING: Check in 1 minute (Uncomment below to test deadbeats)
  // const delay = 60 * 1000; 

  await auctionQueue.add(
    'expire-payment',
    { itemId },
    {
      delay: delay,
      jobId: `pay-check-${itemId}`,
      removeOnComplete: true
    }
  );
  console.log(`[BullMQ] Scheduled payment check for Item ${itemId}`);
};

// 3. The Worker (Handles Expiry & Deadbeats)
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
      
        let item;

        // 1. Try to Close Auction (Atomic Update)
        const { rows } = await client.query(
          `UPDATE items 
           SET status = 'ended' 
           WHERE id = $1 AND status = 'active' AND end_time <= NOW() 
           RETURNING *`,
          [itemId]
        );
    
        if (rows.length > 0) {
            // Success: We just ended it
            item = rows[0];
        } else {
            // Failure: Check if it was ALREADY ended (Idempotency / Retry)
            const { rows: existing } = await client.query(`SELECT * FROM items WHERE id = $1`, [itemId]);
            
            if (existing.length === 0) {
                console.log(`[BullMQ] Item ${itemId} invalid/not found.`);
                return;
            }

            const foundItem = existing[0];
            if (foundItem.status === 'ended') {
                console.log(`[BullMQ] Item ${itemId} was already ended. Resuming email/winner check...`);
                item = foundItem;
            } else {
                // THROW ERROR INSTEAD OF RETURNING
                // This forces BullMQ to retry the job in a few seconds when the DB clock catches up.
                console.log(`[BullMQ] Item ${itemId} is active but Postgres clock is behind. Retrying...`);
                throw new Error("Clock skew mismatch - triggering retry");
            }
        }
    
        // 2. Find Winner
        const bidQuery = `SELECT * FROM bids WHERE item_id = $1 ORDER BY amount DESC LIMIT 1`;
        const { rows: bids } = await client.query(bidQuery, [itemId]);
    
        if (bids.length > 0) {
          const winningBid = bids[0];
          const winner = await User.findById(winningBid.bidder_id);
    
          if (winner) {
            // 3. Mark Pending (Idempotent Update)
            await client.query(
              `UPDATE items SET winner_id = $1, payment_status = 'pending' WHERE id = $2`,
              [winner._id.toString(), itemId]
            );
            
            console.log(`[BullMQ] Winner found: ${winner.email}`);

            // 4. Send Email
            const paymentLink = `${process.env.FRONTEND_PORT || 'http://localhost:5173'}/profile`;
            
            try {
                await sendWinnerEmail(winner.email, item.name, winningBid.amount, paymentLink);
                console.log(`[BullMQ] ✅ Email sent successfully.`);
            } catch (emailErr) {
                console.error(`[BullMQ] ❌ FAILED to send email:`, emailErr.message);
                throw emailErr; // Throw so BullMQ retries ONLY the email part
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
             
             const deadbeatId = item.winner_id; 

             // 1. DELETE ALL BIDS FROM THE DEADBEAT
             if (deadbeatId) {
                 await client.query(
                    `DELETE FROM bids WHERE item_id = $1 AND bidder_id = $2`,
                    [itemId, deadbeatId]
                 );
                 console.log(`[BullMQ] 🗑️ Wiped ALL bids from deadbeat user: ${deadbeatId}`);
             }

             // 2. FIND THE NEW HIGHEST BIDDER
             const { rows: newBids } = await client.query(
                `SELECT * FROM bids WHERE item_id = $1 ORDER BY amount DESC LIMIT 1`,
                [itemId]
             );

             if (newBids.length > 0) {
                 const newWinnerBid = newBids[0];
                 const newWinner = await User.findById(newWinnerBid.bidder_id);

                 if (newWinner) {
                     console.log(`[BullMQ] Offering Second Chance to ${newWinner.email}`);

                     await client.query(
                        `UPDATE items 
                         SET winner_id = $1, 
                             current_price = $2, 
                             payment_status = 'pending'
                         WHERE id = $3`,
                        [newWinner._id.toString(), newWinnerBid.amount, itemId]
                     );

                     const paymentLink = `${process.env.FRONTEND_PORT || 'http://localhost:5173'}/profile`;
                     try {
                        await sendWinnerEmail(newWinner.email, item.name, newWinnerBid.amount, paymentLink);
                        console.log(`[BullMQ] ✅ Second chance email sent.`);
                     } catch (e) { console.error(e); }

                     await schedulePaymentExpiry(itemId);
                 }
             } 
             else {
                 console.log(`[BullMQ] No valid bids remaining. Relisting Item ${itemId}`);
                 
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
                 
                 const { rows: updated } = await client.query(`SELECT end_time FROM items WHERE id=$1`, [itemId]);
                 await scheduleAuctionEnd(itemId, updated[0].end_time);
             }
        }
      }

    } catch (err) {
      console.error(`[BullMQ] Error processing job ${job.name}:`, err);
      throw err; 
    } finally {
      client.release();
    }
  }, { connection });

// 4. Safety Sync: Schedule jobs for ALL active items on restart
const syncActiveAuctions = async () => {
  console.log('🔄 Starting background sync...');
  let lastId = 0;
  let hasMore = true;
  const BATCH_SIZE = 100;

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