const axios = require('axios');
const qs = require('qs');
const db = require("../db");
const { createDivider } = require("../utils/blockBuilder");

const PAGE_SIZE = 20;

async function fetchFinishedJobs() {
  const categories = ["Regular", "Daily", "Project"];
  const snapshots = await Promise.all(
    categories.map(cat => db.ref(`jobs/Release/${cat}`).once("value"))
  );

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
  return jobList;
}

function buildFinishedView(jobList, page) {
  const totalPages = Math.max(1, Math.ceil(jobList.length / PAGE_SIZE));
  const pageJobs = jobList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const blocks = [];

  if (jobList.length === 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "_No finished jobs found._" } });
  } else {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*📋 Finished Jobs (${jobList.length}) — Page ${page + 1}/${totalPages}*` },
    });
    blocks.push(createDivider());

    for (const job of pageJobs) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${job.id}*\n*${job.description || "Untitled"}*\n📍 ${job.machineLocation || "N/A"}\n🧑 ${job.assignedTo || "Unassigned"} • 🗓 ${job.orderDate || "N/A"}\n⚙️ ${job.status || "N/A"}`,
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

    // 翻页按钮
    const navElements = [];
    if (page > 0) {
      navElements.push({
        type: "button",
        text: { type: "plain_text", text: "◀ Prev" },
        action_id: "finished_prev_page",
        value: String(page - 1),
      });
    }
    if (page < totalPages - 1) {
      navElements.push({
        type: "button",
        text: { type: "plain_text", text: "▶ Next" },
        action_id: "finished_next_page",
        value: String(page + 1),
      });
    }
    if (navElements.length > 0) {
      blocks.push({ type: "actions", elements: navElements });
    }
  }

  return {
    type: "modal",
    callback_id: "view_finished_joblist",
    title: { type: "plain_text", text: "✅ Finished Jobs" },
    close: { type: "plain_text", text: "Close" },
    private_metadata: String(page),
    blocks,
  };
}

const openModal_finished = async (trigger_id) => {
  try {
    // 先开 loading modal（3秒内响应 Slack）
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

    const jobList = await fetchFinishedJobs();

    await axios.post(
      "https://slack.com/api/views.update",
      qs.stringify({
        token: process.env.SLACK_BOT_TOKEN,
        view_id,
        view: JSON.stringify(buildFinishedView(jobList, 0)),
      })
    );

    console.log("✅ Finished Jobs modal opened (page 1)");
  } catch (err) {
    console.error("❌ Failed to open Finished Jobs modal:", err);
  }
};

const updateFinishedPage = async (view_id, page) => {
  try {
    const jobList = await fetchFinishedJobs();
    await axios.post(
      "https://slack.com/api/views.update",
      qs.stringify({
        token: process.env.SLACK_BOT_TOKEN,
        view_id,
        view: JSON.stringify(buildFinishedView(jobList, page)),
      })
    );
    console.log(`✅ Finished Jobs page ${page + 1} loaded`);
  } catch (err) {
    console.error("❌ Failed to update Finished Jobs page:", err);
  }
};

module.exports = { openModal_finished, updateFinishedPage };
