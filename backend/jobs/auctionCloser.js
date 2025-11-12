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
    // It finds all active items where end_time has passed
    // It updates their status to 'ended'
    // It returns the 'id' of all items it successfully updated
    const { rows: updatedItems } = await db.query(
      "UPDATE items SET status = 'ended' WHERE status = 'active' AND end_time <= NOW() RETURNING id"
    );

    if (updatedItems.length === 0) {
      console.log('No expired auctions found.');
    } else {
      console.log(`Updated ${updatedItems.length} items to 'ended'.`);
    }

    // --- TODO (Future Logic - Phase 3): ---
    // You would now loop through the 'updatedItems' array
    // to find winners, check reserves, etc.

    
  } catch (err) {
    console.error('Error running auction closing job:', err);
  }
});

module.exports = cron; 