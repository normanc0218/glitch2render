# Add a test framework to slack-firebase + incrementally extract testable logic

## Context

The user is treating `slack-firebase` as a long-term-maintained project (more features coming) and wants it to have a clear test framework, the way they're pushing `interact_schedule` toward shared/tested code. `my-functions/package.json`'s `test` script is currently a no-op placeholder (`echo 'No tests yet' && exit 0`) — zero tests exist today, even though CI (`.github/workflows/deploy.yml`) already gates `deploy` on a `test` job, so it's currently a rubber stamp.

**Correction surfaced during research:** the `interact_schedule` "shared router + validators, thin shells" refactor the user described as a precedent has not actually landed — `functions/shared/validators.js` exists but is untracked in git and wired into neither `functions/apiApp.js` nor `dev-server/server.js`, both of which remain full ~2000-line duplicated monoliths. So there's no proven pattern there to copy yet. This doesn't change the recommendation below, since `slack-firebase`'s problem shape is different anyway (see next paragraph) — noted so the user knows the premise, not to block on it.

**Why "shared router" doesn't apply here:** interact_schedule's pain is two independently-deployed backends (`functions/` vs `dev-server/`) that must be hand-kept-in-sync. `slack-firebase`'s `my-functions/` is a single deployed Express app — there's no duplicate-backend problem to solve. The actual gap is simpler: **no tests exist, and business logic is inconsistently interleaved with I/O**, which is what blocks writing them.

**Encouraging finding:** a pure/impure split already exists in part of this codebase and works well — `utils/blockBuilder.js` (fully pure Block Kit factory), `utils/buildJobDetailBlocks.js` (`fetchSqlTask`/`fetchSqlProject` I/O cleanly separated from `buildSqlTaskBlocks`/`buildSqlProjectBlocks`/`buildRtdbBlocks` pure builders), `utils/orderModalBuilder.js`, and `modals/openModal_update_progress.js` (`buildUpdateProgressModal` pure vs `openModal_update_progress` impure, already reused by `slackActions.js:358-401` for zero-I/O modal updates). The plan is to extend this existing pattern, not introduce a new one.

## Approach

### 1. Stand up the test framework (do first — unblocks everything else)

- Add `vitest` + `supertest` as devDependencies in `my-functions/package.json`, matching the sibling stack already used in `interact_schedule/dev-server` and `interact_schedule/frontend` — confirmed to fit: `my-functions` is a plain CommonJS Express app, same runtime shape as `dev-server`.
- **Enabling one-liner**: `my-functions/index.js` currently exports only `slackHandler` (the `onRequest(...)`-wrapped Cloud Function). Change to also export the raw `app`: `module.exports = { app, slackHandler }`. This lets supertest hit routes directly without going through Cloud Functions v2/functions-framework wrapping.
- Set `NODE_ENV=test` (or reuse the existing `NODE_ENV=development` bypass) in test setup so `verifySlackSignature.js` skips signature verification, matching how `verifySlackSignature.js:15` already bypasses in development mode.
- Mocking strategy for the three network singletons, all mockable at the module boundary with `vi.mock(...)`:
  - `db-sql.js` (`getPool`/`sql`) — mock directly with canned `recordset` fixtures. **Do not try to reuse `dev-server`'s sql.js mock as-is** — confirmed dialect mismatch (`STRING_AGG`, `TOP N`, `GETDATE()`, typed `sql.UniqueIdentifier`/`sql.DateTime2` params used throughout `db-sql.js` call sites aren't valid SQLite). The dev-server schema is reusable as reference for shaping fixtures, but query execution should be mocked, not ported.
  - `db.js` (Firebase RTDB, connects eagerly on `require`) — mock with `vi.mock('../db')`.
  - `@slack/web-api`'s `WebClient` — mock with `vi.mock('@slack/web-api')`.

### 2. First tests — the already-pure layer, zero refactor needed

Write unit tests for what's testable today with no code changes, to establish the pattern/style for future tests in this repo:
- `utils/blockBuilder.js` — every exported function
- `utils/orderModalBuilder.js` — `buildOrderModalView`/`buildCascadeBlocks`
- `utils/buildJobDetailBlocks.js` — `buildSqlTaskBlocks`/`buildSqlProjectBlocks`/`buildRtdbBlocks`
- `modals/openModal_update_progress.js` — `buildUpdateProgressModal`
- `modals/openModal_jobList.js` — `buildJobBlock`/`buildJobListView`
- `utils/verifySlackSignature.js` — the whole middleware (feed fake `req`/`res`/`next`, easy to hit both the valid- and invalid-signature branches)

