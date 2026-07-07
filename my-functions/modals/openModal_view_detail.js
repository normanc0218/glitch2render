const { WebClient } = require("@slack/web-api");
const { buildJobDetailBlocks } = require("../utils/buildJobDetailBlocks");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

const openModal_view_detail = async (viewId, jobId) => {
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
    await client.views.update({
      view_id: viewId,
      view: {
        type: "modal",
        callback_id: "viewDetail",
        title: { type: "plain_text", text: "Job Details" },
        close:  { type: "plain_text", text: "Close" },
        blocks,
      },
    });
  } catch (err) {
    console.error("Error updating view detail modal:", err.message);
  }
};

module.exports = openModal_view_detail;
