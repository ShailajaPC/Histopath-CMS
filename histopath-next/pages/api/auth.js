const { pool } = require('../../lib/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// POST /api/auth  { email, password }  ->  { token, name, role }
// Passwords are stored as bcrypt hashes. (A legacy plain-text password is accepted once and
// immediately upgraded to bcrypt, so databases created by the old version still log in.)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (!process.env.JWT_SECRET)
    return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET missing in .env.local' });
  try {
    const result = await pool.query(
      'SELECT user_id, full_name, role, password_hash, is_active FROM Users WHERE LOWER(email)=$1',
      [String(email).trim().toLowerCase()]
    );
    const user = result.rows[0];
    let ok = false;
    if (user) {
      const stored = String(user.password_hash || '');
      if (/^\$2[aby]\$/.test(stored)) {
        ok = await bcrypt.compare(String(password), stored);
      } else if (stored && stored === String(password)) {
        ok = true;   // legacy plain-text row -> upgrade it
        await pool.query('UPDATE Users SET password_hash=$1 WHERE user_id=$2',
          [await bcrypt.hash(String(password), 10), user.user_id]);
      }
    }
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    if (user.is_active === false)
      return res.status(403).json({ error: 'This account has been deactivated. Contact an administrator.' });

    const token = jwt.sign(
      { user_id: user.user_id, name: user.full_name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.status(200).json({ token, name: user.full_name, role: user.role });
  } catch (e) {
    res.status(500).json({ error: 'Database error: ' + e.message });
  }
}
