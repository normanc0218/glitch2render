// index.js
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const axios = require('axios');
const qs = require('qs');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// Load environment variables
dotenv.config();

// Custom modules
const appHome = require('./appHome');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Signature verification
function isVerified(req) {
  const slackSignature = req.headers['x-slack-signature'];
  const requestBody = JSON.stringify(req.body);
  const timestamp = req.headers['x-slack-request-timestamp'];

  const time = Math.floor(new Date().getTime() / 1000);
  if (Math.abs(time - timestamp) > 300) return false;

  const sigBaseString = `v0:${timestamp}:${requestBody}`;
  const hmac = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET);
  hmac.update(sigBaseString);
  const mySignature = `v0=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature));
}

// Slack Events endpoint
app.post('/slack/events', async (req, res) => {
  const { type, event, challenge } = req.body;

  if (type === 'url_verification') {
    return res.send({ challenge });
  }

  if (type === 'event_callback') {
    if (!isVerified(req)) return res.sendStatus(404);

    if (event && event.type === 'app_home_opened') {
      await appHome.displayHome(event.user);
    }

    res.sendStatus(200);
  }
});

// Slack Interactions endpoint
app.post('/slack/actions', async (req, res) => {
  const payload = JSON.parse(req.body.payload);
  const { trigger_id, user, actions, type, view } = payload;

  if (actions && actions[0].action_id.match(/add_/)) {
    await appHome.openModal(trigger_id);
    return res.send('');
  }

  if (type === 'view_submission') {
    const ts = new Date();
    const data = {
      timestamp: ts.toLocaleString(),
      note: view.state.values.note01.content.value,
      color: view.state.values.note02.color.selected_option.value
    };
    await appHome.displayHome(user.id, data);
    return res.send('');
  }
});

app.listen(PORT, () => {
  console.log(`Slack app listening on port ${PORT}`);
});
