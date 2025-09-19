const axios = require('axios');
const { maintenanceStaff, managerUsers } = require('./userConfig');
const {
  createInputBlock,
  createInputBlock_select,
  createTextSection,
  createInputBlock_date,
  createInputBlock_time,
} = require('./blockBuilder');
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
}
const initialTime = getNYTimeString();

const mStaffName = Object.keys(maintenanceStaff);
const openModal_reject = async (trigger_id, jobId) => {
  const blocks=[]
  blocks.push(createInputBlock_select({
    block_id: "reject_block",
    label: "Your Name",
    action_id: "whoreject",
    options: mStaffName, // <-- make sure this is passed in like this
  }));
  blocks.push(createInputBlock("reason", "Specify Your Reason To Reject", "reason_input", "Enter your reason here"));
  blocks.push(createInputBlock("signature", "Reject the Job and Sign", "remarks_input", "Enter your signature here"));
  blocks.push(createTextSection("End Date"));
  blocks.push(createInputBlock_date("datepicker", "Select a Date", "reject_date", initialDate));
  blocks.push(createTextSection("End Time"));
  blocks.push(createInputBlock_time("timepicker", "Select a Time", "reject_time", initialTime));
  const modal = {
    type: "modal",
    callback_id: "reject_form",
    private_metadata: jobId,
    title: {
      type: "plain_text",
      text: "Reject Task"
    },
    submit: {
      type: "plain_text",
      text: "Reject"
    },
    close: {
      type: "plain_text",
      text: "Cancel"
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

module.exports = { openModal_reject };
