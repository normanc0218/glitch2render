const axios = require('axios');
const qs = require('qs');
const { db } = require("./appHome");
const nyDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date()); // e.g. "2025-05-28"
const [month, day, year] = nyDate.split('/');
const initialDate = `${year}-${month}-${day}`;

const initialTime =  new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/New_York"
}).format(new Date()); // e.g. "14:37"
const openModal_view_detail = async(trigger_id) => {
const job = await db.getData("/data") || [];
console.log(job)
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
          text: `*Ordered By:* ${job.Orderedby || "N/A"}\n*Timestamp:* ${job.timestamp}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Machine Location:* ${job.machineLocation}\n*Finder:* ${job.finder || "N/A"}`
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
          text: `*Assigned Staff:* ${job.maintenanceStaff.join(", ")}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Date:* ${job.date}  *Time:* ${job.time}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Status:* ${job.status}`
        }
      },
      ...(job.picture?.length
        ? [
            {
              type: "image",
              image_url: job.picture[0],
              alt_text: "Job image"
            }
          ]
        : [])
    ]
  };
};

  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: trigger_id,
    view: JSON.stringify(modal)
  };
  
  const result = await axios.post('https://slack.com/api/views.open', qs.stringify(args));
};
module.exports = { openModal_view_detail};