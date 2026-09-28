#!/usr/bin/env node
// backfill-rtdb-regular-schema-violations.js
// Repairs jobs/Release/Regular records that fail RegularJobSchema.safeParse()
// (the source of the frontend's "Regular job schema violation" console
// warnings in useRealtimeJobs.js), for every known cause seen so far:
//
//   1. area missing (pre-migration records only had machineLocation)
//      -> area: machineLocation ?? null
//   1b. machineLine missing (e.g. handleAssignDispatchForm.js-promoted jobs
//      never set it at all) -> null, independent of whether area is present
//   2. equipmentId / equipmentName missing -> null
//   3. priority missing -> "medium" (same default handleNewJobForm.js uses)
//   4. assignedTo / issuePicture missing or not an array -> []
//   5. doneBy / notifySupervisor / messageToSupervisor / checkDetail === null
//      -> key removed (these are z.string().optional(), not .nullable();
//      handleOfflineJobForm.js used to write null here — now fixed at the source)
//
// Records still failing after these fixes (e.g. missing scheduledStart with
// no orderDate/orderTime to derive it from) are left untouched and listed
// under "NEEDS MANUAL REVIEW" — never guessed at.
//
// Only reports which fields are affected per job ID, never field values, so
// this is safe to run non-interactively.
//
// Usage:
//   SERVICE_ACCOUNT_KEY_PATH=/path/to/serviceAccount.json node scripts/backfill-rtdb-regular-schema-violations.js
//
// Dry-run (prints what would change, writes nothing):
//   DRY_RUN=1 SERVICE_ACCOUNT_KEY_PATH=... node scripts/backfill-rtdb-regular-schema-violations.js

const admin = require('firebase-admin');
const path  = require('path');
const { RegularJobSchema } = require('../schemas/regularJob');

const DRY_RUN  = process.env.DRY_RUN === '1';
const KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH
  || path.join(__dirname, '..', 'serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH)),
  databaseURL: process.env.DATABASE_URL
    || 'https://maintenance-form-602d9-default-rtdb.firebaseio.com',
});

const db = admin.database();
const RTDB_PATH = 'jobs/Release/Regular';

const NULL_TO_UNDEFINED_FIELDS = ['doneBy', 'notifySupervisor', 'messageToSupervisor', 'checkDetail'];

function planFixes(job) {
  const fixes = {}; // field -> new value (or REMOVE sentinel)
  const REMOVE = Symbol('remove');

  if (job.area === undefined) fixes.area = job.machineLocation ?? null;
  if (job.machineLine === undefined) fixes.machineLine = null;
  if (job.equipmentId === undefined) fixes.equipmentId = null;
  if (job.equipmentName === undefined) fixes.equipmentName = null;
  if (job.priority === undefined) fixes.priority = 'medium';
  if (!Array.isArray(job.assignedTo)) fixes.assignedTo = [];
  if (!Array.isArray(job.issuePicture)) fixes.issuePicture = [];

  for (const f of NULL_TO_UNDEFINED_FIELDS) {
    if (job[f] === null) fixes[f] = REMOVE;
  }

  return { fixes, REMOVE };
}

async function main() {
  const snap = await db.ref(RTDB_PATH).once('value');
  const jobs = snap.val();
  if (!jobs) { console.log(`${RTDB_PATH}: no records found.`); process.exit(0); }

  const updates = {};
  let fixableCount = 0;
  let manualCount = 0;
  const manualIds = [];

  for (const [jobId, job] of Object.entries(jobs)) {
    const result = RegularJobSchema.safeParse(job);
    if (result.success) continue;

    const failingFields = Object.keys(result.error.flatten().fieldErrors);
    const { fixes, REMOVE } = planFixes(job);
    const fixedFields = Object.keys(fixes);

    // Apply the planned fixes to a copy and re-validate before trusting them.
    const patched = { ...job };
    for (const [f, v] of Object.entries(fixes)) {
      if (v === REMOVE) delete patched[f];
      else patched[f] = v;
    }
    const afterFix = RegularJobSchema.safeParse(patched);

    if (afterFix.success && fixedFields.length > 0) {
      console.log(`  ${jobId}: FIX ${fixedFields.join(', ')}  (was failing: ${failingFields.join(', ')})`);
      for (const [f, v] of Object.entries(fixes)) {
        updates[`${RTDB_PATH}/${jobId}/${f}`] = v === REMOVE ? null : v;
      }
      fixableCount++;
    } else {
      console.log(`  ${jobId}: NEEDS MANUAL REVIEW — failing fields: ${failingFields.join(', ')}`);
      manualCount++;
      manualIds.push(jobId);
    }
  }

  console.log(`\n${RTDB_PATH}: ${Object.keys(jobs).length} records scanned.`);
  console.log(`  ${fixableCount} auto-fixable, ${manualCount} need manual review.`);
  if (manualIds.length) console.log(`  Manual review IDs: ${manualIds.join(', ')}`);

  if (fixableCount === 0) { console.log('Nothing to auto-fix.'); process.exit(0); }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No writes performed. Re-run without DRY_RUN=1 to apply.');
  } else {
    await db.ref().update(updates);
    console.log(`✅  ${fixableCount} record(s) fixed.`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
