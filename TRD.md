# Slack Maintenance Bot — Technical Reference Document

> Last updated: 2026-07-23  
> Repo: `d:\Slack_Cloud\slack-firebase\my-functions\`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
   - 3.1 [Entry & Routing](#31-entry--routing)
   - 3.2 [Data Stores](#32-data-stores)
   - 3.3 [App Home](#33-app-home)
   - 3.4 [Job Lifecycle](#34-job-lifecycle)
   - 3.5 [Validation Schemas](#35-validation-schemas)
4. [Debug Journal: App Home Blank Screen](#4-debug-journal-app-home-blank-screen)
5. [Bug Report](#5-bug-report)

---

## 1. Overview

A Firebase Cloud Function (Node.js 20) running the maintenance team's Slack bot. Handles job creation, technician assignment, progress updates, and supervisor approval — bridging Slack interactions with Firebase RTDB (release/dispatch/train jobs) and Azure SQL (PM tasks and projects).

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Firebase Cloud Functions v2 (Node 20) | 512 MiB, 60s timeout, minInstances: 1 |
| HTTP framework | Express 5 | Single app, 4 routes |
| Slack SDK | `@slack/web-api` + raw axios | Mixed — older modals use axios directly |
| RTDB | Firebase Admin SDK | Jobs, dispatch, training records |
| SQL | mssql + tedious | Azure SQL Basic DTU, single pool with keepalive |
| Validation | Zod | 3 schemas guard all SQL writes |
| Auth | Slack request signature (HMAC-SHA256) | Every route except `/health` |

---

## 3. Architecture

### 3.1 Entry & Routing

`index.js` exports a single function `slackHandler`. All Slack routes are protected inline by `verifySlackSignature` before the route handler runs. `res.sendStatus(200)` fires before any async work in every handler, satisfying Slack's 3-second acknowledgement window.

| Method + Path | Handler | Purpose |
|---------------|---------|---------|
| `POST /slack/events` | `routes/slackEvents.js` | URL verification + `app_home_opened` |
| `POST /slack/actions` | `routes/slackActions.js` | All button clicks (`block_actions`) and modal submissions (`view_submission`) |
| `POST /slack/options` | `routes/slackOptions.js` | Cascading dropdowns: Area → Machine Line → Equipment (queries Azure SQL) |
| `GET /health` | inline | Uptime check — returns `{ status: "ok" }` |

All action routing in `slackActions.js` is a large `switch(action_id)` for `block_actions` and a separate `switch(callback_id)` for `view_submission`.

---

### 3.2 Data Stores

Two independent backends, never abstracted behind a shared interface.

**Firebase RTDB** (`db.js`)

The web app (`interact_schedule`) reads `jobs/Release` live via `useRealtimeJobs()`. `jobs/Release/Daily` is intentionally not read by the web app — it duplicates PM Tasks already in Azure SQL.

| Path | Contents |
|------|---------|
| `jobs/Release/Regular` | Regular maintenance jobs (bot-created) |
| `jobs/Release/Daily` | Daily PM jobs (bot-created) |
| `jobs/Release/Project` | Project jobs (bot-created) |
| `jobs/Dispatch` | Unassigned dispatch orders |
| `jobs/Train` | Training records |
| `users` | User profile data (cached 60s) |

**Azure SQL** (`db-sql.js`)

Pool configured with keepalive (`keepAlive: true`, `keepAliveInitialDelay: 30s`) to prevent ECONNRESET after idle periods.

| Table | Used by bot for |
|-------|----------------|
| `Tasks` | PM task completion + supervisor review (UPDATE only — web app creates) |
| `Projects` | Project completion + supervisor review |
| `Equipment` | Cascading dropdown options |
| `SlackUsers` | Name/role lookup, cached 15 min |
| `Technicians` | Tech name resolution |
| `ProjectEquipment` | Equipment display in job detail blocks |
| `JobReviews` | Audit trail for approvals |

---

### 3.3 App Home

`services/modalService.displayHome(userId)` builds a personalised Slack App Home tab for each user based on their role.

```
processingHome (Set)  — prevents concurrent displayHome for same user
pendingHome (Set)     — queues ONE subsequent call if lock is held

displayHome(userId):
  if processingHome.has(userId) → pendingHome.add(userId) → return
  processingHome.add(userId)
  safetyTimer = setTimeout(30s, release lock + drain pending)
  try:
    refreshIfStale()           — SlackUsers cache (15 min TTL)
    getUserRoles(userId)
    buildXxxHome()             — queries homeQueries.js
    client.views.publish()
  finally:
    clearTimeout(safetyTimer)
    processingHome.delete(userId)
    if pendingHome has userId → delete + displayHome(userId)  ← tail call
