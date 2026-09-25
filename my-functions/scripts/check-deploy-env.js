#!/usr/bin/env node
// Predeploy guard for the slack-app codebase (wired in root firebase.json).
//
// `firebase deploy` replaces the function's env vars with .env + .env.<projectId>.
// If a required var is missing there, prod loses it on deploy — this happened on
// 2026-09-25 (SLACK_BOT_TOKEN dropped → every modal failed). Fail the deploy instead.

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const REQUIRED = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'SLACK_NOTIFICATION_CHANNEL_ID',
  'DATABASE_URL',
  'SQL_CONNECTION_STRING',
  'SQL_USERNAME',
  'SQL_PASSWORD',
];

const dir = path.resolve(__dirname, '..');
const project = process.env.GCLOUD_PROJECT;
if (!project) {
  console.error('check-deploy-env: GCLOUD_PROJECT not set — run via `firebase deploy --project <id>`.');
  process.exit(1);
}

function load(file) {
  const p = path.join(dir, file);
  return fs.existsSync(p) ? dotenv.parse(fs.readFileSync(p)) : {};
}

// Same precedence as the Firebase CLI: .env.<project> overrides .env
const env = { ...load('.env'), ...load(`.env.${project}`) };

const problems = REQUIRED.filter((k) => !env[k]).map((k) => `missing ${k}`);
if (env.NODE_ENV === 'development') {
  problems.push('NODE_ENV=development would disable Slack signature verification in prod');
}

if (problems.length) {
  console.error(`check-deploy-env: refusing to deploy slack-app to ${project}:`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`Fix my-functions/.env.${project} (values: Cloud Run → slackhandler → last good revision).`);
  process.exit(1);
}
console.log(`check-deploy-env: OK for ${project} (${REQUIRED.length} required vars present).`);
