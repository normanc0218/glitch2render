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
  const all = await getAll(basePath);
  let existingKey = null;

  for (const [key, job] of Object.entries(all)) {
    if (job.jobId === data.jobId) {
      existingKey = key;
      break;
    }
  }

  const jobKey = existingKey || data.jobId;
  const { jobId, ...payload } = data;
  const fullPath = `${basePath}/${jobKey}`;

  // ✅ Admin SDK 写法（不再需要 getDatabase/ref/set）
  await db.ref(fullPath).set(payload);
}

async function saveJobSmart(jobId, data, notify=false, msg= '') {
  const jobsRef = db.ref("jobs/Release");
  let targetPath = null;
  let targetEntry =null;

  // 1️⃣ 读取 jobs/Release 下所有分支
  const snapshot = await jobsRef.once("value");
  const releaseData = snapshot.val() || {};

  // 2️⃣ 遍历子层（Daily, Project, Regular...）
  for (const [category, jobs] of Object.entries(releaseData)) {
    if (jobs && typeof jobs === "object" && jobId in jobs) {
      targetPath = `jobs/Release/${category}/${jobId}`;
      targetEntry=db.ref(targetPath);
      break;
    }
  }

  // 3️⃣ 如果没找到，就写到 Regular
  if (!targetPath) {
    targetPath = `jobs/Release/Regular/${jobId}`;
  }

  // 4️⃣ 保存
  await db.ref(targetPath).update(data);
  console.log(`✅ Job saved to ${targetPath}`);
  if (notify === true) {
    const entrySnapshot = await targetEntry.once("value");
    const entryData = entrySnapshot.val() || {};
    // console.log(entryData);
    await threadNotify (jobId, msg,entryData .messageTs)
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



module.exports = {
  threadNotify,
  notifyNewOrder,
  saveJob,
  saveJobSmart
};
