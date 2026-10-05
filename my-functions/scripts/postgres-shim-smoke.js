'use strict';
// Smoke test for db-sql-postgres.js: exercises the actual query shapes used
// throughout this codebase (correlated TOP 1 subqueries, top-level TOP n,
// GETDATE(), DATEADD(day,...), active=1, LIKE) through the real
// .request().input().query() compatibility API, against a real Postgres
// database. Not wired into vitest (that suite intentionally stubs the DB and
// never touches a real DB) -- this is the equivalent check for the Postgres
// path specifically.
//
// Usage:
//   PG_CONNECTION_STRING=postgres://postgres@localhost:5432/rizopia_test node scripts/postgres-shim-smoke.js

const { getPool, sql } = require('../db-sql-postgres');
const { randomUUID } = require('crypto');

let pass = 0, fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); }
}

async function main() {
  const pool = await getPool();

  const techId = randomUUID();
  const eqUuid = 'eq-' + randomUUID();
  const projId = randomUUID();
  const taskId = randomUUID();

  await pool.request()
    .input('id', sql.UniqueIdentifier, techId)
    .input('name', sql.NVarChar, 'Shim Test Tech')
    .query('INSERT INTO Technicians (id, name, active) VALUES (@id, @name, true)'); // seeding data, not exercising the active=1 translation (that's tested below via SELECT)

  await pool.request()
    .input('uuid', sql.NVarChar, eqUuid)
    .input('eqid', sql.NVarChar, 'SHIM-01')
    .input('name', sql.NVarChar, 'Shim Machine')
    .input('area', sql.NVarChar, 'Area X')
    .query('INSERT INTO Equipment (uuid, equipment_id, equipment_name, area) VALUES (@uuid, @eqid, @name, @area)');

  await pool.request()
    .input('id', sql.UniqueIdentifier, projId)
    .input('title', sql.NVarChar, 'Shim Test Project')
    .input('status', sql.NVarChar, 'Pending')
    .query("INSERT INTO Projects (id, title, status, record_type) VALUES (@id, @title, @status, 'project')");

  await pool.request()
    .input('pid', sql.UniqueIdentifier, projId)
    .input('eqid', sql.NVarChar, 'SHIM-01')
    .query('INSERT INTO ProjectEquipment (project_id, equipment_id, is_contractor) VALUES (@pid, @eqid, false)');

  await pool.request()
    .input('id', sql.UniqueIdentifier, taskId)
    .input('title', sql.NVarChar, 'Shim Test Task')
    .input('start', sql.DateTime2, '2026-01-05T09:00:00')
    .query("INSERT INTO Tasks (id, title, scheduled_start, status) VALUES (@id, @title, @start, 'pending')");

  // ── active = 1 -> active = true ──────────────────────────────────────────
  let r = await pool.request().query('SELECT name FROM Technicians WHERE active = 1');
  check('active = 1 translated correctly (finds the seeded active technician)',
    r.recordset.some(row => row.name === 'Shim Test Tech'), r.recordset);

  // ── correlated (SELECT TOP 1 ... WHERE ...) subquery -> LIMIT 1 ─────────
  r = await pool.request()
    .input('pid', sql.UniqueIdentifier, projId)
    .query(`
      SELECT p.id, p.title,
             (SELECT TOP 1 pe.equipment_id FROM ProjectEquipment pe WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_id,
             (SELECT TOP 1 e.equipment_name FROM ProjectEquipment pe JOIN Equipment e ON e.equipment_id = pe.equipment_id WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_name
      FROM Projects p WHERE p.id = @pid
    `);
  check('correlated TOP 1 subquery translated to LIMIT 1', r.recordset[0]?.equipment_id === 'SHIM-01' && r.recordset[0]?.equipment_name === 'Shim Machine', r.recordset);

  // ── top-level SELECT TOP n ────────────────────────────────────────────────
  r = await pool.request().query('SELECT TOP 50 id, title FROM Projects ORDER BY title');
  check('top-level SELECT TOP n translated to trailing LIMIT n', r.recordset.some(row => row.id === projId), r.recordset.length);

  // ── LIKE -> ILIKE (case-insensitive) ─────────────────────────────────────
  r = await pool.request()
    .input('q', sql.NVarChar, '%shim%') // lowercase search term against 'SHIM-01'
    .query('SELECT equipment_id FROM Equipment WHERE equipment_id LIKE @q');
  check('LIKE translated to ILIKE (case-insensitive match)', r.recordset.some(row => row.equipment_id === 'SHIM-01'), r.recordset);

  // ── GETDATE() -> CURRENT_TIMESTAMP ───────────────────────────────────────
  r = await pool.request()
    .input('id', sql.UniqueIdentifier, taskId)
    .input('status', sql.NVarChar, 'temporarily fixed')
    .query('UPDATE Tasks SET status = @status, updated_at = GETDATE() WHERE id = @id AND id = @id'); // @id reused twice deliberately -- tests $n reuse
  check('GETDATE() translated to CURRENT_TIMESTAMP (update succeeded)', r.rowsAffected[0] === 1, r);

  // ── DATEADD(day, 3, CAST(GETDATE() AS DATE)) -> (CAST(...) + 3) ─────────
  r = await pool.request()
    .input('start', sql.DateTime2, '2026-01-05T09:00:00')
    .query('SELECT id FROM Tasks WHERE scheduled_start >= CAST(GETDATE() AS DATE) - 400 AND scheduled_start <= DATEADD(day, 3650, CAST(GETDATE() AS DATE))');
  check('DATEADD(day, N, CAST(...)) translated and query executes without error', Array.isArray(r.recordset));

  // ── @name reused twice in one query maps to the same $n, not two params ──
  r = await pool.request()
    .input('name', sql.NVarChar, 'Shim Test Tech')
    .query('SELECT name FROM Technicians WHERE name = @name OR name = @name');
  check('repeated @name placeholder reuses the same positional param', r.recordset.length === 1, r.recordset);

  await pool.request().query(`DELETE FROM Tasks WHERE id = '${taskId}'`);
  await pool.request().query(`DELETE FROM ProjectEquipment WHERE project_id = '${projId}'`);
  await pool.request().query(`DELETE FROM Projects WHERE id = '${projId}'`);
  await pool.request().query(`DELETE FROM Equipment WHERE uuid = '${eqUuid}'`);
  await pool.request().query(`DELETE FROM Technicians WHERE id = '${techId}'`);

  console.log(`\n${pass} passed, ${fail} failed`);
  await pool.close();
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error('SMOKE TEST CRASHED:', e); process.exit(1); });
