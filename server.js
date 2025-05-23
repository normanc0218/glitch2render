require('dotenv').config();

const axios = require('axios');
const { App } = require('@slack/bolt');

const signingSecret = process.env['SLACK_SIGNING_SECRET'];
const botToken = process.env['SLACK_BOT_TOKEN'];
const port = process.env.PORT;

const app = new App({
  signingSecret: signingSecret,
  token: botToken,
});

app.message('quote', async ({ message, say }) => {
  try {
    const resp = await axios.get('https://api.quotable.io/random');
    const quote = resp.data.content;
    await say(`Hello, <@${message.user}>, ${quote}`);
  } catch (error) {
    console.error('Failed to fetch quote:', error.message);
    await say('😢 Sorry, I couldn’t fetch a quote right now.');
  }
});

(async () => {
  try {
    await app.start(port); // ✅ This was missing
    console.log(`PORT from env: ${process.env.PORT}`);
    console.log(`⚡️ Bolt app is running on port ${port}`);
  } catch (err) {
    console.error('Error starting Bolt app:', err);
  }
})();
