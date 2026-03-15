const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'meos-helden-2026';

module.exports = (req, res, next) => {
  // Allow health check without auth
  if (req.path === '/health') return next();
  
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  
  if (!token) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token ungültig.' });
  }
};
