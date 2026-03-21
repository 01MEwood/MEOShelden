// ============================================
// MEOS:HELDEN — Backend Server v2.0
// Raw SQL via pg (no Prisma)
// Port: 3800 (single-container mode)
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { checkConnection, checkTables } = require('./db');

const app = express();
const PORT = process.env.PORT || 3800;

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3200',
  'https://helden.meosapp.de',
  'http://localhost:3800',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(null, true); // permissive for now
  },
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));

// Auth middleware
const auth = require('./middleware/auth');

// Health (no auth)
app.get('/health', async (req, res) => {
  const db = await checkConnection();
  res.json({
    status: db.ok ? 'ok' : 'db_error',
    app: 'meos-helden',
    version: '2.0.0',
    db: db,
    timestamp: new Date().toISOString(),
  });
});

// DB table check (no auth — useful for debugging)
app.get('/health/db', async (req, res) => {
  const tables = await checkTables();
  res.json({ tables });
});

// Routes
app.use('/api/pipeline', auth, require('./routes/pipeline'));
app.use('/api/knowledge', auth, require('./routes/knowledge'));
app.use('/api/cities', auth, require('./routes/cities'));
app.use('/api/clusters', auth, require('./routes/clusters'));
app.use('/api/board', auth, require('./routes/board'));
app.use('/api/export', auth, require('./routes/exportRoutes'));
app.use('/api/social', auth, require('./routes/socialRoutes'));
app.use('/api/health-checks', auth, require('./routes/healthChecks'));
app.use('/api/auth', require('./routes/authRoutes'));

// Serve Frontend (built React app in ./public)
const path = require('path');
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path === '/health') return next();
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n🛡️  MEOS:HELDEN v2.0 (Raw SQL) running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  const db = await checkConnection();
  console.log(`   DB: ${db.ok ? '✅ Connected to ' + db.db : '❌ ' + db.error}`);
  if (db.ok) {
    const tables = await checkTables();
    const missing = Object.entries(tables).filter(([, v]) => !v.exists).map(([k]) => k);
    if (missing.length > 0) {
      console.log(`   ⚠️  Missing tables: ${missing.join(', ')}`);
      console.log(`   → Run: node src/init-db-runner.js`);
    } else {
      const counts = Object.entries(tables).map(([k, v]) => `${k}:${v.count}`).join(', ');
      console.log(`   Tables: ${counts}`);
    }
  }
  console.log('');
});

// Graceful shutdown
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;
