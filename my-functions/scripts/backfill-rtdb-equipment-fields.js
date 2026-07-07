#!/usr/bin/env node
// backfill-rtdb-equipment-fields.js
// Renames RTDB field names on Regular jobs to match Equipment table column names:
//   machineLine     → machine_line
//   machineLocation → equipment_name
//
// Leaves the old fields in place during a dry run so you can verify first.
// On a real run, writes the new fields and deletes the old ones atomically.
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

  if (!jobs) {
    console.log('No Regular jobs found.');
    process.exit(0);
  }

  const updates = {};
  let needsUpdate = 0;

  for (const [jobId, job] of Object.entries(jobs)) {
    const base = `jobs/Release/Regular/${jobId}`;
    let changed = false;

    if ('machineLine' in job) {
      updates[`${base}/machine_line`]  = job.machineLine ?? null;
      updates[`${base}/machineLine`]   = null;  // delete old key
      changed = true;
    }

    if ('machineLocation' in job) {
      updates[`${base}/equipment_name`]  = job.machineLocation ?? null;
      updates[`${base}/machineLocation`] = null;  // delete old key
      changed = true;
    }

    if (changed) needsUpdate++;
  }

  console.log(`${Object.keys(jobs).length} records scanned, ${needsUpdate} need renaming.`);

  if (needsUpdate === 0) {
    console.log('Nothing to do.');
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log('[DRY RUN] Would write the following updates:');
    for (const [path, val] of Object.entries(updates)) {
      console.log(`  ${val === null ? 'DELETE' : 'SET   '} ${path}${val !== null ? ` = ${JSON.stringify(val)}` : ''}`);
    }
    console.log('\nRe-run without DRY_RUN=1 to apply.');
  } else {
    await db.ref().update(updates);
    console.log(`✅  ${needsUpdate} records updated.`);
  }

  process.exit(0);
}

backfill().catch(err => { console.error(err); process.exit(1); });
