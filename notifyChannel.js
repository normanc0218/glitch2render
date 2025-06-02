const axios = require("axios");

async function notifyChannel(message) {
  try {
    console.log(message);
    console.log(process.env.SLACK_NOTIFICATION_CHANNEL_ID)
    await axios.post("https://slack.com/api/chat.postMessage", {
      channel: process.env.SLACK_NOTIFICATION_CHANNEL_ID,
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

async function notifyNewOrder(orderData) {
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📋 *New Maintenance Job Submitted*\n*Ordered by:* ${orderData.Orderedby}\n*Location:* ${orderData.machineLocation}\n*Description:* ${orderData.Description}`,
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Details",
            emoji: true
          },
          action_id: "view_detail",
        }
      ]
    }
  ];

  await axios.post("https://slack.com/api/chat.postMessage", {
    channel: process.env.SLACK_NOTIFICATION_CHANNEL_ID,
    blocks: blocks,
    text: `New job submitted by ${orderData.Orderedby}`, // fallback text
  }, {
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    }
  });
}

module.exports = { notifyChannel, notifyNewOrder };