```

**Why pendingHome instead of skip:** Slack iOS fires multiple `app_home_opened` events per tab open. Skipping concurrent calls caused blank screens — the client waited for a push that never came. Queuing ensures every open eventually gets a `views.publish`.

#### SQL Query Cache (`homeQueries.js`)

All Azure SQL calls are cached in-process to avoid 1400ms+ cold hits on every App Home open.

| Function | Cache key | TTL |
|----------|-----------|-----|
| `getTasksForTechnician` | sorted techNames joined | 2 min |
| `getProjectsForTechnician` | sorted techNames joined | 2 min |
| `getTasksPendingApproval` | global | 2 min |
| `getProjectsPendingApproval` | global | 2 min |
| `getUpcomingTasks` | global | 2 min |
| `getPromotedRtdbJobIds` | global | 2 min |
| `getSlackUserRow` | userId | 5 min |
| `getRelease` (RTDB) | global | 30 s |
| `getUsers` (RTDB) | global | 60 s |

`invalidateSqlCache()` clears all SQL caches immediately — called by `handleUpdateProgress` and `handleReview` after any SQL write so bot-triggered changes appear instantly. `invalidateReleaseCache()` does the same for the RTDB job cache.

---

### 3.4 Job Lifecycle

**RTDB Path — Regular Jobs**

```
Submit Order button
  → openModal (cascading dropdowns from Equipment table)
  → handleNewJobForm → Zod validation → RTDB write → notifyChannel

Tech accepts
  → accept_task (inline) or handlePlanAcceptForm → RTDB update

Tech updates progress
  → handleUpdateProgress → saveJobSmart → RTDB → notify supervisor

Supervisor approves
  → handleReview → saveJobSmart → RTDB → refresh tech home
```

**SQL Path — PM Tasks & Projects**

```
Tech: update_daily_job
  → openModal_daily_update
  → handleSqlTaskUpdate → UPDATE Tasks → invalidateSqlCache()

Supervisor: approve_sql_task
  → sql_task_review submission
  → UPDATE Tasks (inline in slackActions.js) → invalidateSqlCache()

Projects: same pattern via update_project / review_progress
```

**Dispatch Flow**

```
openModal_dispatch → handleNewDispatchForm → jobs/Dispatch/DSP-xxx

openModal_assign_dispatch → handleAssignDispatchForm
  → delete DSP → create new JOB- in jobs/Release/Regular
