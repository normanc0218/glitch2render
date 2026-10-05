# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This repo is two independent Firebase Functions codebases, declared in the root `firebase.json` (`functions` array with `codebase` names) — deploy commands must be run from the **repo root**, not from inside `functions/` or `my-functions/`:
```
firebase deploy --only functions:slack-app     # deploys my-functions/ (the Slack bot)
firebase deploy --only functions:scheduler      # deploys functions/ (the nightly PM-job generator)
firebase deploy --only functions                # both
```

Local dev on the Slack bot (`my-functions/`):
```
cd my-functions
npm run dev     # nodemon + functions-framework, target=slackHandler, listens on $PORT (default 8080)
npm start       # same target, no watch
```
No test suite exists in either codebase (`npm test` is a no-op placeholder in `my-functions/package.json`).

One-off Firebase RTDB backfill/migration scripts live in `my-functions/scripts/` and are run directly with `node`, e.g.:
```
SERVICE_ACCOUNT_KEY_PATH=/path/to/serviceAccount.json node scripts/backfill-rtdb-priority.js
DRY_RUN=1 SERVICE_ACCOUNT_KEY_PATH=... node scripts/backfill-rtdb-datetime-consolidate.js   # dry-run first
```
They default to `my-functions/serviceAccount.json` (a local, gitignored-by-convention Firebase service account key downloaded from Firebase Console → Service accounts) if `SERVICE_ACCOUNT_KEY_PATH` isn't set.

## Architecture

### Two codebases, two very different jobs

- **`functions/`** (codebase `scheduler`, Node 22) — a single scheduled function, `processScheduledJobs`, cron `0 3 * * *`. Reads recurring-job templates from RTDB `jobs/Schedule`, skips a hardcoded holiday list and (for `daily` jobs) weekends, and writes generated instances to `jobs/Release/Daily/{newJobId}`. Self-contained — no Slack, no SQL.
- **`my-functions/`** (codebase `slack-app`, Node 20) — the actual Slack bot. A single Express app exported as `slackHandler` (Cloud Functions v2 `onRequest`). Three routes, each Slack-signature-verified by `utils/verifySlackSignature.js` (HMAC-SHA256 over `v0:{timestamp}:{rawBody}` using `SLACK_SIGNING_SECRET`; bypassed for Slack's `url_verification` handshake and whenever `NODE_ENV=development`):
  - `POST /slack/events` → `routes/slackEvents.js`
  - `POST /slack/actions` → `routes/slackActions.js` — the one handler for **every** block-action button click, `view_submission` modal submit, and slash command; it branches internally on `payload.type` / `action_id` / `view.callback_id` rather than being split into per-route handlers.
  - `POST /slack/options` → `routes/slackOptions.js` — select-menu option loading

### Two databases, two different clients

- `my-functions/db.js` — Firebase Admin RTDB client, for the `jobs/*` tree (Regular, Project, Train, Dispatch, Schedule, Release/Daily).
- `my-functions/db-sql.js` — a `pg` pool (via `db-sql-postgres.js`, Cloud SQL Connector) to **the same GCP Cloud SQL (Postgres) database used by `d:\interact_schedule`** (instance `maintenance-form-602d9:us-central1:rizopia-postgres`, db `rizopia`). This bot reads/writes it (Tasks, Projects, SlackUsers, JobReviews, etc.) directly — it does not call interact_schedule's REST API. Azure SQL is decommissioned; there is no mssql path anymore.
  - Call sites still use the mssql-style API (`pool.request().input('x', sql.NVarChar, v).query('... @x ...')`) and T-SQL idioms (`TOP n`, `GETDATE()`, `active = 1`). `db-sql-postgres.js`'s `translateToPostgres()` rewrites only the specific constructs found in this codebase — any **new** T-SQL-only syntax needs a rule there or must be written as portable SQL.
  - Required env: `INSTANCE_CONNECTION_NAME`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE` (CI writes them from GitHub secrets in `.github/workflows/deploy.yml`; local dev reads `my-functions/.env.local` and needs `gcloud auth application-default login`).

`userConfig.js` is a back-compat shim only; the real data (`maintenanceStaff`, `Supervisors`, `managerUsers`, `trainUsers`) comes from `services/slackUserService.js`, which queries the `SlackUsers` table (Cloud SQL) at boot and refreshes on a 5-minute TTL (`refreshIfStale()`), not from any hardcoded map.

### Modal / handler aggregation pattern

- `modals/index.js` re-exports every `openModal_*.js` builder (one file per modal view) — `slackActions.js` imports the whole set from there rather than from individual files.
- `services/handlers/index.js` similarly aggregates the `handleNew*Form`, `handleUpdateProgress`, `handleReview`, etc. form-submission handlers, each of which corresponds to one modal's `view_submission`.
- `utils/buildJobDetailBlocks.js` builds the Slack Block Kit layout shared by multiple "view detail" modals — when a Task/Project column is added or renamed, this is usually the first place to update.

### Cross-repo dependency: `d:\interact_schedule`

This bot and the `interact_schedule` web app are two different surfaces sharing one Cloud SQL (Postgres) database as the source of truth:
- RTDB paths this bot writes under `jobs/Release/{Regular,Project,Train,Dispatch}` are read live by interact_schedule's frontend (`useRealtimeJobs()`). `jobs/Release/Daily` (generated by the `scheduler` codebase here) is intentionally **not** read there — it duplicates PM Tasks already in Cloud SQL.
- Dispatch jobs created via Slack are reviewed and promoted into a Cloud SQL `Projects` row from the *web app* (not from this bot) — see interact_schedule's `Calendar.jsx` → `POST /api/projects`.
- A Task/Project schema or status-value change on one side generally needs the matching change here too (SQL SELECT/INSERT column lists in `db-sql.js` consumers, and Block Kit displays in `buildJobDetailBlocks.js` / `openModal_sql_task_view.js` / `openModal_supervisor_approval.js`).
- Datetime convention matches interact_schedule: `db-sql-postgres.js` returns `timestamp`/`date` columns as raw strings (no UTC conversion), so values must be treated as naive local time, not UTC.
