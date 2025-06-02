const axios = require("axios");

async function notifyChannel(message) {
  try {
    console.log(message);
    console.log(process.env.SLACK_NOTIFICATION_CHANNEL)
    await axios.post("https://slack.com/api/chat.postMessage", {
      channel: process.env.SLACK_NOTIFICATION_CHANNEL,
      text: message,
    }, {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      }
    });
  } catch (error) {
    console.error("Failed to send Slack notification:", error.response?.data || error.message);
  }
}

module.exports = { notifyChannel };