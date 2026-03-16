const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { queryOne } = require('../db');

const SECRET = process.env.JWT_SECRET || 'meos-helden-2026';

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

router.get('/me', require('../middleware/auth'), (req, res) => {
  res.json({ success: true, user: req.user });
});

// Create initial admin user (only if no users exist)
router.post('/init', async (req, res) => {
  try {
    const existing = await queryOne('SELECT COUNT(*)::int as count FROM users');
    if (existing.count > 0) return res.status(400).json({ error: 'Users exist already.' });

    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password, name required' });

    const hash = await bcrypt.hash(password, 10);
    await require('../db').query(
      `INSERT INTO users (id, email, password, name, role) VALUES (uuid_generate_v4()::text, $1, $2, $3, 'admin')`,
      [email, hash, name]
    );
    res.json({ success: true, message: 'Admin user created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
