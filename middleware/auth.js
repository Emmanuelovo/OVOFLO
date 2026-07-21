const jwt = require('jsonwebtoken');

/**
 * Requires a valid "Authorization: Bearer <token>" header.
 * On success, sets req.userId. On failure, responds 401 and stops the chain.
 * Every data route in this app is scoped by req.userId - this is what makes
 * Plans/Trades/Settings/etc. private to the logged-in user.
 */
module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated. Log in and try again.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
};
