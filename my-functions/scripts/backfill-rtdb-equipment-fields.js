#!/usr/bin/env node
// backfill-rtdb-equipment-fields.js
// Renames RTDB fields on Regular jobs to match Equipment table column names:
//   machineLine     → machine_line
//   machineLocation → equipment_name
//
// equipment_id must be added manually in Firebase console for existing records.
//
// Usage:
//   SERVICE_ACCOUNT_KEY_PATH=/path/to/serviceAccount.json node scripts/backfill-rtdb-equipment-fields.js
//
// Dry-run (prints what would change, writes nothing):
//   DRY_RUN=1 SERVICE_ACCOUNT_KEY_PATH=... node scripts/backfill-rtdb-equipment-fields.js

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

async function backfill() {
  const snap = await db.ref('jobs/Release/Regular').once('value');
  const jobs  = snap.val();

  if (!jobs) { console.log('No Regular jobs found.'); process.exit(0); }

  const updates = {};
  let count = 0;

  for (const [jobId, job] of Object.entries(jobs)) {
    const base = `jobs/Release/Regular/${jobId}`;

    if ('machineLine' in job) {
      updates[`${base}/machine_line`]  = job.machineLine ?? null;
      updates[`${base}/machineLine`]   = null;
      count++;
    }

    if ('machineLocation' in job) {
      updates[`${base}/equipment_name`]  = job.machineLocation ?? null;
      updates[`${base}/machineLocation`] = null;
      count++;
    }
  }

  console.log(`${Object.keys(jobs).length} records scanned, ${count} field(s) to rename.`);

  if (count === 0) { console.log('Nothing to do.'); process.exit(0); }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would write:');
    for (const [p, val] of Object.entries(updates)) {
      console.log(`  ${val === null ? 'DELETE' : 'SET   '} ${p}${val !== null ? ` = ${JSON.stringify(val)}` : ''}`);
    }
    console.log('\nRe-run without DRY_RUN=1 to apply.');
  } else {
    await db.ref().update(updates);
    console.log(`✅  ${count} fields renamed.`);
  }

  process.exit(0);
}

backfill().catch(err => { console.error(err); process.exit(1); });
