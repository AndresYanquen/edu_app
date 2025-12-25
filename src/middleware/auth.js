const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.replace('Bearer', '').trim();
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be defined in the environment');
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || !payload.id || !payload.role) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    req.user = { id: payload.id, role: payload.role };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
