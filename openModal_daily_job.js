const axios = require('axios');
const qs = require('qs');
const nyDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date()); // e.g. "2025-05-28"
const [month, day, year] = nyDate.split('/');

const openModal_daily_job = async(trigger_id, jobId) => {
    const data = await db.getData("/data") || [];
    const job = data.find(item => item.JobId === jobId)
    const modal = {
        type: "modal",
        callback_id: "daily_job_modal",
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
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Job ID:* ${job.JobId}`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Ordered By:* ${job.Orderedby || "N/A"}\n*Machine Location:* ${job.machineLocation}\n*Finder:* ${job.finder || "N/A"}`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Description:* ${job.Description}`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Assigned Staff:* ${Array.isArray(job.maintenanceStaff) ? job.maintenanceStaff.join(", ") : "N/A"}\n*Order Date:* ${job.orderdate}\n*Order Time:* ${job.ordertime}\n*Status:* ${job.status}`
            }
          },{
          type: "divider",
        },
          ...(job.acceptdate || job.accepttime || job.remarks
        ? [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Accept Date:* ${job.acceptdate || "N/A"}\n *Accept Time:* ${job.accepttime || "N/A"}\n*Remarks:* ${job.remarks || "None"}`
            }
          },{
          type: "divider",
        }]: []),
          ...(job.rejectdate || job.rejecttime || job.rejectby
        ? [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Reject Date:* ${job.rejectdate || "N/A"}\n *Reject Time:* ${job.rejecttime || "N/A"}\n*Reject by:* ${job.rejectby || "None"}\n*Reject reason:* ${job.rejectreason}`
            }
          },{
          type: "divider",
        }]: []),...(job.endDate || job.endTime 
        ? [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Done By:* ${job.updatedBy || "N/A"}\n *Cause of issue:* ${job.issueCauses || "N/A"}\n *Other reasons?:* ${job.otherreason || "N/A"}\n*Tools collected:* ${job.toolsCollected || "None"}\n*Lockout confirmed:* ${job.resetConfirmed}
              \n*Notify to Supervisor:* ${job.supervisorUser} \n*Message to Supervisor:* ${job.supervisorMessage|| "None"} \n*Other Status:* ${job.otherStatuses|| "None"} \n*Specify other Status:* ${job.otherSpecify|| "None"}
              \n*End Date:* ${job.endDate|| "None"}\n*End Time:* ${job.endTime|| "None"}`
            }
          },{
              "type": "header",
              "text": {
                "type": "plain_text",
                "text": "Picture for Finished Job",
                "emoji": true
              }
            },
          ...(job.finish_pic?.length
            ? job.finish_pic.slice(0, 5).map((url, index) => ({
                type: "image",
                image_url: url,
                alt_text: `Job image ${index + 1}`
              }))
        : []),{
          type: "divider",
        }]: []),{
              "type": "header",
              "text": {
                "type": "plain_text",
                "text": "Picture for Job Order",
                "emoji": true
              }
            },
          ...(job.picture?.length
            ? job.picture.slice(0, 5).map((url, index) => ({
                type: "image",
                image_url: url,
                alt_text: `Job image ${index + 1}`
              }))
        : [])
          
         
        ]
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
module.exports = { openModal_daily_job};