require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser'); // Needed to get raw body
const { displayHome } = require('./appHome'); 

const app = express();
const port = process.env.PORT || 12000;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

// Capture raw body before JSON parsing
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString(); // Store raw body for verification
  }
}));

// Verify Slack signature
function isVerified(req) {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const slackSignature = req.headers['x-slack-signature'];

  if (!timestamp || !slackSignature || !req.rawBody) return false;

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (timestamp < fiveMinutesAgo) return false;

  const sigBaseString = `v0:${timestamp}:${req.rawBody}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(sigBaseString)
    .digest('hex');

  console.log('timestamp:', timestamp);
  console.log('slackSignature:', slackSignature);
  console.log('sigBaseString:', sigBaseString);
  console.log('mySignature:', mySignature);

  try {
    return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature));
  } catch (err) {
    return false;
  }
}

app.post('/slack/events', async (req, res) => {
  const { type } = req.body;

  switch (type) {
    case 'url_verification': {
      // Step 1: Respond to Slack URL Verification
      res.send({ challenge: req.body.challenge });
      break;
    }

    case 'event_callback': {
      if (!isVerified(req)) {
        console.log('❌ Slack signature verification failed');
        res.sendStatus(403);
        return;
      }

      console.log('✅ Slack request verified');
      const { event } = req.body;
      if (event.type === 'app_home_opened') {
        await displayHome(event.user);
      }

      res.sendStatus(200); // Always respond 200 to Slack
      break;
    }

    default:
      res.sendStatus(400);
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
