const axios = require('axios');
const qs = require('qs');
const db  = require("./db");

const {
  createTextSection,
  createDivider,
  createHeader,
  createImage
} = require('./blockBuilder');

const openModal_view_detail = async(trigger_id, jobId) => {
    const data = await db.getData("/regular").catch(() => []);
    const job = data.find(item => item.jobId === jobId)
    const blocks = [
    createTextSection(`*Job ID:* ${job.jobId}`),
    createTextSection(`*Ordered By:* ${job.Orderedby || "N/A"}\n*Machine Location:* ${job.machineLocation}\n*Finder:* ${job.finder || "N/A"}`),
    createTextSection(`*Description:* ${job.Description}`),
    createTextSection(`*Assigned Staff:* ${Array.isArray(job.maintenanceStaff) ? job.maintenanceStaff.join(", ") : "N/A"}\n*Order Date:* ${job.orderdate}\n*Order Time:* ${job.ordertime}\n*Status:* ${job.status}`),
    createDivider(),
    ];
    if (job.acceptdate || job.accepttime || job.remarks) {
      blocks.push(
        createTextSection(`*Accept Date:* ${job.startDate || "N/A"}\n*Accept Time:* ${job.startTime || "N/A"}\n*Remarks:* ${job.remarks || "None"}`),
        createDivider()
      );
    }
    if (job.rejectdate || job.rejecttime || job.rejectby) {
    blocks.push(
      createTextSection(`*Reject Date:* ${job.rejectdate || "N/A"}\n*Reject Time:* ${job.rejecttime || "N/A"}\n*Reject by:* ${job.rejectby || "None"}\n*Reject reason:* ${job.rejectreason}`),
      createDivider()
    );
    }
    if (job.endDate || job.endTime) {
    blocks.push(
      createTextSection(`*Done By:* ${job.updatedBy || "N/A"}\n*Cause of issue:* ${job.issueCauses || "N/A"}\n*Other reasons?:* ${job.otherreason || "N/A"}\n*Tools collected:* ${job.toolsCollected || "None"}\n*Lockout confirmed:* ${job.resetConfirmed}\n*Notify to Supervisor:* ${job.supervisorUser}\n*Message to Supervisor:* ${job.supervisorMessage || "None"}\n*Other Status:* ${job.otherStatuses || "None"}\n*Specify other Status:* ${job.otherSpecify || "None"}\n*End Date:* ${job.endDate || "None"}\n*End Time:* ${job.endTime || "None"}`),
      createHeader("Picture for Finished Job")
    );

    if (Array.isArray(job.finish_pic)) {
      blocks.push(...job.finish_pic.slice(0, 5).map((url, i) => createImage(url, `Job image ${i + 1}`)));
    }

    blocks.push(createDivider());
    }
    blocks.push(createHeader("Picture for Job Order"));
    if (Array.isArray(job.picture)) {
      blocks.push(...job.picture.slice(0, 5).map((url, i) => createImage(url, `Job image ${i + 1}`)));
    }

    const modal = {
        type: "modal",
        callback_id: "view_detail_modal",
        title: {
          type: "plain_text",
          text: "Job Details",
          emoji: true
        },
        close: {
          type: "plain_text",
          text: "Close",
          emoji: true
        },
        blocks
      };
    
  try {
    const response = await axios.post(
      'https://slack.com/api/views.open',
      {
        trigger_id: trigger_id,
        view: modal
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
        }
      }
    );

    if (!response.data.ok) {
      console.error("Slack API error:", response.data);
    }

  } catch (err) {
    console.error("Modal open error:", err.response?.data || err.message);
  }
};
module.exports = { openModal_view_detail};