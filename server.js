
const express = require('express')
const app = express()
const appHome =require('')
const port = 12000
app.post('/slack/events', async(req, res) => {
  switch (req.body.type) {
    case 'url_verification': {
      // verify Events API endpoint by returning challenge if present
      res.send({ challenge: req.body.challenge });
      break;
    }
    case 'event_callback': {
      // Verify the signing secret
      if (!signature.isVerified(req)) {
        res.sendStatus(404);
        return;
      } 
      // Request is verified --
      else {
        const {type, user, channel, tab, text, subtype} = req.body.event;
        // Triggered when the App Home is opened by a user
        if(type === 'app_home_opened') {
          // Display App Home
          appHome.displayHome(user);
        }
      }
    }
  }
});
// require('dotenv').config();
// const { App } = require('@slack/bolt');

// // Fetch credentials from environment variables
// const signingSecret = process.env['SLACK_SIGNING_SECRET'];
// const botToken = process.env['SLACK_BOT_TOKEN'];

// const port = process.env.PORT || 12000;

// const app = new App({
//   signingSecret: signingSecret,
//   token: botToken,
// });

// // Event listener for 'quote' message
// app.message('quote', async ({ message, say }) => {
//   try {
//     await say(`Hello, <@${message.user}>!`);
//   } catch (error) {
//     console.error('Error responding:', error.message);
//     await say('😢 Sorry, I couldn’t respond right now.');
//   }
// });

// // Start the app with the correct port (Glitch sets this automatically)
// (async () => {
//   try {
//     await app.start(port);
//     console.log(`⚡️ Bolt app is running on port ${port}`);
//   } catch (err) {
//     console.error('Error starting Bolt app:', err);
//   }
// })();