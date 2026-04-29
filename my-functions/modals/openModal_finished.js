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
       createInputBlock_select,        //block_id, label, action_id, options 
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

const openModal_finished = async (trigger_id) => {
  try {
    // 1️⃣ 先开 loading modal（3秒内响应 Slack）
    const loadingResult = await axios.post(
      "https://slack.com/api/views.open",
      qs.stringify({
        token: process.env.SLACK_BOT_TOKEN,
        trigger_id,
        view: JSON.stringify({
          type: "modal",
          callback_id: "view_finished_joblist",
          title: { type: "plain_text", text: "✅ Finished Jobs" },
          close: { type: "plain_text", text: "Close" },
          blocks: [{ type: "section", text: { type: "mrkdwn", text: "⏳ Loading jobs..." } }],
        }),
      })
    );

    const view_id = loadingResult.data.view?.id;
    if (!view_id) return;

    // 2️⃣ 并行查三个分类
    const categories = ["Regular", "Daily", "Project"];
    const snapshots = await Promise.all(
      categories.map(cat => db.ref(`jobs/Release/${cat}`).once("value"))
    );

    // 3️⃣ 合并 + 过滤已完成
    const jobList = [];
    snapshots.forEach((snap, i) => {
      const jobs = snap.val() || {};
      Object.entries(jobs).forEach(([id, job]) => {
        const status = (job.status || "").toLowerCase();
        if (status.includes("complete") || status.includes("checked")) {
          jobList.push({ id, category: categories[i], ...job });
        }
      });
    });

    jobList.sort((a, b) => new Date(b.orderDate || 0) - new Date(a.orderDate || 0));

    // 4️⃣ 生成 blocks
    const blocks = [];
    if (jobList.length === 0) {
      blocks.push({ type: "section", text: { type: "mrkdwn", text: "_No finished jobs found._" } });
    } else {
      blocks.push({ type: "section", text: { type: "mrkdwn", text: `*📋 Finished Jobs (${jobList.length})*` } });
      blocks.push(createDivider());

      for (const job of jobList.slice(0, 15)) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${job.id}*\n*${job.description || "Untitled Job"}*\n📍 ${job.machineLocation || "N/A"}\n🧑 ${job.assignedTo || "Unassigned"} • 🗓 ${job.orderDate || "N/A"}\n⚙️ Status: ${job.status || "N/A"}`,
          },
          accessory: {
            type: "button",
            text: { type: "plain_text", text: "View Detail" },
            style: "primary",
            value: job.id,
            action_id: "openModal_viewDetail",
          },
        });
        blocks.push(createDivider());
      }
    }

    // 5️⃣ 用 views.update 替换 loading modal
    await axios.post(
      "https://slack.com/api/views.update",
      qs.stringify({
        token: process.env.SLACK_BOT_TOKEN,
        view_id,
        view: JSON.stringify({
          type: "modal",
          callback_id: "view_finished_joblist",
          title: { type: "plain_text", text: "✅ Finished Jobs" },
          close: { type: "plain_text", text: "Close" },
          blocks,
        }),
      })
    );

    console.log("✅ Finished Jobs modal updated successfully");
  } catch (err) {
    console.error("❌ Failed to open Finished Jobs modal:", err);
  }
};

module.exports = openModal_finished;