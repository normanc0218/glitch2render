const { getPool, sql } = require("../db-sql");

let _maintenanceStaff = {};
let _Supervisors      = {};
let _managerUsers     = {};
let _trainUsers       = {};
let _offlineTechs     = []; // active Technicians with no Slack account
let _lastFetch        = 0;
const TTL_MS          = 15 * 60 * 1000; // 15 minutes

async function refreshIfStale() {
  if (Date.now() - _lastFetch < TTL_MS) return;
  try {
    const pool = await getPool();
    const [slackRes, techRes] = await Promise.all([
      pool.request().query(`SELECT slack_id, name, role FROM SlackUsers WHERE active = 1`),
      pool.request().query(`SELECT name FROM Technicians WHERE active = 1 ORDER BY name`),
    ]);
    const m = {}, s = {}, mg = {}, t = {};
    for (const r of slackRes.recordset) {
      const roles = (r.role || '').split(',').map(x => x.trim());
      if (roles.includes("maintenance")) m[r.name]  = r.slack_id;
      if (roles.includes("supervisor"))  s[r.name]  = r.slack_id;
      if (roles.includes("manager"))     mg[r.name] = r.slack_id;
      if (roles.includes("trainer"))     t[r.name]  = r.slack_id;
    }
    _maintenanceStaff = m;
    _Supervisors      = s;
    _managerUsers     = mg;
    _trainUsers       = t;
    const slackNames  = new Set(Object.keys(m));
    _offlineTechs     = techRes.recordset.map(r => r.name).filter(n => !slackNames.has(n));
    _lastFetch        = Date.now();
    console.log(`[SlackUsers] cache refreshed: ${slackRes.recordset.length} Slack users, ${_offlineTechs.length} offline techs`);
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
  get offlineTechs()     { return _offlineTechs; },
};
