#!/usr/bin/env node
// backfill-rtdb-equipment-fields.js
// Two-phase migration for RTDB Regular jobs:
//
// Phase 1 — rename fields to match Equipment table column names:
//   machineLine     → machine_line
//   machineLocation → equipment_name
//
// Phase 2 — backfill equipment_id for filtering:
//   Queries Azure SQL Equipment table to reverse-lookup equipment_id
//   from the stored equipment_name, then writes it back to each record.
//
// Usage:
//   SERVICE_ACCOUNT_KEY_PATH=/path/to/serviceAccount.json node scripts/backfill-rtdb-equipment-fields.js
//
// Dry-run (prints what would change, writes nothing):
//   DRY_RUN=1 SERVICE_ACCOUNT_KEY_PATH=... node scripts/backfill-rtdb-equipment-fields.js

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const admin = require('firebase-admin');
const path  = require('path');
const { getPool, sql } = require('../db-sql');

const DRY_RUN  = process.env.DRY_RUN === '1';
const KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH
  || path.join(__dirname, '..', 'serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH)),
  databaseURL: process.env.DATABASE_URL
    || 'https://maintenance-form-602d9-default-rtdb.firebaseio.com',
});

const db = admin.database();

async function buildEquipmentMap(names) {
  if (names.length === 0) return {};
  const pool = await getPool();

  // Fetch all equipment in one query, then filter in JS
  const result = await pool.request()
    .query('SELECT equipment_id, equipment_name FROM Equipment');

  const map = {};
  for (const row of result.recordset) {
    if (row.equipment_name) map[row.equipment_name] = row.equipment_id;
    // Also index by equipment_id itself — covers the fallback case where
    // resolveEquipmentName() stored the raw equipment_id as the "name"
    map[row.equipment_id] = row.equipment_id;
  }
  return map;
}

async function backfill() {
  const snap = await db.ref('jobs/Release/Regular').once('value');
  const jobs  = snap.val();

  if (!jobs) { console.log('No Regular jobs found.'); process.exit(0); }

  // Collect unique equipment name values for the SQL lookup
  const equipNames = new Set(
    Object.values(jobs)
      .map(j => j.machineLocation || j.equipment_name)
      .filter(Boolean)
  );

  console.log(`${Object.keys(jobs).length} records found. Querying Equipment table for ${equipNames.size} unique names…`);
  const equipMap = await buildEquipmentMap([...equipNames]);

  const updates = {};
  let renamed = 0, resolved = 0, unresolved = [];

  for (const [jobId, job] of Object.entries(jobs)) {
    const base = `jobs/Release/Regular/${jobId}`;

    // Phase 1: rename machineLine → machine_line
    if ('machineLine' in job) {
      updates[`${base}/machine_line`]  = job.machineLine ?? null;
      updates[`${base}/machineLine`]   = null;
      renamed++;
    }

    // Phase 1: rename machineLocation → equipment_name
    if ('machineLocation' in job) {
      updates[`${base}/equipment_name`]  = job.machineLocation ?? null;
      updates[`${base}/machineLocation`] = null;
      renamed++;
    }

    // Phase 2: backfill equipment_id if missing
    if (!job.equipment_id) {
      const nameKey = job.machineLocation || job.equipment_name;
      const equipId = nameKey ? equipMap[nameKey] : null;
      if (equipId) {
        updates[`${base}/equipment_id`] = equipId;
        resolved++;
      } else {
        unresolved.push({ jobId, name: nameKey || '(none)' });
      }
    }
  }

  console.log(`\nPhase 1 — field renames:    ${renamed} field(s) to rename`);
  console.log(`Phase 2 — equipment_id:     ${resolved} resolved, ${unresolved.length} unresolved`);

  if (unresolved.length > 0) {
    console.log('\nUnresolved (equipment_name not found in Equipment table):');
    for (const u of unresolved) {
      console.log(`  ${u.jobId}  →  "${u.name}"`);
    }
  }

  if (Object.keys(updates).length === 0) {
    console.log('\nNothing to update.');
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would write the following updates:');
    for (const [p, val] of Object.entries(updates)) {
      console.log(`  ${val === null ? 'DELETE' : 'SET   '} ${p}${val !== null ? ` = ${JSON.stringify(val)}` : ''}`);
    }
    console.log('\nRe-run without DRY_RUN=1 to apply.');
  } else {
    await db.ref().update(updates);
    console.log(`\n✅  Done. ${Object.keys(updates).length} updates written.`);
  }

  process.exit(0);
}

backfill().catch(err => { console.error(err); process.exit(1); });
