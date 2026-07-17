# Slack Bot — Root Cause Diagnosis & Fix Plan

## Context

Symptoms observed during local ngrok testing:
1. `❌ Error processing Slack action ... An API error occurred: not_found`
2. "Home published | Total: 36024ms" — 30+ second home publishes that gradually warm down
3. DM fallback confirmed firing: "Maintenance form ⚠️ Something went wrong..."

---

## Root Cause A — `not_found` API error

### What it is NOT
- `expired_trigger_id` — Slack returns a *different* error code for expired trigger windows
- `hash_conflict` — concurrent view update collision has its own code
- A cold-start timing issue — `res.send()` fires synchronously at line 236 (before any async work), so the 3-second Slack ack window is always met regardless of cold starts

### What it IS

**Most likely: `notifyNewOrder()` posting to a Slack channel that doesn't exist in the test workspace.**

`handleNewJobForm` calls `notifyNewOrder(data, jobId)` BEFORE `displayHome()`. `notifyNewOrder` posts to a hardcoded production channel ID. In the local ngrok test workspace, that channel doesn't exist → Slack returns `not_found`. This propagates through `handleNewJobForm` (no try/catch around `notifyNewOrder`) and is caught by the top-level `slackActions.js` catch block, which fires the DM fallback.

**Second possibility: `views.update` on a closed modal.**
Handlers for `area`, `machineLine`, `complete_job`, `other_status` etc. call `slackClient.views.update({ view_id: view.id })`. If the user closed the modal before the async update completes → `not_found`.

**Why NOT `displayHome`:** `displayHome()` has its own internal try/catch and does not rethrow. Its errors cannot reach the slackActions catch block.

**Confirmed suspect: `notifyNewOrder`** — the only unguarded async Slack API call in `handleNewJobForm` that uses a channel ID which differs between test and production workspaces.

---

## Root Cause B — 30+ second home publishes

### The hidden timing gap

`displayHome()` measures time like this:

```
startTime = Date.now()                   // line 223 — outer timer starts
await userConfig.refreshIfStale()        // ← FIRST SQL call — NOT captured in any timer
dbStart = Date.now()                     // line 237 — set AFTER refreshIfStale completes
await Promise.all([all 8 DB queries])
log("📊 DB queries: Xms")               // measures ONLY post-pool query time
log("🏗️ View built: Xms")
await client.views.publish()
log("✅ Home published | Total: Xms")
```

**`refreshIfStale()` is the first caller of `getPool()`, but its duration is invisible — it runs before `dbStart` is set and is not captured in "DB queries".** The missing ~30 seconds live entirely inside `refreshIfStale()`. The "Total: 34782ms" vs "DB queries: 4736ms" gap is explained entirely by this hidden call.

### Why `refreshIfStale` takes 30 seconds

Azure SQL serverless tier auto-pauses after 60 minutes of inactivity. When paused:
1. `refreshIfStale()` calls `getPool()` → `poolPromise` is null (reset when pool error fires with `p.size === 0`) → initiates new TCP connection to Azure SQL
2. Azure SQL holds the connection open while resuming — it does NOT refuse immediately — takes 20–60 seconds
3. Connection succeeds when DB is ready; `refreshIfStale()` query completes
4. `dbStart` is now set — pool is already warm
5. `Promise.all` queries finish quickly (the "DB queries" numbers you see: 839ms–4736ms)

### Why totals decrease across concurrent calls

All concurrent `displayHome()` calls share the same `poolPromise` singleton (from `db-sql.js` — it caches the `Promise`, not the pool, so all callers await the same resolution). Calls that started earlier in the resume window blocked for longer → higher totals. As Azure SQL came fully online, later calls' `refreshIfStale()` hit the warm pool immediately.

The pattern: 36024ms → 34782ms → 33881ms → ... → 22812ms → 168ms reflects the Azure SQL resume timeline, not different amounts of work.

### Why SQL timeouts appear mid-sequence

`db-sql.js` sets no explicit `connectionTimeout` — mssql default is **15 seconds**. Azure SQL resume takes **20–60 seconds**. Attempts hitting the 15s wall time out → `poolPromise = null` (pool error handler, `p.size === 0`) → next call retries. The connections that succeeded either had a higher timeout in the connection string, or retried when the DB was closer to ready.

---

## Fixes

### Fix 1 — Expose the hidden pool timing (1 line, `modalService.js`)

Makes the 30-second Azure SQL resume visible in logs instead of being absorbed into "Total":

```js
// before refreshIfStale
const poolStart = Date.now();
await userConfig.refreshIfStale();
console.log(`🔌 Pool/cache ready: ${Date.now() - poolStart}ms`);
```

### Fix 2 — Isolate `notifyNewOrder` to confirm `not_found` source (`handleNewJobForm.js`)

```js
let messageTs;
try {
  messageTs = await notifyNewOrder(data, jobId);
} catch (err) {
  console.error('[handleNewJobForm] notifyNewOrder failed (channel may not exist in this workspace):', err.message);
  throw err; // re-throw so slackActions DMs the user
}
data.messageTs = messageTs;
```

### Fix 3 — Increase connection timeout (`db-sql.js`)

Prevents "operation timed out" mid-sequence. Does not eliminate the 30-second resume time, but stops partial failures:

```js
config.connectionTimeout = 60000; // 60s — survives Azure SQL serverless resume
config.requestTimeout    = 30000;
```

### Fix 4 — Keepalive scheduler (eliminates root cause)

Prevents Azure SQL from ever reaching the auto-pause threshold:

```js
// my-functions/index.js
exports.sqlKeepalive = onSchedule('every 45 minutes', async () => {
  const pool = await getPool();
  await pool.request().query('SELECT 1');
  console.log('💓 SQL keepalive ping');
});
```

---

## Files to modify

| File | Change |
|---|---|
| `my-functions/services/modalService.js` | Fix 1 — `🔌 Pool/cache ready` timer around `refreshIfStale()` |
| `my-functions/services/handlers/handleNewJobForm.js` | Fix 2 — wrap `notifyNewOrder` in try/catch |
| `my-functions/db-sql.js` | Fix 3 — `connectionTimeout: 60000`, `requestTimeout: 30000` |
| `my-functions/index.js` | Fix 4 — `sqlKeepalive` Cloud Scheduler export |

---

## Verification

1. Submit a new job form via ngrok → check logs for `🔌 Pool/cache ready: ~30000ms` (confirms Azure SQL was paused) and `[handleNewJobForm] notifyNewOrder failed` (confirms channel mismatch)
2. After Fix 3: same cold-start test → no more "operation timed out" errors
3. After Fix 4: wait 65+ minutes idle → submit again → `🔌 Pool/cache ready: ~0ms` (DB never paused)
