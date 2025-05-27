require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser'); // Needed to get raw body
const { displayHome } = require('./appHome'); 
const { openModal } = require('./openModal'); // Make sure this file and function exist
const qs = require('qs');
const signVerification = require('./signVerification'); 

const app = express();
const port = process.env.PORT || 12000;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

// Middleware for parsing URL-encoded bodies (Slack sends payloads this way)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Verify Slack signature
// function isVerified(req) {
//   const timestamp = req.headers['x-slack-request-timestamp'];
//   const slackSignature = req.headers['x-slack-signature'];
//   const requestBody = qs.stringify(req.body,{ format:'RFC1738' });
  
//   if (!timestamp || !slackSignature || !requestBody) return false;

//   const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
//   if (timestamp < fiveMinutesAgo) return false;

//   const sigBaseString = `v0:${timestamp}:${requestBody}`;
//   const mySignature = 'v0=' + crypto
//     .createHmac('sha256', SLACK_SIGNING_SECRET)
//     .update(sigBaseString,'utf8')
//     .digest('hex');

//   console.log('timestamp:', timestamp);
//   console.log('slackSignature:', slackSignature);

//   try {
//     return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature));
//   } catch (err) {
//     return false;
//   }
// }

app.post('/slack/events', signVerification, async (req, res) => {
  const { type, challenge, event } = req.body;

  switch (type) {
    case 'url_verification': 
      // Step 1: Respond to Slack URL Verification
      return res.send({challenge});

    case 'event_callback': {
      console.log('✅ Slack request verified');
      if (event.type === 'app_home_opened') {
        await displayHome(event.user);
      }

      return res.sendStatus(200); // Always respond 200 to Slack
    }
    default:
      return res.sendStatus(400);
  }
});
// Slack Actions
app.post('/slack/actions', async (req, res) => {
  try {
    const payload = JSON.parse(req.body.payload);
    const { token, trigger_id, user, actions, type, view } = payload;

    // Always respond immediately
    res.send(); // Sends 200 OK to Slack

    if (type === 'view_submission') {
      console.log(view.state.values.maintenanceStaff);
      const ts = new Date();
      const data = {
        timestamp: ts.toLocaleString('en-US', { timeZone: 'America/New_York' }),
        machineLocation: view.state.values.machineLocation.value,
        Description: view.state.values.Description.value,
        maintenanceStaff: view.state.values.maintenanceStaff.content.selected_options,
        
      };
      await displayHome(user.id, data);
    } else if (actions && actions[0].action_id.match(/add_/)) {
      await openModal(trigger_id);
    }

  } catch (error) {
    console.error('Error processing Slack action:', error);
    // Cannot send res.status(500) here because res.send() is already sent above
  }
});

// app.post('/slack/actions', async(req, res) => {
//   try{
//   //console.log(JSON.parse(req.body.payload));
//   const { token, trigger_id, user, actions, type } = JSON.parse(req.body.payload);
//   res.send(); // Responds with 200 OK
//   // Button with "add_" action_id clicked --
//   if(actions && actions[0].action_id.match(/add_/)) {
//     // Open a modal window with forms to be submitted by a user
//     openModal(trigger_id);
//   } 
//   // Modal forms submitted --
//   else if(type === 'view_submission') {
//     const ts = new Date();
//     const { user, view } = JSON.parse(req.body.payload);
//     const data = {
//       timestamp: ts.toLocaleString('en-US', { timeZone: 'America/New_York' }),
//       note: view.state.values.note01.content.value,
//       color: view.state.values.note02.color.selected_option.value
//     }
//     await displayHome(user.id, data);
//   };
//     } catch (error) {
//         // Log and respond with an error message if something goes wrong
//         console.error('Error processing Slack action:', error);
//         res.status(500).send('Internal Server Error');
//       }
//   });


app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
