const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function getPool() {
  return pool;
}

module.exports = {
  pool,
  query,
  getPool
};
