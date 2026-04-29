// services/firebaseService.js
const db = require("../db");
const axios = require("axios");

/**
 * ✅ 从路径获取全部数据
 */
async function getAll(path) {
  const snapshot = await db.ref(path).once("value");
  return snapshot.val() || {};
}

/**
 * ✅ 更新或新建一条记录（jobId 作为父层 key）
 */
async function saveJob(basePath, data) {
  const { jobId, ...payload } = data;
  await db.ref(`${basePath}/${jobId}`).set(payload);
}

async function saveJobSmart(jobId, data, notify=false, msg= '') {
  // 并行读三条精准路径，找 jobId 在哪个子类
  const [rSnap, dSnap, pSnap] = await Promise.all([
    db.ref(`jobs/Release/Regular/${jobId}`).once("value"),
    db.ref(`jobs/Release/Daily/${jobId}`).once("value"),
    db.ref(`jobs/Release/Project/${jobId}`).once("value"),
  ]);

  const found = [
    { snap: rSnap, category: "Regular" },
    { snap: dSnap, category: "Daily" },
    { snap: pSnap, category: "Project" },
  ].find(({ snap }) => snap.exists());

  const targetPath = found
    ? `jobs/Release/${found.category}/${jobId}`
    : `jobs/Release/Regular/${jobId}`;

  await db.ref(targetPath).update(data);
  console.log(`✅ Job saved to ${targetPath}`);

  if (notify === true) {
    const entrySnapshot = await db.ref(targetPath).once("value");
    const entryData = entrySnapshot.val() || {};
    await threadNotify(jobId, msg, entryData.messageTs);
  }
}

async function threadNotify(jobId, message, threadTs = null, delayInSeconds = null) {
  try {
    let url = "https://slack.com/api/chat.postMessage";
    const payload = {
      channel: process.env.SLACK_NOTIFICATION_CHANNEL_ID,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: message,
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
      ],
    };

    if (threadTs) {
      payload.thread_ts = threadTs;
    }

    if (delayInSeconds) {
      payload.post_at = Math.floor(Date.now() / 1000) + delayInSeconds;
      url = "https://slack.com/api/chat.scheduleMessage";
    }

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.data.ok) {
      console.error("Slack API error:", response.data);
    } else {
      return response.data; // return full Slack response (includes ts or scheduled_message_id)
    }
  } catch (error) {
    console.error("Failed to send Slack notification:", error.response?.data || error.message);
  }
}


async function notifyNewOrder(data, jobId) {
  let assignedDisplay = "";
  // console.log(data);
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



async function findJobById(jobId) {
  let snap;

  if (jobId.startsWith("PRJ")) {
    snap = await db.ref(`jobs/Release/Project/${jobId}`).once("value");
    if (snap.exists()) return { id: jobId, category: "Release", subType: "Project", ...snap.val() };
  } else if (jobId.startsWith("DSP")) {
    snap = await db.ref(`jobs/Dispatch/${jobId}`).once("value");
    if (snap.exists()) return { id: jobId, category: "Dispatch", subType: null, ...snap.val() };
  } else if (jobId.startsWith("SCH")) {
    snap = await db.ref(`jobs/Schedule/${jobId}`).once("value");
    if (snap.exists()) return { id: jobId, category: "Schedule", subType: null, ...snap.val() };
  } else if (jobId.startsWith("TRAIN")) {
    snap = await db.ref(`jobs/Train/${jobId}`).once("value");
    if (snap.exists()) return { id: jobId, category: "Train", subType: null, ...snap.val() };
  } else {
    // JOB- 前缀：Regular 和 Daily 并行查
    const [rSnap, dSnap] = await Promise.all([
      db.ref(`jobs/Release/Regular/${jobId}`).once("value"),
      db.ref(`jobs/Release/Daily/${jobId}`).once("value"),
    ]);
    if (rSnap.exists()) return { id: jobId, category: "Release", subType: "Regular", ...rSnap.val() };
    if (dSnap.exists()) return { id: jobId, category: "Release", subType: "Daily", ...dSnap.val() };
  }

  return null;
}

module.exports = {
  threadNotify,
  notifyNewOrder,
  saveJob,
  saveJobSmart,
  findJobById,
};
