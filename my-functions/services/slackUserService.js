const { getPool, sql } = require("../db-sql");

let _maintenanceStaff = {};
let _Supervisors      = {};
let _managerUsers     = {};
let _trainUsers       = {};
let _lastFetch        = 0;
const TTL_MS          = 5 * 60 * 1000; // 5 minutes

async function refreshIfStale() {
  if (Date.now() - _lastFetch < TTL_MS) return;
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().query(
      `SELECT slack_id, name, role FROM SlackUsers WHERE active = 1`
    );
    const m = {}, s = {}, mg = {}, t = {};
    for (const r of recordset) {
      if (r.role === "maintenance") m[r.name]  = r.slack_id;
      else if (r.role === "supervisor") s[r.name]  = r.slack_id;
      else if (r.role === "manager")    mg[r.name] = r.slack_id;
      else if (r.role === "trainer")    t[r.name]  = r.slack_id;
    }
    _maintenanceStaff = m;
    _Supervisors      = s;
    _managerUsers     = mg;
    _trainUsers       = t;
    _lastFetch        = Date.now();
    console.log(`[SlackUsers] cache refreshed: ${recordset.length} users`);
  } catch (err) {
    console.error("[SlackUsers] cache refresh error:", err.message);
    // Keep stale cache rather than going empty on transient DB error
  }
}

// Kick off the initial load at module boot so the cache is warm before first request
refreshIfStale().catch(() => {});

module.exports = {
  refreshIfStale,
  get maintenanceStaff() { return _maintenanceStaff; },
  get Supervisors()      { return _Supervisors; },
  get managerUsers()     { return _managerUsers; },
  get trainUsers()       { return _trainUsers; },
};
