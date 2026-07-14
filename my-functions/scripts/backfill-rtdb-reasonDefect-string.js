#!/usr/bin/env node
// backfill-rtdb-reasonDefect-string.js
// Converts legacy array-shaped `reasonDefect` fields to a single string.
//
// Old handleUpdateProgress.js used a multi-select (`selected_options`), storing
// reasonDefect as an array of strings, e.g. ["Wear or Tear"]. The current code
// uses a single-select (`selected_option`), storing a plain string. RegularJobSchema
// expects a string, so legacy array-shaped records fail schema validation on read
// (frontend useRealtimeJobs.js "schema violation" warnings).
//
// jobs/Release/Regular, jobs/Release/Daily, jobs/Release/Project:
//   reasonDefect: string[] → reasonDefect: string  (joined with ", " if multiple)
//
// Usage:
//   SERVICE_ACCOUNT_KEY_PATH=/path/to/serviceAccount.json node scripts/backfill-rtdb-reasonDefect-string.js
//
// Dry-run (prints what would change, writes nothing):
//   DRY_RUN=1 SERVICE_ACCOUNT_KEY_PATH=... node scripts/backfill-rtdb-reasonDefect-string.js

const admin = require('firebase-admin');
const path  = require('path');

const DRY_RUN  = process.env.DRY_RUN === '1';
const KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH
  || path.join(__dirname, '..', 'serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH)),
  databaseURL: process.env.DATABASE_URL
    || 'https://maintenance-form-602d9-default-rtdb.firebaseio.com',
});

const db = admin.database();

const PATHS = [
  'jobs/Release/Regular',
  'jobs/Release/Daily',
  'jobs/Release/Project',
];

async function backfillPath(rtdbPath, updates) {
  const snap = await db.ref(rtdbPath).once('value');
  const jobs = snap.val();
  if (!jobs) { console.log(`  ${rtdbPath}: no records found, skipping.`); return 0; }

  let count = 0;

  for (const [jobId, job] of Object.entries(jobs)) {
    if (!Array.isArray(job.reasonDefect)) continue;

    const joined = job.reasonDefect.filter(Boolean).join(', ') || null;
    updates[`${rtdbPath}/${jobId}/reasonDefect`] = joined;
    count++;
  }

  console.log(`  ${rtdbPath}: ${Object.keys(jobs).length} records scanned, ${count} to convert.`);
  return count;
}

async function backfill() {
  const updates = {};
  let total = 0;

  for (const rtdbPath of PATHS) {
    total += await backfillPath(rtdbPath, updates);
  }

  console.log(`\nTotal: ${total} record(s) to convert.`);

  if (total === 0) { console.log('Nothing to do.'); process.exit(0); }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would write:');
    for (const [p, val] of Object.entries(updates)) {
      console.log(`  SET ${p} = ${JSON.stringify(val)}`);
    }
    console.log('\nRe-run without DRY_RUN=1 to apply.');
  } else {
    await db.ref().update(updates);
    console.log(`✅  ${total} record(s) converted.`);
  }

  process.exit(0);
}

backfill().catch(err => { console.error(err); process.exit(1); });
