const axios = require('axios');
const qs = require('qs');
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
const job = await.db.
const modal = {
  type: "modal",
  title: { type: "plain_text", text: "Job Details" },
  close: { type: "plain_text", text: "Close" },
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Job ID:* ${job.JobId}\n*Status:* ${job.status}\n*Machine:* ${job.machineLocation}`
      }
    }
  ]
};

  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: trigger_id,
    view: JSON.stringify(modal)
  };
  
  const result = await axios.post('https://slack.com/api/views.open', qs.stringify(args));
};
module.exports = { openModal_view_detail};