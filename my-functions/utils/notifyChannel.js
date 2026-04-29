const axios = require("axios");



async function notifyNewOrder(data, jobId) {
  let assignedDisplay = "";
  console.log(data);
  // TRAIN job → 使用 traineeName
  if (jobId.startsWith("TRAIN")) {
    assignedDisplay = data.traineeName;
  }
  // regular job → assignedTo 是数组
  else {
    assignedDisplay = Array.isArray(data.assignedTo)
      ? data.assignedTo.join(", ")
      : data.assignedTo;
  }

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📋 *New Maintenance Job Submitted and Assigned To ${assignedDisplay}*
  *Job ID:* ${jobId}
  *Ordered by:* ${data.orderedBy}
  *Location:* ${data.machineLocation}
  *Description:* ${data.description}`,
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
          action_id: "openModal_viewDetail_home",
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
        text: `New job submitted by ${data.Orderedby}`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (res.data.ok) {
      return String(res.data.ts); // ✅ Return the message timestamp
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

