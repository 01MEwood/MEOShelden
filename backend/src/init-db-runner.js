// ============================================
// MEOS:HELDEN — DB Init Runner
// Runs init-db.sql against the configured database
// Usage: node src/init-db-runner.js
// ============================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, checkConnection } = require('./db');

async function run() {
  console.log('🗄️  MEOS:HELDEN DB Init\n');

  // Check connection
  const conn = await checkConnection();
  if (!conn.ok) {
    console.error('❌ Cannot connect to database:', conn.error);
    process.exit(1);
  }
  console.log(`✅ Connected to: ${conn.db}`);

  // Read SQL file
  const sqlPath = path.join(__dirname, '..', 'init-db.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ init-db.sql not found at:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log(`📄 SQL file loaded (${sql.length} chars)\n`);

  try {
    await pool.query(sql);
    console.log('✅ All tables and functions created/verified\n');

    // Show table status
    const tables = ['users', 'knowledge_chunks', 'city_profiles', 'generations', 'chunk_usage', 'cluster_map', 'publication_checks'];
    for (const t of tables) {
      try {
        const res = await pool.query(`SELECT COUNT(*) as count FROM "${t}"`);
        console.log(`  ${t}: ${res.rows[0].count} rows`);
      } catch (e) {
        console.log(`  ${t}: ❌ ${e.message}`);
      }
    }

    // Check embeddings
    try {
      const emb = await pool.query(`SELECT COUNT(*) as total, COUNT(embedding) as embedded FROM knowledge_chunks WHERE "isActive" = true`);
      const { total, embedded } = emb.rows[0];
      console.log(`\n  🧠 Embeddings: ${embedded}/${total} chunks embedded`);
      if (parseInt(total) > parseInt(embedded)) {
        console.log(`  ⚠️  ${parseInt(total) - parseInt(embedded)} chunks need embedding — use POST /api/knowledge/embed-all`);
      }
    } catch (e) { /* vector extension might not be ready */ }

    console.log('\n✅ DB Init complete');
  } catch (err) {
    console.error('❌ SQL execution failed:', err.message);
    console.error(err.detail || '');
  }

  await pool.end();
  process.exit(0);
}

run();
