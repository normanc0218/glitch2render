'use strict';

// Per-request latency logging for the Slack routes.
//
// Every route acks Slack early (res.send) and keeps working afterwards, so two
// durations are logged:
//   ackMs   — until the HTTP response is sent. Slack needs this < 3000ms or it
//             retries (events) / shows the user an error (actions).
//   totalMs — until the handler's promise settles (includes post-ack work such
//             as views.open / views.publish).
// retryNum is set when Slack re-sent the request because an earlier ack was late
// — the most direct server-side signal that a user waited too long.
//
// One JSON line per request → Cloud Logging log-based metrics (event="slack_request").

const SLOW_ACK_MS = 2500;

function parsePayload(body) {
  if (!body) return null;
  if (typeof body.payload === 'string') {
    try { return JSON.parse(body.payload); } catch { return null; }
  }
  return body.payload || null;
}

// What was clicked/submitted — the dimension latency gets grouped by.
function describe(route, body) {
  if (route === 'events') {
    return { type: body?.type, key: body?.event?.type, userId: body?.event?.user };
  }
  if (body?.command) {
    return { type: 'slash_command', key: body.command, userId: body.user_id };
  }
  const p = parsePayload(body);
  if (!p) return { type: 'unknown' };
  const key =
    p.actions?.[0]?.action_id ||
    p.view?.callback_id ||
    p.action_id ||            // block_suggestion (options route)
    p.callback_id;
  return { type: p.type, key, userId: p.user?.id };
}

function timed(route, handler, log = defaultLog) {
  return async (req, res, next) => {
    const t0 = Date.now();
    const slackTs = Number(req.headers['x-slack-request-timestamp']);
    let ackMs = null;
    res.once('finish', () => { ackMs = Date.now() - t0; });

    let error = null;
    try {
      await handler(req, res, next);
    } catch (e) {
      error = e;
    }

    const totalMs = Date.now() - t0;
    const retryNum = req.headers['x-slack-retry-num'];
    const entry = {
      route,
      ...describe(route, req.body),
      status: res.statusCode,
      ackMs,
      totalMs,
      // Seconds-resolution header → ±1000ms; only useful for spotting large delays.
      lagMs: slackTs ? t0 - slackTs * 1000 : null,
      retryNum: retryNum ? Number(retryNum) : undefined,
      retryReason: req.headers['x-slack-retry-reason'],
      error: error?.message,
    };
    const slow = error || entry.retryNum || ackMs === null || ackMs > SLOW_ACK_MS;
    log({ ...entry, severity: slow ? 'WARNING' : 'INFO' });

    if (error) throw error;
  };
}

function defaultLog(entry) {
  console.log(JSON.stringify({ event: 'slack_request', ...entry, ts: Date.now() }));
}

module.exports = { timed, describe, SLOW_ACK_MS };
