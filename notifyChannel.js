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

async function notifyNewOrder(orderData, jobId) {
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📋 *New Maintenance Job Submitted*\n*Ordered by:* ${orderData.Orderedby}\n*Location:* ${orderData.machineLocation}\n*Description:* ${orderData.Description}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Details",
            emoji: true,
          },
          action_id: "view_detail",
          value: jobId,
        },
      ],
    },
  ];

  const res = await axios.post(
    "https://slack.com/api/chat.postMessage",
    {
      channel: process.env.SLACK_NOTIFICATION_CHANNEL_ID,
      blocks,
      text: `New job submitted by ${orderData.Orderedby}`,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (res.data.ok) {
    const ts = res.data.ts; // Capture timestamp of the message
    return ts;
  } else {
    console.error("Failed to send notification:", res.data);
    return null;
  }
}


module.exports = { notifyChannel, notifyNewOrder };

