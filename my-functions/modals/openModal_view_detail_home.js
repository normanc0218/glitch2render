const { WebClient } = require("@slack/web-api");
const { buildJobDetailBlocks } = require("../utils/buildJobDetailBlocks");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

const openModal_view_detail_home = async (trigger_id, jobId) => {
  let blocks;
  try {
    blocks = await buildJobDetailBlocks(jobId);
  } catch (err) {
    console.error("❌ Error building job detail blocks:", err.message);
    return;
  }

  if (!blocks) {
    console.error(`⚠️ Job ${jobId} not found.`);
    return;
  }

  try {
    await client.views.open({
      trigger_id,
      view: {
        type: "modal",
        callback_id: "viewDetail",
        title: { type: "plain_text", text: "Job Details" },
        close:  { type: "plain_text", text: "Close" },
        blocks,
      },
    });
  } catch (err) {
    console.error("Error opening view detail modal:", err.message);
  }
};

module.exports = openModal_view_detail_home;