```

---

### 3.5 Validation Schemas

Schemas use `.parse()` (throws on failure), caught by the top-level try/catch in `slackActions.js` which DMs the user with the error.

| Schema | File | Guards |
|--------|------|--------|
| `RegularJobCreateSchema` | `schemas/regularJob.js` | RTDB Regular job creation |
| `TaskCompletionSchema` | `schemas/sqlTask.js` | `UPDATE Tasks` on completion |
| `TaskReviewSchema` | `schemas/sqlTask.js` | `UPDATE Tasks` on approval |
| `ProjectCompletionSchema` | `schemas/sqlProject.js` | `UPDATE Projects` on completion |
| `ProjectReviewSchema` | `schemas/sqlProject.js` | `UPDATE Projects` on approval |

---

## 4. Debug Journal: App Home Blank Screen

**Device:** iPhone 8, iOS 16.7.16 (max iOS for this hardware), old Slack client (new Slack requires iOS 17+).  
**Symptom:** Slack App Home tab shows blank screen on open, sometimes with "We had some trouble connecting. Try again."  
**Pattern before fixes:** Strictly alternating — one open shows content, next is blank.

---

### Fix #1 — `db-sql.js` — TCP keepalive

**Problem:** Azure SQL drops idle TCP connections after ~2 hours. Pool resets and the next request takes 22–36 seconds to reconnect, making `views.publish` take 36 seconds total — long enough that Slack iOS shows blank for the entire duration.

**Evidence in logs:**
```
SQL pool error — resetting for full reconnect: Connection lost - write ECONNRESET
Home published | Total: 36264ms
```

**Fix:** Added `keepAlive: true`, `keepAliveInitialDelay: 30000ms`, pool `min: 1`.  
No DTU cost — keepalive packets are OS-level only.

---

### Fix #2 — `services/modalService.js` — Removed blocksCache skip

**Problem:** The old `blocksCache` skipped `views.publish` if blocks were unchanged within a 30-second TTL. Slack iOS fires two `app_home_opened` events per tab open. Event #1 published and cached; event #2 (milliseconds later) hit the cache → skipped → Slack iOS waited for a push that never came → blank.

This caused the strict alternating pattern: event #1 always publishes (odd opens = good), event #2 always skips (even opens = blank).

**Fix:** Removed `blocksCache` entirely. Every event gets a `views.publish`.  
**Result:** Blank rate 1/2 → 1/3.

---

### Fix #3 — `routes/slackEvents.js` — Debounce 2000ms → 500ms

**Problem:** The 2000ms debounce on `app_home_opened` blocked legitimate opens when the user switched tabs within 2 seconds.

**Fix:** Reduced to 500ms to filter only genuine rapid duplicates within the same event burst.

---

### Fix #4 — `services/modalService.js` — processingHome: skip → pendingHome queue

**Problem:** The `processingHome` lock dropped any `displayHome` call that arrived while one was in progress. If Slack iOS sent two events and the first was slow (>500ms), the second was discarded entirely.

**Fix:** Added `pendingHome` Set. Concurrent calls are queued (not dropped). The `finally` block checks `pendingHome` and triggers the queued call after the current run completes. The Set deduplicates — no matter how many events arrive, at most one queued run is triggered.

---

### Fix #5 — `services/homeQueries.js` — 2-minute SQL query cache

**Problem:** First App Home open after cache expiry hit Azure SQL directly — 1465ms (Basic DTU limit). Even on subsequent opens with a warm SQL Server, Node.js still ran the full query each time (76–290ms).

**Evidence in logs:**
```
📊 DB queries: 1465ms  ← cache cold
📊 DB queries: 0ms     ← cache hit (after fix)
✅ Home published | Total: 104ms
```

**Fix:** Added Node.js in-memory cache (2-min TTL) for all SQL queries used in `displayHome`. `invalidateSqlCache()` called by write handlers so bot-triggered changes are immediate. External writes (web app) see up to 2-min delay — acceptable.  
**Result:** Blank rate 1/3 → 1/4. Publish time 2400ms → 100-400ms.

---

### Experiment — Auto-retry at T+2s, T+5s, T+10s (reverted)

**Hypothesis:** Blank persists because Slack iOS misses the WebSocket push due to timing. Retrying after a delay might catch the WebSocket reconnect window.

**Result:** All retries showed `🔄 Auto-retry published` in logs (Slack API returned 200 each time). Screen remained blank for 10+ seconds on iPhone 8. On iPhone 17 Pro, the same server code never shows blank.

**Conclusion:** The server is publishing correctly. The old Slack iOS client on iPhone 8 **does not re-render App Home even when Slack's servers receive new published views** during a WebSocket reconnect. This is client-side behaviour — newer Slack clients auto-re-fetch App Home after reconnect; the old version does not.

**Action:** Reverted. Retries added unnecessary API calls with no benefit.

---

### Root Cause Summary

Two distinct types of blank screen:

**Type A — Server-side (fixed):** Cache-cold first publish takes ~1360ms. Slack iOS clears the view on tab open and shows blank while waiting for the push. Resolves automatically. Fixed by SQL cache.

**Type B — Client-side (unfixable server-side):** iPhone 8's old Slack client loses its WebSocket connection and does not re-request App Home upon reconnect. The server can publish any number of times; the client will not render until the user manually switches tabs. Remaining blank rate after all server fixes: ~1/4 opens.

**Hardware chain:** iPhone 8 → max iOS 16 → max old Slack version (new Slack requires iOS 17+) → missing WebSocket reconnect re-fetch behaviour. Not fixable from the server.

| Stage | Blank rate |
|-------|-----------|
| Before any fixes | 1/2 (alternating) |
| After blocksCache removal + pendingHome queue | 1/3 |
| After SQL query cache | 1/4 |
| Floor (client limitation) | ~1/4 |

---

## 5. Bug Report

### HIGH

#### #1 — Implicit global + broken `thread_ts` in `notify` case
**File:** `routes/slackActions.js` · `case "notify"`  
`jobData` is assigned without `let`/`const`/`var` — implicit global in sloppy mode. If `JSON.parse` throws, `jobData` is undefined and the next line throws a TypeError. Additionally, `JSON.stringify(jobData.messageTs)` wraps the timestamp in extra quotes (e.g. `'"1234.5678"'`), which Slack rejects as an invalid `thread_ts`. The first argument to `threadNotify` is the entire serialised job JSON, potentially exceeding Slack's 3000-char button value limit.

#### #2 — `buildJobDetailBlocks` selects non-existent columns from Projects
**File:** `utils/buildJobDetailBlocks.js` · lines 112–124  
`fetchSqlProject` selects `p.equipment_id` and `p.assigned_to` from `Projects`. Neither column exists in production — equipment lives in `ProjectEquipment` and there is no `assigned_to` column. Query throws a SQL error, `buildJobDetailBlocks` returns `null`, and the "View Details" button silently opens nothing for any SQL project.

---

### MEDIUM

#### #3 — RTDB write before `views.open` in `openModal_accept_message`
**File:** `modals/openModal_accept_message.js` · lines 34–72  
Status is written to RTDB (`status: "Accepted"`) before `views.open` is called. The code comment says "Open modal FIRST" but contradicts itself. A slow Firebase write (~500–800ms) plus 3 parallel reads could exhaust Slack's 3-second trigger_id window — status gets set but the user sees no modal.

#### #4 — Full RTDB subtree read in `openModal_supervisor_approval`
**File:** `modals/openModal_supervisor_approval.js` · lines 202–207  
Reads the entire `jobs/Release` tree to find a single job, instead of a targeted path. Slow and expensive as job count grows.

#### #5 — Typo: `data.Orderedby` instead of `data.orderedBy`
**File:** `utils/notifyChannel.js` · line 54  
Every channel notification shows "New job submitted by **undefined**" in the plain-text fallback field — used by push notifications, screen readers, and unfurl previews.

#### #6 — Module-level date/time initialization (stale dates in modals)
**Files:** `openModal_accept.js`, `openModal_accept_message.js`, `openModal_assign_dispatch.js`, `openModal_reject.js`, `openModal_submit_training.js`  
`initialDate` and `initialTime` are computed once at module load (cold start), not when the modal opens. On long-running instances, date pickers are pre-filled with yesterday's (or older) date.

#### #7 — Staff dropdown built at require-time — stale after SlackUsers cache refresh
**Files:** `modals/openModal_assign_dispatch.js` · lines 31–40, `openModal_submit_training.js` · lines 16–19  
`staffOptions` is built from `maintenanceStaff` at require-time. New staff added after cold start don't appear in the Assign Dispatch or Submit Training dropdowns until the function restarts.

#### #8 — `handleNewTrainRecord` defaults text fields to `[]`
**File:** `services/handlers/handleNewTrainRecord.js` · lines 23–25  
Empty string inputs default to `[]` (array) instead of `""` or `null`. RTDB stores arrays; any downstream code treating these as strings will break or display incorrectly.

#### #9 — `handleRejectForm` hardcodes `Regular` branch
**File:** `services/handlers/handleRejectForm.js` · line 22  
Reads `jobs/Release/Regular/<jobId>` to find the notified supervisor. Daily jobs can also be rejected, but the read finds nothing → supervisor's home is not refreshed after a Daily job rejection.

#### #10 — Redundant end-date validation runs twice for `update_daily` SQL tasks
**File:** `routes/slackActions.js` · lines 136–191  
Both the specialised block and the shared block run end > start date validation independently. In practice only the first `response_action: "errors"` reaches Slack, so UX is correct — but the logic is duplicated and fragile.

---

### LOW

#### #11 — Dead code: `handleOfflineJobForm` + `openModal_offline_job` never wired
**Files:** `services/handlers/handleOfflineJobForm.js`, `modals/openModal_offline_job.js`  
An alternate offline job creation flow (`callback_id: "offlineJob"`) is implemented but never exported or referenced in `slackActions.js`. Unreachable by any user interaction.

#### #12 — `openModal_manage_dispatch` effectively orphaned
**File:** `modals/openModal_manage_dispatch.js`  
Superseded by `openModal_view_dispatch` (paginated, shows review status). Still wired in `slackActions.js` but no surface renders its trigger button.

#### #13 — `generateUniqueJobId` doesn't check Dispatch or Train branches
**File:** `utils/generateUniqueJobId.js` · lines 14–18  
Uniqueness is verified only against Regular and Daily. Concurrent Dispatch/Train submissions could theoretically reuse the same base ID. Probability is low (~1/1.7M) but non-zero.

#### #14 — `openModal_assign_dispatch`: `initial_option` set to raw string
**File:** `modals/openModal_assign_dispatch.js` · line 74  
`initial_option: job.equipmentName || []` — must be an option object `{ text: { type: "plain_text", text: "..." }, value: "..." }`, not a string or array. Slack will reject the modal if `equipmentName` is set.

#### #15 — `serviceAccount.json` checked into repository
**File:** `my-functions/serviceAccount.json`  
Firebase service account key is committed to the repo. If the repository is ever public or the file leaks, it grants full Firebase project access. Should be in environment variables or Secret Manager, and added to `.gitignore`.

#### #16 — `slack_file` image blocks may fail without `files:read` scope
**File:** `modals/openModal_offline_record.js` · lines 178–182  
Issue photo blocks use `{ type: "image", slack_file: { id: fileId } }` which requires `files:read` scope and the file to be accessible to the bot. If scope is absent or the file is from a different context, Slack rejects the block payload and the modal fails to open.
