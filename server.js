require('dotenv').config();
const { App } = require('@slack/bolt');

// Fetch credentials from environment variables
const signingSecret = process.env['SLACK_SIGNING_SECRET'];
const botToken = process.env['SLACK_BOT_TOKEN'];

// Set up the port for Glitch (Glitch sets PORT automatically, otherwise falls back to 3000)
const port = process.env.PORT || 3000;

const app = new App({
  signingSecret: signingSecret,
  token: botToken,
});

// Event listener for 'quote' message
app.message('quote', async ({ message, say }) => {
  try {
    await say(`Hello, <@${message.user}>!`);
  } catch (error) {
    console.error('Error responding:', error.message);
    await say('😢 Sorry, I couldn’t respond right now.');
  }
});

// Start the app with the correct port (Glitch sets this automatically)
(async () => {
  try {
    await app.start(port);
    console.log(`⚡️ Bolt app is running on port ${port}`);
  } catch (err) {
    console.error('Error starting Bolt app:', err);
  }
})();
