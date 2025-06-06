const axios = require('axios');
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

const initialTime =  new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/New_York"
}).format(new Date()); // e.g. "14:37"

const openModal_accept = async (trigger_id, jobId) => {
  const blocks=[]
  blocks.push(createInputBlock_select({
    block_id: "accept_block",
    label: "Your Name",
    action_id: "whoaccept",
    options: ["Fai","Sam","Steven"], // <-- make sure this is passed in like this
  }));
  blocks.push(createInputBlock("signature", "Specify the reason if you are currently occupied.", "remarks_input", "Enter your remarks here"));
  blocks.push(createTextSection("Plan to Start Date"));
  blocks.push(createInputBlock_date("datepicker", "Select a Date", "accept_date", initialDate));
  blocks.push(createTextSection("Plan to Start Time"));
  blocks.push(createInputBlock_time("timepicker", "Select a Time", "accept_time", initialTime));

  const modal = {
    type: "modal",
    callback_id: "accept_form",
    private_metadata: jobId,
    title: {
      type: "plain_text",
      text: "Accept Task"
    },
    submit: {
      type: "plain_text",
      text: "Accept"
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

module.exports = { openModal_accept };
