const { pool } = require('../../lib/db');
const { getUser } = require('../../lib/auth');
const bcrypt = require('bcryptjs');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'All fields are required' });
  if (!['PATHOLOGIST', 'TECHNICIAN', 'ADMIN'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });
  if (String(password).length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  // Anyone may register as pathologist / technician; only a logged-in admin can create admins
  if (role === 'ADMIN') {
    const caller = getUser(req);
    if (!caller || caller.role !== 'ADMIN')
      return res.status(403).json({ error: 'Only an administrator can create admin accounts' });
  }

  try {
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await pool.query('SELECT 1 FROM Users WHERE email=$1', [cleanEmail]);
    if (existing.rows.length > 0)
      return res.status(400).json({ error: 'Email already registered. Please use a different email.' });
    await pool.query(
      'INSERT INTO Users (full_name, email, password_hash, role) VALUES ($1,$2,$3,$4)',
      [name, cleanEmail, await bcrypt.hash(String(password), 10), role]
    );
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
