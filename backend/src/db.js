// ============================================
// MEOS:HELDEN — Database Connection (Raw SQL via pg)
// Replaces Prisma with direct PostgreSQL pool
// ============================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DATABASE_URL?.includes('supabase')
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

// Helper: single query
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const ms = Date.now() - start;
    if (ms > 2000) console.warn(`Slow query (${ms}ms):`, text.slice(0, 80));
    return result;
  } catch (err) {
    console.error('DB Query Error:', err.message, '\nQuery:', text.slice(0, 200));
    throw err;
  }
}

// Helper: get single row or null
async function queryOne(text, params) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

// Helper: get all rows
async function queryAll(text, params) {
  const result = await query(text, params);
  return result.rows;
}

// Health check
async function checkConnection() {
  try {
    const res = await pool.query('SELECT NOW() as now, current_database() as db');
    return { ok: true, time: res.rows[0].now, db: res.rows[0].db };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Check if required tables exist
async function checkTables() {
  const tables = ['knowledge_chunks', 'city_profiles', 'generations', 'chunk_usage', 'cluster_map', 'publication_checks', 'users'];
  const results = {};
  for (const t of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) as count FROM "${t}"`);
      results[t] = { exists: true, count: parseInt(res.rows[0].count) };
    } catch (err) {
      results[t] = { exists: false, error: err.message };
    }
  }
  return results;
}

module.exports = { pool, query, queryOne, queryAll, checkConnection, checkTables };
