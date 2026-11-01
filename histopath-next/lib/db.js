const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');

const rawPool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
  database: process.env.DB_NAME     || 'histopath_db',
});

// App role (stored in the JWT) -> PostgreSQL role created in sql/06_rbac_vector.sql
const DB_ROLES = {
  PATHOLOGIST: 'histo_pathologist',
  TECHNICIAN:  'histo_technician',
  ADMIN:       'histo_admin',
};

const store = new AsyncLocalStorage();

// Run `work(client)` in one transaction with SET LOCAL ROLE <db role>.
// PostgreSQL itself then enforces GRANT / REVOKE and the triggers.
async function withRole(appRole, work) {
  const dbRole = DB_ROLES[appRole];
  if (!dbRole) throw new Error('Unknown role: ' + appRole);
  const client = await rawPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${dbRole}`);   // dbRole comes from the fixed map above
    const out = await work(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

// Inside withAuth (see lib/auth.js) pool.query runs under the logged-in user's DB role.
// Outside it (login / register) it uses the normal connection.
const pool = {
  connect: () => rawPool.connect(),
  query: (text, params) => {
    const ctx = store.getStore();
    return ctx ? withRole(ctx.role, (c) => c.query(text, params)) : rawPool.query(text, params);
  },
};

const runAs = (role, fn) => store.run({ role }, fn);

module.exports = { pool, withRole, runAs, DB_ROLES };
