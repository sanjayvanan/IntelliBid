const { Pool } = require('pg')

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
})

// handle unexpected errors so Node doesn't crash //  supaBase disconnection wont affect now
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect()
}