### 3. Extend the pure/impure split into the biggest coupling hotspots

Apply the same fetch/build (or extract/persist) separation already proven elsewhere, targeting the worst offenders found:
- `services/handlers/handleUpdateProgress.js` (`handleSqlTaskUpdate`, `handleProjectUpdate`) — extract pure `computeTaskUpdate(vals)`/`computeProjectUpdate(vals)` returning `{status, actualStart, actualEnd, ...}`, so the status-transition decision is unit-testable without a DB.
- `services/modalService.js`'s `displayHome` (~320 lines, 8 parallel DB fetches interleaved with all of App Home's Block Kit rendering) — extract a pure `buildHomeBlocks({roles, release, azureProjects, azureTasks, ...})`, mirroring `buildJobDetailBlocks.js`'s existing split.
- `routes/slackActions.js` lines 84-211 (the pre-ack validation blocks, including the `review` block we just fixed) — hoist into `services/validation.js` as named pure functions (e.g. `validateReviewCheckDatetime(view, viewMeta)` → `{ok, errors}`), testable in isolation and reusable if similar validation is needed elsewhere.
- `routes/slackActions.js` lines 509-611 (`sql_task_review`, `sql_task_check` cases) — currently the only two `view_submission` cases with raw `pool.request()` calls inlined directly in the switch statement, unlike every sibling case. Move into `services/handlers/`, matching the existing convention, before trying to test them.

### 4. Duplication worth cleaning up alongside this (secondary, not blocking)

- **Real bug found, worth a standalone fix regardless of the testing work**: `utils/notifyChannel.js`'s `notifyNewOrder` (line 54) reads `data.Orderedby` (wrong casing) while the near-duplicate `services/firebaseService.js`'s `notifyNewOrder` (line 156) correctly reads `data.orderedBy` — the former is always `undefined`. Two independent copies of the same function have drifted; fix the bug and consider consolidating to one.
- `UUID_RE` (the SQL-vs-RTDB job-id discriminator regex) is copy-pasted in 5+ files (`slackActions.js:90`, `openModal_supervisor_approval.js:14`, `handleReview.js:7`, `handleUpdateProgress.js:9`, `buildJobDetailBlocks.js:5`) — a domain invariant that should live in one shared module.
- `fmtDate`/`fmtTime`/`toPhotoArray` reinvented independently in 5+ files — candidate for a shared `utils/format.js`.
- `handleNewJobForm.js`/`handleNewDispatchForm.js` — near-byte-for-byte duplicated field-extraction logic (only jobId prefix/target path differ).

These aren't required to add tests, but centralizing them makes the extracted pure functions in step 3 easier to write once instead of per-file, and removes a class of drift bugs like the one just found.

## Verification

- `cd my-functions && npm test` runs vitest; confirm the new tests pass and nothing in the existing (untouched) route handlers breaks.
- For the extracted-function refactors (step 3), manually re-verify via the same ngrok+local-dev loop used for the earlier `review`-path fix (no behavior should change, only where the logic lives) — trigger the affected flows once each (task update, project update, app home open) and confirm identical behavior to before.
- CI's existing `test` job (`deploy.yml`, `needs: test`) will now actually gate deploys instead of rubber-stamping — no CI config changes needed, just confirm the workflow still passes once real tests exist.

## Files touched
- `my-functions/package.json` — add vitest/supertest devDependencies, real `test` script
- `my-functions/index.js` — export `app` alongside `slackHandler`
- New: `my-functions/__tests__/` (or colocated `*.test.js`, matching whichever convention `interact_schedule/dev-server/__tests__/` uses) for the step-2 pure-function tests
- `services/handlers/handleUpdateProgress.js`, `services/modalService.js`, `routes/slackActions.js` — extract pure functions per step 3 (mechanical extraction, no behavior change)
- `utils/notifyChannel.js` — fix the `Orderedby`/`orderedBy` casing bug
