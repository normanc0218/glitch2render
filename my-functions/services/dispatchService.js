// services/dispatchService.js
// Cached read model for the Slack "View Dispatch" modal.
//
// Dispatch jobs live in RTDB (`jobs/Dispatch`) for their whole life — nothing
// deletes them just because they were reviewed. The web app's Job Review
// Panel records what happened to each one in Azure SQL's JobReviews table
// (firestore_job_id → RTDB job id), and if it was promoted, JobReviews.
// promoted_project_id points at the resulting Projects row. This module joins
// the two so the Slack list shows every dispatch's *current* status —
// not-yet-reviewed / deferred / dismissed / promoted (+ the linked project's
// own completion status) — instead of hiding anything.
const db = require("../db");
const { getPool } = require("../db-sql");

const DISPATCH_TTL_MS = 60 * 60 * 1000; // 1 hour
const RECENT_MONTHS    = 3;
const PAGE_SIZE         = 20;

let _cache        = null; // { recent, older, fetchedAt }
let _buildPromise  = null; // dedupe concurrent cold-cache builds

const fmtDate = (d) => {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

function recentCutoff() {
  const d = new Date();
  d.setMonth(d.getMonth() - RECENT_MONTHS);
  return d;
}

// One row per (firestore_job_id, review) — a job can be reviewed more than
// once over its life (e.g. deferred, then later dismissed). Left-joins the
// promoted project so a promoted job's current completion status comes back
// in the same query.
async function fetchDispatchReviews() {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT jr.firestore_job_id, jr.decision, jr.reason, jr.deferred_until,
             jr.promoted_project_id, jr.created_at,
             p.title AS project_title, p.status AS project_status
      FROM JobReviews jr
      LEFT JOIN Projects p ON p.id = jr.promoted_project_id
      WHERE jr.job_type = 'Dispatch'
      ORDER BY jr.created_at DESC
    `);
    return r.recordset;
  } catch (err) {
    console.error("fetchDispatchReviews error:", err.message);
    return [];
  }
}

async function buildDispatchCache() {
  const [snap, reviewRows] = await Promise.all([
    db.ref("jobs/Dispatch").once("value"),
    fetchDispatchReviews(),
  ]);
  const dispatchJobs = snap.val() || {};

  // Rows are ORDER BY created_at DESC — the first one seen per job is its
  // latest/current status.
  const latestReview = new Map();
  for (const row of reviewRows) {
    if (!latestReview.has(row.firestore_job_id)) latestReview.set(row.firestore_job_id, row);
  }

  const cutoff = recentCutoff();
  const all = Object.entries(dispatchJobs)
    .map(([jobId, job]) => ({ id: jobId, ...job, review: latestReview.get(jobId) || null }))
    .sort((a, b) => new Date(b.dispatchDatetime || 0) - new Date(a.dispatchDatetime || 0));

  const recent = all.filter((j) => new Date(j.dispatchDatetime || 0) >= cutoff);
  const older  = all.filter((j) => new Date(j.dispatchDatetime || 0) <  cutoff);

  _cache = { recent, older, fetchedAt: Date.now() };
  return _cache;
}

// Fetch-on-open: only hits RTDB/SQL when the cache is empty/stale (>1h old).
// Concurrent callers during a cold cache share one in-flight build.
async function getDispatchCache() {
  if (_cache && Date.now() - _cache.fetchedAt < DISPATCH_TTL_MS) return _cache;
  if (!_buildPromise) {
    _buildPromise = buildDispatchCache().finally(() => { _buildPromise = null; });
  }
  return _buildPromise;
}

// Call after anything that changes jobs/Dispatch or its review status
// (new dispatch submitted, dispatch deleted/assigned, web app review action)
// so the next View Dispatch open doesn't serve stale data for up to an hour.
function invalidateDispatchCache() {
  _cache = null;
}

module.exports = { getDispatchCache, invalidateDispatchCache, fmtDate, PAGE_SIZE, RECENT_MONTHS };
