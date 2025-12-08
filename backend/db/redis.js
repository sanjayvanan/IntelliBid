const { createClient } = require('redis');

const client = createClient({
  url: process.env.REDIS_URL
});

client.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
  if (!client.isOpen) {
    await client.connect();
    console.log('✅ Connected to Redis successfully');
  }
})();

module.exports = client;