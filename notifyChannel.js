const axios = require("axios");

async function threadNotify(message, threadTs = null) {
  try {
    const payload = {
      channel: process.env.SLACK_NOTIFICATION_CHANNEL_ID,
      text: message,
    };

    // Add thread_ts if replying to a thread
    if (threadTs) {
      payload.thread_ts = threadTs;
    }

    const response = await axios.post("https://slack.com/api/chat.postMessage", payload, {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.data.ok) {
      console.error("Slack API error:", response.data);
    }
  } catch (error) {
    console.error("Failed to send Slack notification:", error.response?.data || error.message);
  }
}

async function notifyNewOrder(orderData, jobId) {
  // const mentions = orderData.mStaff_id.map(id => `<@${id}>`).join(" and ");
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📋 *New Maintenance Job Submitted and Assigned To  * \n*Job ID:* ${jobId}\n*Ordered by:* ${orderData.Orderedby}\n*Location:* ${orderData.machineLocation}\n*Description:* ${orderData.Description}`,
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

  try {
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
      return res.data.ts; // ✅ Return the message timestamp
    } else {
      console.error("Slack API error:", res.data.error);
      return null;
    }
  } catch (err) {
    console.error("Error sending Slack notification:", err);
    return null;
  }
}

module.exports = { notifyNewOrder };

