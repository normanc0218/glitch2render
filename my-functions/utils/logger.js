'use strict';

function log(event, userId, data = {}) {
  console.log(JSON.stringify({ event, userId, ...data, ts: Date.now() }));
}

function err(event, userId, error) {
  console.error(JSON.stringify({
    event,
    userId,
    error: error.message,
    stack: error.stack,
    ts: Date.now(),
  }));
}

module.exports = { log, err };
