#!/usr/bin/env node
// backfill-rtdb-equipment-fields.js
// Renames RTDB equipment fields to camelCase across all job paths:
//
// jobs/Release/Regular:
//   machineLocation → equipmentName
//   equipment_name  → equipmentName  (older records)
//   machine_line    → machineLine
//   equipment_id    → equipmentId
//
// jobs/Dispatch:
//   machineLocation → equipmentName
//
// jobs/Train:
//   machineLocation → equipmentName
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

async function backfillPath(rtdbPath, updates) {
  const snap = await db.ref(rtdbPath).once('value');
  const jobs  = snap.val();
  if (!jobs) { console.log(`  ${rtdbPath}: no records, skipping.`); return 0; }

  let count = 0;

  for (const [jobId, job] of Object.entries(jobs)) {
    const base = `${rtdbPath}/${jobId}`;

    // machineLocation → equipmentName
    if ('machineLocation' in job) {
      updates[`${base}/equipmentName`]   = job.machineLocation ?? null;
      updates[`${base}/machineLocation`] = null;
      count++;
    }

    // equipment_name → equipmentName  (older Regular records only)
    if ('equipment_name' in job && !('machineLocation' in job)) {
      updates[`${base}/equipmentName`]  = job.equipment_name ?? null;
      updates[`${base}/equipment_name`] = null;
      count++;
    }

    // machine_line → machineLine
    if ('machine_line' in job) {
      updates[`${base}/machineLine`]  = job.machine_line ?? null;
      updates[`${base}/machine_line`] = null;
      count++;
    }

    // equipment_id → equipmentId
    if ('equipment_id' in job) {
      updates[`${base}/equipmentId`]  = job.equipment_id ?? null;
      updates[`${base}/equipment_id`] = null;
      count++;
    }
  }

  console.log(`  ${rtdbPath}: ${Object.keys(jobs).length} records scanned, ${count} field(s) to rename.`);
  return count;
}

async function backfill() {
  const updates = {};

  const total = (await Promise.all([
    backfillPath('jobs/Release/Regular', updates),
    backfillPath('jobs/Dispatch',        updates),
    backfillPath('jobs/Train',           updates),
  ])).reduce((a, b) => a + b, 0);

  console.log(`\nTotal: ${total} field operation(s).`);

  if (total === 0) { console.log('Nothing to do.'); process.exit(0); }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would write:');
    for (const [p, val] of Object.entries(updates)) {
      console.log(`  ${val === null ? 'DELETE' : 'SET   '} ${p}${val !== null ? ` = ${JSON.stringify(val)}` : ''}`);
    }
    console.log('\nRe-run without DRY_RUN=1 to apply.');
  } else {
    await db.ref().update(updates);
    console.log(`✅  ${total} fields renamed.`);
  }

  process.exit(0);
}

backfill().catch(err => { console.error(err); process.exit(1); });
