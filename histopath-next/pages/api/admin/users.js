const { pool } = require('../../../lib/db');
const { withAuth } = require('../../../lib/auth');
const bcrypt = require('bcryptjs');

const ROLES = ['PATHOLOGIST', 'TECHNICIAN', 'ADMIN'];

// ADMIN only. Every query runs under the PostgreSQL role histo_admin (see lib/db.js),
// which can read user columns EXCEPT password_hash and can INSERT / UPDATE Users.
//   GET   -> all users + organisation tree (WITH RECURSIVE)
//   POST  -> create a user with any role
//   PATCH -> change role / active flag / manager / reset password
async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const users = await pool.query(`
        SELECT u.user_id, u.full_name, u.email, u.role, u.is_active, u.created_at,
               u.reports_to, m.full_name AS reports_to_name,
               (SELECT COUNT(*) FROM Reports r WHERE r.pathologist_id = u.user_id) AS report_count
        FROM Users u LEFT JOIN Users m ON u.reports_to = m.user_id
        ORDER BY u.role, u.full_name`);
      const tree = await pool.query(`
        WITH RECURSIVE org AS (
          SELECT user_id, full_name, role, reports_to, 0 AS depth, full_name::TEXT AS path
          FROM Users WHERE reports_to IS NULL
          UNION ALL
          SELECT u.user_id, u.full_name, u.role, u.reports_to, o.depth + 1, o.path || ' > ' || u.full_name
          FROM Users u JOIN org o ON u.reports_to = o.user_id
        )
        SELECT user_id, full_name, role, depth, path FROM org ORDER BY path`);
      return res.status(200).json({ users: users.rows, tree: tree.rows });
    }

    if (req.method === 'POST') {
      const { name, email, password, role, reports_to } = req.body || {};
      if (!name || !email || !password || !ROLES.includes(role))
        return res.status(400).json({ error: 'name, email, password and a valid role are required' });
      if (String(password).length < 6)
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      const clean = String(email).trim().toLowerCase();
      const dup = await pool.query('SELECT 1 FROM Users WHERE email=$1', [clean]);
      if (dup.rows.length) return res.status(400).json({ error: 'Email already registered' });
      await pool.query(
        'INSERT INTO Users (full_name, email, password_hash, role, reports_to) VALUES ($1,$2,$3,$4,$5)',
        [name, clean, await bcrypt.hash(String(password), 10), role, reports_to || null]);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'PATCH') {
      const { id, role, is_active, reports_to, password } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const sets = [], vals = [id];
      const add = (col, v) => { vals.push(v); sets.push(`${col}=$${vals.length}`); };
      if (role !== undefined) {
        if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
        add('role', role);
      }
      if (is_active !== undefined) add('is_active', !!is_active);
      if (reports_to !== undefined) add('reports_to', reports_to || null);
      if (password) {
        if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
        add('password_hash', await bcrypt.hash(String(password), 10));
      }
      if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
      const r = await pool.query(`UPDATE Users SET ${sets.join(', ')} WHERE user_id=$1`, vals);
      if (!r.rowCount) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).end();
  } catch (e) {
    // P0001 = RAISE EXCEPTION from a trigger (e.g. "last administrator"), 42501 = permission denied
    res.status(e.code === 'P0001' ? 409 : e.code === '42501' ? 403 : 500).json({ error: e.message });
  }
}

export default withAuth(handler, ['ADMIN']);
