const db = require("../db");
const { getPool, sql } = require("../db-sql");

// ── RTDB caches ──────────────────────────────────────────────────────────────

let _releaseCache     = null;
let _releaseFetchedAt = 0;
const RELEASE_TTL_MS  = 30 * 1000; // 30 s

async function getRelease() {
  if (_releaseCache && Date.now() - _releaseFetchedAt < RELEASE_TTL_MS) return _releaseCache;
  const snap = await db.ref("jobs/Release/Regular").once("value");
  _releaseCache     = snap.val() || {};
  _releaseFetchedAt = Date.now();
  return _releaseCache;
}

// Call after any write to jobs/Release/Regular so the next displayHome() call
// doesn't serve stale status from this cache.
function invalidateReleaseCache() {
  _releaseCache = null;
}

let _usersCache     = null;
let _usersFetchedAt = 0;
const USERS_TTL_MS  = 60 * 1000; // 60 s

async function getUsers() {
  if (_usersCache && Date.now() - _usersFetchedAt < USERS_TTL_MS) return _usersCache;
  const snap = await db.ref("users").once("value");
  _usersCache     = snap.val() || {};
  _usersFetchedAt = Date.now();
  return _usersCache;
}

// ── Azure SQL helpers ────────────────────────────────────────────────────────

async function getPromotedRtdbJobIds() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT source_rtdb_job_id FROM Projects WHERE source_rtdb_job_id IS NOT NULL`
    );
    return new Set(result.recordset.map(r => r.source_rtdb_job_id));
  } catch {
    return new Set();
  }
}

async function getProjectsPendingApproval() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT p.id, p.title, p.description, p.status,
             p.machine_location,
             p.scheduled_start, p.scheduled_end,
             p.ordered_by, p.notify_supervisor,
             p.done_by, p.updated_at,
             (SELECT TOP 1 pe.equipment_id    FROM ProjectEquipment pe WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_id,
             (SELECT TOP 1 e.area             FROM ProjectEquipment pe JOIN Equipment e ON e.equipment_id = pe.equipment_id WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_area,
             (SELECT TOP 1 e.machine_line     FROM ProjectEquipment pe JOIN Equipment e ON e.equipment_id = pe.equipment_id WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_machine_line,
             (SELECT TOP 1 pe.equipment_other FROM ProjectEquipment pe WHERE pe.project_id = p.id AND pe.equipment_other IS NOT NULL) AS equipment_other
      FROM Projects p
      WHERE p.status = 'Completed and waiting for approval'
      ORDER BY p.updated_at DESC
    `);
    return result.recordset;
  } catch (err) {
    console.error("Azure SQL projects fetch error:", err.message);
    return [];
  }
}

async function getTasksForTechnician(techNames) {
  try {
    const names = Array.isArray(techNames) ? techNames : [techNames];
    if (names.length === 0) return [];
    const pool = await getPool();
    const req  = pool.request();
    const placeholders = names.map((n, i) => {
      req.input(`t${i}`, sql.NVarChar, n);
      return `@t${i}`;
    }).join(", ");
    const result = await req.query(`
      SELECT t.id, t.title, t.scheduled_start, t.scheduled_end,
             t.status, t.priority, t.description,
             tech.name AS technician_name,
             STRING_AGG(COALESCE(e.equipment_name, te.equipment_id), ', ') AS equipment_ids
      FROM Tasks t
      LEFT JOIN Technicians tech ON t.technician_id = tech.id
      LEFT JOIN TaskEquipment te ON te.task_id = t.id
      LEFT JOIN Equipment e ON e.equipment_id = te.equipment_id
      WHERE t.status NOT IN ('completed and waiting for approval', 'checked by supervisor')
        AND tech.name IN (${placeholders})
        AND (
          t.scheduled_start IS NULL
          OR CAST(t.scheduled_start AS DATE) <= CAST(GETDATE() AS DATE)
        )
      GROUP BY t.id, t.title, t.scheduled_start, t.scheduled_end,
               t.status, t.priority, t.description, tech.name
      ORDER BY t.scheduled_start ASC
    `);
    return result.recordset;
  } catch (err) {
    console.error("Azure SQL tasks fetch error:", err.message);
    return [];
  }
}

