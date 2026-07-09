const axios = require('axios');
const { maintenanceStaff, managerUsers } = require('../userConfig');
const {
  createInputBlock,
  createInputBlock_select,
  createTextSection,
  createInputBlock_date,
  createInputBlock_time,
} = require('../utils/blockBuilder');
function getNYParts() {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  );
}
const mStaffName = Object.keys(maintenanceStaff);
const openModal_accept = async (trigger_id, jobId) => {
  const p = getNYParts();
  const initialDate = `${p.year}-${p.month}-${p.day}`;
  const initialTime = `${p.hour.padStart(2, "0")}:${p.minute}`;
  const blocks=[]
  blocks.push(createInputBlock("remarks", "Specify the reason if you are currently occupied.", "remarks_input", "Enter your remarks here"));
  blocks.push(createTextSection("Plan to Start Date"));
  blocks.push(createInputBlock_date("acceptDate", "Select a Date", "datepickeraction", initialDate));
  blocks.push(createTextSection("Plan to Start Time"));
  blocks.push(createInputBlock_time("acceptTime", "Select a Time", "timepickeraction", initialTime));

  const modal = {
    type: "modal",
    callback_id: "planAccept",
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

module.exports =  openModal_accept ;
