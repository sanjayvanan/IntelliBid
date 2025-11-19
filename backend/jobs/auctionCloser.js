const cron = require('node-cron');
const db = require('../db/postgres');
const User = require('../models/userModel'); 
const { sendWinnerEmail } = require('../utils/email');

console.log('Auction closing job scheduler initialized.');

cron.schedule('* * * * *', async () => {
  console.log('Running auction closing job...');
  const client = await db.connect();

  try {
    // 1. Find expired active items
    const { rows: expiredItems } = await client.query(
      `UPDATE items 
       SET status = 'ended' 
       WHERE status = 'active' AND end_time <= NOW() 
       RETURNING *`
    );

    if (expiredItems.length === 0) return;

    console.log(`Processing ${expiredItems.length} ended items...`);

    for (const item of expiredItems) {
      try {
        // 2. Find highest bid
        const bidQuery = `SELECT * FROM bids WHERE item_id = $1 ORDER BY amount DESC LIMIT 1`;
        const { rows: bids } = await client.query(bidQuery, [item.id]);

        if (bids.length === 0) {
          console.log(`Item ${item.id} ended with no bids.`);
          // Optionally mark as unsold or handled elsewhere
          continue; 
        }

        const winningBid = bids[0];
        const winner = await User.findById(winningBid.bidder_id);

        if (winner) {
          // 3. UPDATE ITEM WITH WINNER & PAYMENT STATUS
          await client.query(
            `UPDATE items SET winner_id = $1, payment_status = 'pending' WHERE id = $2`,
            [winner._id.toString(), item.id]
          );

          console.log(`Winner found for "${item.name}": ${winner.email}`);
          
          // 4. Send Email with Profile Link
          const paymentLink = `${process.env.FRONTEND_PORT || 'http://localhost:5173'}/profile`;
          await sendWinnerEmail(winner.email, item.name, winningBid.amount, paymentLink);
        }

      } catch (innerErr) {
        console.error(`Error processing item ${item.id}:`, innerErr);
      }
    }

  } catch (err) {
    console.error('Error running auction job:', err);
  } finally {
    client.release();
  }
});

module.exports = cron;