async function getTasksPendingApproval() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT t.id, t.title, t.scheduled_start, t.status,
             t.done_by, t.notify_supervisor, t.description, t.updated_at,
             tech.name AS technician_name,
             STRING_AGG(COALESCE(e.equipment_name, te.equipment_id), ', ') AS equipment_ids
      FROM Tasks t
      LEFT JOIN Technicians tech ON t.technician_id = tech.id
      LEFT JOIN TaskEquipment te ON te.task_id = t.id
      LEFT JOIN Equipment e ON e.equipment_id = te.equipment_id
      WHERE t.status = 'completed and waiting for approval'
      GROUP BY t.id, t.title, t.scheduled_start, t.status,
               t.done_by, t.notify_supervisor, t.description, t.updated_at, tech.name
      ORDER BY t.updated_at DESC
    `);
    return result.recordset;
  } catch (err) {
    console.error("Azure SQL tasks pending approval error:", err.message);
    return [];
  }
}

async function getProjectsForTechnician(techNames) {
  try {
    const names = Array.isArray(techNames) ? techNames : [techNames];
    if (names.length === 0) return [];
    const pool = await getPool();
    const req  = pool.request();
    const placeholders = names.map((n, i) => {
      req.input(`pn${i}`, sql.NVarChar, n);
      return `@pn${i}`;
    }).join(", ");
    const result = await req.query(`
      SELECT p.id, p.title, p.description, p.status,
             p.machine_location,
             p.scheduled_start, p.scheduled_end,
             tech.name AS technician_name,
             (SELECT TOP 1 pe2.equipment_id    FROM ProjectEquipment pe2 WHERE pe2.project_id = p.id AND pe2.equipment_id IS NOT NULL) AS equipment_id,
             (SELECT TOP 1 e2.area             FROM ProjectEquipment pe2 JOIN Equipment e2 ON e2.equipment_id = pe2.equipment_id WHERE pe2.project_id = p.id AND pe2.equipment_id IS NOT NULL) AS equipment_area,
             (SELECT TOP 1 e2.machine_line     FROM ProjectEquipment pe2 JOIN Equipment e2 ON e2.equipment_id = pe2.equipment_id WHERE pe2.project_id = p.id AND pe2.equipment_id IS NOT NULL) AS equipment_machine_line,
             (SELECT TOP 1 e2.equipment_name   FROM ProjectEquipment pe2 JOIN Equipment e2 ON e2.equipment_id = pe2.equipment_id WHERE pe2.project_id = p.id AND pe2.equipment_id IS NOT NULL) AS equipment_name,
             (SELECT TOP 1 pe2.equipment_other FROM ProjectEquipment pe2 WHERE pe2.project_id = p.id AND pe2.equipment_other IS NOT NULL) AS equipment_other
      FROM Projects p
      JOIN Technicians tech ON p.technician_id = tech.id
      WHERE tech.name IN (${placeholders})
        AND p.status NOT IN ('Completed and waiting for approval','Checked by Supervisor','Cancelled','Completed')
      ORDER BY p.scheduled_start ASC
    `);
    return result.recordset;
  } catch (err) {
    console.error("Azure SQL projects for technician error:", err.message);
    return [];
  }
}

async function getUpcomingTasks() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT t.id, t.title, t.scheduled_start, t.status,
             tech.name AS technician_name,
             STRING_AGG(COALESCE(e.equipment_name, te.equipment_id), ', ') AS equipment_ids
      FROM Tasks t
      LEFT JOIN Technicians tech ON t.technician_id = tech.id
      LEFT JOIN TaskEquipment te ON te.task_id = t.id
      LEFT JOIN Equipment e ON e.equipment_id = te.equipment_id
      WHERE t.scheduled_start >= CAST(GETDATE() AS DATE)
        AND t.scheduled_start <= DATEADD(day, 3, CAST(GETDATE() AS DATE))
        AND t.status NOT IN ('completed and waiting for approval', 'checked by supervisor')
      GROUP BY t.id, t.title, t.scheduled_start, t.status, tech.name
      ORDER BY t.scheduled_start ASC
    `);
    return result.recordset;
  } catch (err) {
    console.error("Azure SQL upcoming tasks fetch error:", err.message);
    return [];
  }
}

async function getSlackUserRow(userId) {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input("slackId", sql.NVarChar, userId)
      .query("SELECT TOP 1 name, role FROM SlackUsers WHERE slack_id = @slackId AND active = 1");
    return r.recordset[0] || null;
  } catch { return null; }
}

module.exports = {
  getRelease, invalidateReleaseCache, getUsers,
  getPromotedRtdbJobIds, getProjectsPendingApproval,
  getTasksForTechnician, getTasksPendingApproval,
  getProjectsForTechnician, getUpcomingTasks, getSlackUserRow,
};
