const { getPool } = require("../db-sql");

let _equipmentById = {};
let _lastFetch      = 0;
const TTL_MS         = 5 * 60 * 1000; // 5 minutes — mirrors slackUserService.js; equipment master data changes rarely

async function refreshIfStale() {
  if (Date.now() - _lastFetch < TTL_MS) return;
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().query(
      `SELECT equipment_id, equipment_name FROM Equipment`
    );
    const m = {};
    for (const r of recordset) m[r.equipment_id] = r.equipment_name;
    _equipmentById = m;
    _lastFetch     = Date.now();
    console.log(`[Equipment] cache refreshed: ${recordset.length} rows`);
  } catch (err) {
    console.error("[Equipment] cache refresh error:", err.message);
    // Keep stale cache rather than going empty on transient DB error
  }
}

// Kick off the initial load at module boot so the cache is warm before first request
refreshIfStale().catch(() => {});

/**
 * Resolves an equipment_id to its equipment_name from the cached Equipment table.
 * Falls back to the id itself if not found or the cache never loaded.
 */
async function resolveEquipmentName(equipmentId) {
  if (!equipmentId) return null;
  await refreshIfStale();
  return _equipmentById[equipmentId] || equipmentId;
}

module.exports = { refreshIfStale, resolveEquipmentName };
