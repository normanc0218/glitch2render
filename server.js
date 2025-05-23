require('dotenv').config();
const axios = require('axios');
const { App } = require('@slack/bolt');

// 校验环境变量
const signingSecret = process.env.SLACK_SIGNING_SECRET;
const botToken = process.env.SLACK_BOT_TOKEN;
const port = process.env.PORT || 12000;

if (!botToken || !signingSecret) {
  throw new Error('Missing SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET in .env file');
}

// 初始化 app
const app = new App({
  signingSecret,
  token: botToken,
});

// 注册监听器（应该在 start() 之前）
app.message('quote', async ({ message, say }) => {
  try {
    await say(`Hello, <@${message.user}>! Here's a quote:\n>`);
  } catch (error) {
    console.error('Failed to fetch quote:', error.message);
    await say('😢 Sorry, I couldn’t fetch a quote right now.');
  }
});

// 启动 app
(async () => {
  await app.start(port);
  console.log(`⚡️ Bolt app is running on port ${port}!`);
})();
