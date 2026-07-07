#!/usr/bin/env node
// backfill-rtdb-priority.js
// Sets priority = "medium" on any RTDB job record that is missing the field.
// Touches all three job branches: Regular, Daily, Project.
//
// Usage:
//   SERVICE_ACCOUNT_KEY_PATH=/path/to/serviceAccount.json node scripts/backfill-rtdb-priority.js
//
// Dry-run (print what would change, write nothing):
//   DRY_RUN=1 SERVICE_ACCOUNT_KEY_PATH=... node scripts/backfill-rtdb-priority.js

const admin = require('firebase-admin');
const path  = require('path');

const DRY_RUN = process.env.DRY_RUN === '1';
const KEY_PATH = process.env.SERVICE_ACCOUNT_KEY_PATH
  || path.join(__dirname, '..', 'serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH)),
  databaseURL: process.env.DATABASE_URL
    || 'https://maintenance-form-602d9-default-rtdb.firebaseio.com',
});

const db = admin.database();
const BRANCHES = ['Regular'];

async function backfill() {
  let total = 0, updated = 0;

  for (const branch of BRANCHES) {
    const snap = await db.ref(`jobs/Release/${branch}`).once('value');
    const jobs = snap.val();
    if (!jobs) { console.log(`${branch}: (empty)`); continue; }

    const updates = {};
    for (const [jobId, job] of Object.entries(jobs)) {
      total++;
      if (job.priority == null) {
        updates[`jobs/Release/${branch}/${jobId}/priority`] = 'medium';
        updated++;
      }
    }

    const count = Object.keys(updates).length;
    console.log(`${branch}: ${Object.keys(jobs).length} records, ${count} need backfill`);

    if (count > 0 && !DRY_RUN) {
      await db.ref().update(updates);
      console.log(`  ✅ wrote ${count} updates`);
    } else if (count > 0) {
      console.log(`  [DRY RUN] would write ${count} updates`);
    }
  }

  console.log(`\nDone. ${updated} / ${total} records updated.${DRY_RUN ? ' (dry run — nothing written)' : ''}`);
  process.exit(0);
}

backfill().catch(err => { console.error(err); process.exit(1); });
