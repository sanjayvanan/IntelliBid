const cron = require('node-cron');
const db = require('../db/postgres');

console.log('Auction closing job scheduler initialized.');

//Cron details
// Schedule a task to run every minute
// Cron pattern: second minute hour day-of-month month day-of-week
// '* * * * *' means "every minute"
cron.schedule('* * * * *', async () => {
  console.log('Running auction closing job at:', new Date().toISOString());
  try {
    // Find items that are active and whose end_time has passed
    const { rows: expiredItems } = await db.query(
      "SELECT id FROM items WHERE status = 'active' AND end_time <= NOW()"
    );

    if (expiredItems.length === 0) {
      console.log('No expired auctions found.');
      return;
    }

    console.log(`Found ${expiredItems.length} expired auctions to process.`);

    // Loop through each expired item and update its status
    for (const item of expiredItems) {
      // --- Basic Update (Just set to 'ended') ---
      // You'll expand this later to find the winner, check reserve, etc.
      await db.query(
        "UPDATE items SET status = 'ended' WHERE id = $1 AND status = 'active'", // Add check for status='active' again as a safeguard
        [item.id]
      );
      console.log(`Updated status for item ID: ${item.id} to 'ended'`);

      // --- TODO (Future Logic - Phase 3): ---
      // 1. Find the highest bid for this item.id from the 'bids' table.
      // 2. Get the item's reserve_price (if any).
      // 3. If highest bid >= reserve_price (or no reserve):
      //    - Update status to 'sold'.
      //    - Update winning_bidder_id with the highest bidder's ID.
      // 4. Else (no bids or reserve not met):
      //    - Update status to 'ended' or 'reserve_not_met'.
      // ------------------------------------------
    }
  } catch (err) {
    console.error('Error running auction closing job:', err);
  }
});

module.exports = cron; 