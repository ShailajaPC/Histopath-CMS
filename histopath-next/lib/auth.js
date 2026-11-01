const jwt = require('jsonwebtoken');
const { runAs } = require('./db');

function getUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token || !process.env.JWT_SECRET) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); } catch (_) { return null; }
}

// Wrap an API handler: 401 if not logged in, 403 if the role is not allowed,
// otherwise run it with every query executing under the user's PostgreSQL role.
function withAuth(handler, roles) {
  return async function (req, res) {
    if (!process.env.JWT_SECRET)
      return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET missing in .env.local' });
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    if (roles && !roles.includes(user.role))
      return res.status(403).json({ error: `Role ${user.role} is not allowed to do this` });
    req.user = user;
    return runAs(user.role, () => handler(req, res));
  };
}

module.exports = { getUser, withAuth };
