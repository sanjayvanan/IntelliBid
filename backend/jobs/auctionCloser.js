const cron = require('node-cron');
const db = require('../db/postgres');
const User = require('../models/userModel'); 
const { sendWinnerEmail } = require('../utils/email');

console.log('Auction closing job scheduler initialized.');

// Run every minute
cron.schedule('* * * * *', async () => {
  console.log('Running auction closing job at:', new Date().toISOString());
  
  const client = await db.connect();

  try {
    // 1. DATABASE UPDATE: Find active items that expired and set them to 'ended'.
    // We use 'RETURNING *' to get the full item details back so we know the Name and ID.
    const { rows: expiredItems } = await client.query(
      `UPDATE items 
       SET status = 'ended' 
       WHERE status = 'active' AND end_time <= NOW() 
       RETURNING *`
    );

    if (expiredItems.length === 0) {
      // Common case: nothing happened this minute.
      return;
    }

    console.log(`Updated ${expiredItems.length} items to 'ended'. Processing winners...`);

    // 2. PROCESSING: Loop through every item that just ended
    for (const item of expiredItems) {
      try {
        // A. Find the highest bid for this specific item
        const bidQuery = `
          SELECT * FROM bids 
          WHERE item_id = $1 
          ORDER BY amount DESC 
          LIMIT 1
        `;
        const { rows: bids } = await client.query(bidQuery, [item.id]);

        // If no one bid, we can't email a winner.
        if (bids.length === 0) {
          console.log(`Item "${item.name}" (ID: ${item.id}) ended with 0 bids.`);
          continue; 
        }

        const winningBid = bids[0];
        
        // B. Find the User who made that bid
        const winner = await User.findById(winningBid.bidder_id);

        if (winner) {
          console.log(`Winner found for "${item.name}": ${winner.email}`);
          
          // C. ACTION: Send the email
          await sendWinnerEmail(winner.email, item.name, winningBid.amount);
        } else {
          console.error(`Critical: Highest bidder ID ${winningBid.bidder_id} not found in MongoDB.`);
        }

      } catch (innerErr) {
        console.error(`Error processing winner for item ${item.id}:`, innerErr);
      }
    }

  } catch (err) {
    console.error('Error running auction closing job:', err);
  } finally {
    client.release(); // Always release the DB connection back to the pool // it will take too much process cause of the other project
  }
});

module.exports = cron;