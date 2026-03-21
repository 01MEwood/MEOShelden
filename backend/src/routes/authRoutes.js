const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query, queryOne, queryAll } = require('../db');
const auth = require('../middleware/auth');

const SECRET = process.env.JWT_SECRET || 'meos-helden-2026';

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email und Passwort erforderlich.' });

    const user = await queryOne('SELECT * FROM users WHERE email = $1', [email]);
    if (!user) return res.status(401).json({ error: 'Benutzer nicht gefunden.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Falsches Passwort.' });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      SECRET, { expiresIn: '7d' }
    );
    res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Current user
router.get('/me', auth, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Init: Create first admin (only if no users exist)
router.post('/init', async (req, res) => {
  try {
    const existing = await queryOne('SELECT COUNT(*)::int as count FROM users');
    if (existing.count > 0) return res.status(400).json({ error: 'Users exist already.' });

    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });

    const hash = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO users (id, email, password, name, role, "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, 'admin', NOW())`,
      [email, hash, name]
    );
    res.json({ success: true, message: 'Admin user created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══ USER MANAGEMENT (admin only) ═══

// List all users
router.get('/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins können Benutzer verwalten.' });
    const users = await queryAll('SELECT id, email, name, role, "createdAt" FROM users ORDER BY "createdAt" ASC');
    res.json({ success: true, users });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create user
router.post('/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins.' });
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Email, Passwort und Name sind Pflicht.' });

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) return res.status(400).json({ error: 'Email existiert bereits.' });

    const hash = await bcrypt.hash(password, 10);
    const user = await queryOne(
      `INSERT INTO users (id, email, password, name, role, "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW()) RETURNING id, email, name, role, "createdAt"`,
      [email, hash, name, role || 'team']
    );
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update user (name, role, password)
router.put('/users/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins.' });
    const { name, role, password } = req.body;

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await query('UPDATE users SET name=COALESCE($1,name), role=COALESCE($2,role), password=$3 WHERE id=$4',
        [name, role, hash, req.params.id]);
    } else {
      await query('UPDATE users SET name=COALESCE($1,name), role=COALESCE($2,role) WHERE id=$3',
        [name, role, req.params.id]);
    }

    const user = await queryOne('SELECT id, email, name, role, "createdAt" FROM users WHERE id = $1', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete user
router.delete('/users/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur Admins.' });
    if (req.user.id === req.params.id) return res.status(400).json({ error: 'Du kannst dich nicht selbst löschen.' });

    const user = await queryOne('SELECT name FROM users WHERE id = $1', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden.' });

    await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: `${user.name} gelöscht.` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
