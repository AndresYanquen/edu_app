const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in the environment');
}

const connectionString = process.env.DATABASE_URL;
const dbUrl = new URL(connectionString);
console.log(
  `Connecting to PostgreSQL ${dbUrl.hostname}:${dbUrl.port}${dbUrl.pathname}`,
);
const pool = new Pool({
  connectionString,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error', err);
  process.exit(1);
});

module.exports = pool;
