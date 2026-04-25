/**
 * Database Configuration Module
 * 
 * Establishes and manages the PostgreSQL connection pool using the 'pg' library.
 * Connects to a Neon PostgreSQL database using the DATABASE_URL from environment variables.
 * Implements SSL for secure connections as required by Neon.
 * 
 * @module config/db
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Log successful connection
pool.on('connect', () => {
  console.log('[DB] Connected to Neon PostgreSQL database');
});

// Log connection errors
pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err);
  process.exit(-1);
});

/**
 * Execute a SQL query against the database.
 * @param {string} text - The SQL query string.
 * @param {Array} params - The query parameters.
 * @returns {Promise<Object>} The query result.
 */
const query = async (text, params) => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DB] Query executed in ${duration}ms | Rows: ${result.rowCount}`);
  }
  
  return result;
};

module.exports = { pool, query };
