'use strict';

// Logs duration + result of every outbound Slack Web API call (event="slack_api").
//
// Two call paths exist in this codebase and both are covered:
//   - @slack/web-api WebClient (18 instances across modals/services)
//   - raw axios.post("https://slack.com/api/views.open", ...) in several modals
//
// Slack returns HTTP 200 with { ok: false, error } on failure, and many call sites
// swallow that, so errors like expired_trigger_id (user clicked, modal never
// appeared because the 3s trigger window passed) are otherwise invisible.
//
// MUST be required before any module that constructs a WebClient: WebClient binds
// its methods (views.open etc.) to this.apiCall in its constructor.

const { WebClient } = require('@slack/web-api');
const axios = require('axios');

const SLACK_API_PREFIX = 'https://slack.com/api/';
let installed = false;

function logCall(method, ms, ok, error) {
  console.log(JSON.stringify({
    event: 'slack_api',
    method,
    ms,
    ok,
    error,
    severity: ok ? 'INFO' : 'WARNING',
    ts: Date.now(),
  }));
}

function install() {
  if (installed) return;
  installed = true;

  const origApiCall = WebClient.prototype.apiCall;
  WebClient.prototype.apiCall = async function (method, options) {
    const t0 = Date.now();
    try {
      const result = await origApiCall.call(this, method, options);
      logCall(method, Date.now() - t0, true);
      return result;
    } catch (e) {
      logCall(method, Date.now() - t0, false, e.data?.error || e.code || e.message);
      throw e;
    }
  };

  axios.interceptors.request.use((config) => {
    if (config.url?.startsWith(SLACK_API_PREFIX)) config.metadata = { t0: Date.now() };
    return config;
  });
  axios.interceptors.response.use(
    (response) => {
      const { config, data } = response;
      if (config.metadata) {
        const method = config.url.slice(SLACK_API_PREFIX.length);
        logCall(method, Date.now() - config.metadata.t0, data?.ok !== false, data?.error);
      }
      return response;
    },
    (err) => {
      const config = err.config;
      if (config?.metadata) {
        const method = config.url.slice(SLACK_API_PREFIX.length);
        logCall(method, Date.now() - config.metadata.t0, false, err.code || err.message);
      }
      return Promise.reject(err);
    }
  );
}

module.exports = { install };
