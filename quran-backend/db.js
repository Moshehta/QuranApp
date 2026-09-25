const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.enisfunofnxxgajppnjl:P%40ssw0rd01155058408@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString,
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
