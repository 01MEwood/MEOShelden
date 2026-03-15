// ============================================
// MEOS:HELDEN — Backend Server
// Port: 4200 (internal) → 8200 (external via Nginx)
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 4200;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3200', credentials: true }));
app.use(express.json({ limit: '5mb' }));

// Simple auth middleware (shared credentials with MEOS:SEO)
const auth = require('./middleware/auth');

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'meos-helden', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/pipeline', auth, require('./routes/pipeline'));       // 6-stage pipeline
app.use('/api/knowledge', auth, require('./routes/knowledge'));     // RAG knowledge base CRUD
app.use('/api/cities', auth, require('./routes/cities'));           // City profiles
app.use('/api/clusters', auth, require('./routes/clusters'));       // Cluster architecture
app.use('/api/board', auth, require('./routes/board'));             // Board review
app.use('/api/export', auth, require('./routes/exportRoutes'));     // WordPress/GenerateBlocks export
app.use('/api/health-checks', auth, require('./routes/healthChecks')); // Post-publication monitoring
app.use('/api/auth', require('./routes/authRoutes'));               // Login

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🛡️  MEOS:HELDEN Backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

module.exports = app;
