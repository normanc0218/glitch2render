// modals/open_manage_dispatch_modal.js
const axios = require("axios");
const qs = require("qs");
const db = require("../db");
const { getPool } = require("../db-sql");

async function getPromotedDispatchIds() {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT source_rtdb_job_id FROM Projects WHERE source_rtdb_job_id IS NOT NULL`
    );
    return new Set(r.recordset.map(row => row.source_rtdb_job_id));
  } catch { return new Set(); }
}

/**
 * 📦 打开 Manage Dispatch Modal
 * 从 Firebase 读取所有派工任务并显示在 Slack Modal
 */
const openModal_view_dispatch  = async (trigger_id) => {
  try {
    // 1️⃣ 从 Firebase 获取派工任务 + 已提升到项目的ID
    const [snapshot, promotedIds] = await Promise.all([
      db.ref("jobs/Dispatch").once("value"),
      getPromotedDispatchIds(),
    ]);
    const dispatchJobs = snapshot.val() || {};

    // 2️⃣ 排除已在 Web 端 Job Review Panel 中提升为项目的派工，按日期排序
    const jobList = Object.entries(dispatchJobs)
      .filter(([jobId]) => !promotedIds.has(jobId))
      .sort((a, b) => new Date(b[1].dispatchDatetime || 0) - new Date(a[1].dispatchDatetime || 0))
      .slice(0, 20); // 只取前20条

    // 3️⃣ 生成 Slack blocks
    const blocks = [];

    if (jobList.length === 0) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: "_No Dispatch Jobs found._" },
      });
    } else {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: "*📦 Dispatch Job List (Recent 20)*" },
      });
      blocks.push({ type: "divider" });

      for (const [jobId, job] of jobList) {
        const emoji =
          job.status?.toLowerCase().includes("complete") ||
          job.status?.toLowerCase().includes("approved")
            ? "✅"
            : "🕓";

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${emoji} *${job.description || "Untitled Job"}*\n📍 ${
              job.equipmentName || "N/A"
            }\n🧑 ${job.assignedTo || "Unassigned"} • 🗓 ${
              job.dispatchDatetime?.slice(0, 10) || "N/A"
            }\n⚙️ Status: ${job.status || "Pending"}`,
          },
          accessory: {
            type: "button",
            text: { type: "plain_text", text: "View Detail" },
            style: "primary",
            value: jobId, // 把 jobId 传给详情 modal
            action_id: "openModal_viewDetail",
          },
        },{
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Delete" },
              style: "danger",
              value: jobId,
              action_id: "delete_dispatch",
              confirm: {
                title: { type: "plain_text", text: "Confirm delete" },
                text: { type: "mrkdwn", text: "Are you sure you want to delete this dispatch?" },
                confirm: { type: "plain_text", text: "Yes, delete" },
                deny: { type: "plain_text", text: "Cancel" },
              },
            },
          ],
        });

        blocks.push({ type: "divider" });
      }
    }

    // 4️⃣ 构建 Slack Modal
    const modal = {
      type: "modal",
      callback_id: "viewDispatch",
      title: { type: "plain_text", text: "📦 View Dispatch Jobs" },
      close: { type: "plain_text", text: "Close" },
      blocks,
    };

    // 5️⃣ 打开 Slack Modal
    const args = {
      token: process.env.SLACK_BOT_TOKEN,
      trigger_id,
      view: JSON.stringify(modal),
    };

    const result = await axios.post("https://slack.com/api/views.open", qs.stringify(args));
    if (!result.data.ok) {
      console.error("❌ Slack API Error:", result.data);
    } else {
      console.log("✅ Manage Dispatch modal opened successfully");
    }
  } catch (err) {
    console.error("❌ Failed to open Manage Dispatch modal:", err);
  }
};

module.exports = openModal_view_dispatch;
