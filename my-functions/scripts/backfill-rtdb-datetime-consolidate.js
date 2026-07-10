#!/usr/bin/env node
// backfill-rtdb-datetime-consolidate.js
// Consolidates split date+time fields into single ISO datetime strings across all RTDB job paths.
//
// jobs/Release/Regular:
//   scheduledDate + scheduledTime     → scheduledStart
//   actualStartDate + actualStartTime → actualStart
//   actualEndDate   + actualEndTime   → actualEnd
//   acceptDate      + acceptTime      → acceptDatetime
//   rejectDate      + rejectTime      → rejectDatetime
//   checkDate       + checkTime       → checkDatetime
//   dispatchDate    + dispatchTime    → dispatchDatetime  (passthrough from original dispatch)
//
// jobs/Dispatch:
//   dispatchDate + dispatchTime → dispatchDatetime
//
// jobs/Train:
//   orderDate + orderTime → orderDatetime
//
// Old split fields are deleted after consolidation.
//
// Usage:
//   SERVICE_ACCOUNT_KEY_PATH=/path/to/serviceAccount.json node scripts/backfill-rtdb-datetime-consolidate.js
//
// Dry-run (prints what would change, writes nothing):
//   DRY_RUN=1 SERVICE_ACCOUNT_KEY_PATH=... node scripts/backfill-rtdb-datetime-consolidate.js

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

function combine(date, time) {
  if (!date) return null;
  const t = time ? time.slice(0, 5) : '00:00';
  return `${date}T${t}`;
}

const SOURCES = [
  {
    path: 'jobs/Release/Regular',
    pairs: [
      { dateField: 'scheduledDate',   timeField: 'scheduledTime',   combined: 'scheduledStart'  },
      { dateField: 'actualStartDate', timeField: 'actualStartTime', combined: 'actualStart'     },
      { dateField: 'actualEndDate',   timeField: 'actualEndTime',   combined: 'actualEnd'       },
      { dateField: 'acceptDate',      timeField: 'acceptTime',      combined: 'acceptDatetime'  },
      { dateField: 'rejectDate',      timeField: 'rejectTime',      combined: 'rejectDatetime'  },
      { dateField: 'checkDate',       timeField: 'checkTime',       combined: 'checkDatetime'   },
      { dateField: 'dispatchDate',    timeField: 'dispatchTime',    combined: 'dispatchDatetime'},
    ],
  },
  {
    path: 'jobs/Dispatch',
    pairs: [
      { dateField: 'dispatchDate', timeField: 'dispatchTime', combined: 'dispatchDatetime' },
    ],
  },
  {
    path: 'jobs/Train',
    pairs: [
      { dateField: 'orderDate', timeField: 'orderTime', combined: 'orderDatetime' },
    ],
  },
];

async function backfillPath(rtdbPath, pairs, updates) {
  const snap = await db.ref(rtdbPath).once('value');
  const jobs  = snap.val();
  if (!jobs) { console.log(`  ${rtdbPath}: no records found, skipping.`); return 0; }

  let jobCount = 0;

  for (const [jobId, job] of Object.entries(jobs)) {
    const base = `${rtdbPath}/${jobId}`;
    let changed = false;

    for (const { dateField, timeField, combined } of pairs) {
      const hasDate     = dateField in job;
      const hasTime     = timeField in job;
      const hasCombined = combined  in job;

      if (!hasDate && !hasTime) continue;

      if (!hasCombined) {
        updates[`${base}/${combined}`] = combine(job[dateField], job[timeField]);
        changed = true;
      }

      if (hasDate) { updates[`${base}/${dateField}`] = null; changed = true; }
      if (hasTime) { updates[`${base}/${timeField}`] = null; changed = true; }
    }

    if (changed) jobCount++;
  }

  console.log(`  ${rtdbPath}: ${Object.keys(jobs).length} records scanned, ${jobCount} to update.`);
  return jobCount;
}

async function backfill() {
  const updates = {};
  let total = 0;

  for (const { path: rtdbPath, pairs } of SOURCES) {
    total += await backfillPath(rtdbPath, pairs, updates);
  }

  const opCount = Object.keys(updates).length;
  console.log(`\nTotal: ${total} job(s), ${opCount} field operation(s).`);

  if (opCount === 0) { console.log('Nothing to do.'); process.exit(0); }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would write:');
    for (const [p, val] of Object.entries(updates)) {
      console.log(`  ${val === null ? 'DELETE' : 'SET   '} ${p}${val !== null ? ` = ${JSON.stringify(val)}` : ''}`);
    }
    console.log('\nRe-run without DRY_RUN=1 to apply.');
  } else {
    await db.ref().update(updates);
    console.log(`✅  ${total} jobs updated, ${opCount} field operations applied.`);
  }

  process.exit(0);
}

backfill().catch(err => { console.error(err); process.exit(1); });
