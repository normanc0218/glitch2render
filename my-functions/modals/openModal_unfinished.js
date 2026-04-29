const axios = require('axios');
const qs = require('qs');
const db = require("../db");

const {createTextSection, 
       createInputBlock,               //block_id, label, action_id, placeholder
	     createMultiInputBlock,
       createInputBlock_multistatic,   //block_id, label, action_id, placeholder, options
       createInputBlock_pic,           //block_id, label, action_id
       createInputBlock_date,          //block_id, label, action_id, initial_date
       createInputBlock_time,          //block_id, label, action_id, initial_time
       createInputBlock_select,
       createButton,        //block_id, label, action_id, options 
       createDivider } = require("../utils/blockBuilder");

const nyDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date()); // e.g. "2025-05-28"
const [month, day, year] = nyDate.split('/');
const initialDate = `${year}-${month}-${day}`;
function getNYTimeString() {
  const d = new Date();
  const ny = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hh = ny.getHours().toString().padStart(2, '0');
  const mm = ny.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
};
const initialTime = getNYTimeString();
const { maintenanceStaff, managerUsers } = require('../userConfig');

const openModal_unfinished = async (trigger_id) => {
  try {
    // 1️⃣ 从 Firebase 获取派工任务
    const snapshot = await db.ref("jobs/Release").once("value");
    const allJobs = snapshot.val() || {};
   
    // ✅ 转成数组 + 过滤掉已完成的任务
    const jobList = Object.entries(allJobs)
      .flatMap(([category, jobs]) => 
        Object.entries(jobs).map(([id, job]) => ({ id, ...job }))
      )
      .filter(job =>
        job.status &&
        !job.status.toLowerCase().includes("complete") &&
        !job.status.toLowerCase().includes("checked")
      );
    // console.log(jobList,allJobs);
    // 3️⃣ 生成 Slack blocks
    const blocks = [];

    if (jobList.length === 0) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: "_No unfinished jobs found._" },
      });
    } else {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: "*📋 Unfinished Jobs List*" },
      });
      blocks.push(createDivider());

      for (const job of jobList) {
        // 👇 根据状态设置 emoji
        const emoji =
          job.status?.toLowerCase().includes("pending") ? "🕓" : "⚙️";

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${job.id || "Untitled Job"}*\n${emoji} *${job.description || "Untitled Job"}*\n📍 ${
              job.machineLocation|| "N/A"
            }\n🧑 ${job.assignedTo || "Unassigned"} • 🗓 ${
              job.orderDate || "N/A"
            }\n⚙️ Status: ${job.status || "Pending"}`,
          },
          accessory: {
            type: "button",
            text: { type: "plain_text", text: "View Detail" },
            style: "primary",
            value: job.id,
            action_id: "openModal_viewDetail",
          },
        });
      if (job.status!=="Rejected"){
        blocks.push(createButton("🔔 Notify", JSON.stringify(job), "notify"));
      }
        blocks.push(createDivider());
      }
    }

    // 4️⃣ 构建 Slack Modal
    const modal = {
      type: "modal",
      callback_id: "view_unfinished_joblist",
      title: { type: "plain_text", text: "📦 View Unfinished Jobs" },
      close: { type: "plain_text", text: "Close" },
      blocks,
    };

    // 5️⃣ 打开 Slack Modal
    const args = {
      token: process.env.SLACK_BOT_TOKEN,
      trigger_id,
      view: JSON.stringify(modal),
    };

    const result = await axios.post(
      "https://slack.com/api/views.open",
      qs.stringify(args)
    );

    if (!result.data.ok) {
      console.error("❌ Slack API Error:", result.data);
    } else {
      console.log("✅ Unfinished Jobs modal opened successfully");
    }
  } catch (err) {
    console.error("❌ Failed to open Unfinished Jobs modal:", err);
  }
};

module.exports = openModal_unfinished;