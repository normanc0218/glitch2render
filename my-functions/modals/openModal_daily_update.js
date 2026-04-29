const axios = require('axios');
const qs = require('qs');
const { 
  createInputBlock, 
  createInputBlock_pic, 
  createInputBlock_date, 
  createInputBlock_time, 
  createInputBlock_radio 
} = require('../utils/blockBuilder'); // Importing your block builders
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

// list of managerUser IDs
const {Supervisors} = require('../userConfig');
const superOption=Object.entries(Supervisors)

const openModal_daily_update = async (trigger_id, jobId) => {
  const modal = {
    type: "modal",
    callback_id: "update_daily",
    private_metadata: jobId, // Store the Job ID in private metadata
    title: {
      type: "plain_text",
      text: "Update Your Job",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Submit",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true
    },
    blocks: [
      createInputBlock_pic("finishPicture", "Picture of Your Job Update", "file_general_input"),
      createInputBlock("supervisor_message", "Comments", "supervisor_message","comments"),
      createInputBlock_radio({
        block_id: "supervisor_notify",
        label: "Notify the supervisor",
        action_id: "supervisor_notify",
        options: superOption.slice(1,6)
      }),
      createInputBlock_date("startDate", "Actual Start Date", "datepickeraction"),
      createInputBlock_time("startTime", "Actual Start Time", "timepickeraction"),
      createInputBlock_date("endDate", "Actual End Date", "datepickeraction", initialDate),
      createInputBlock_time("endTime", "Actual End Time", "timepickeraction", initialTime)
    ]
  }
     

  // API call to open the modal
const args = {
    token: process.env.SLACK_BOT_TOKEN,  // Ensure correct bot token
    trigger_id: trigger_id,
    view: JSON.stringify(modal)  // Pass the modal structure as JSON
  };

  try {
    const result = await axios.post('https://slack.com/api/views.open', qs.stringify(args));
    
    if (result.data.ok) {
      console.log('Modal opened successfully!');
    } else {
      console.error('Error opening modal:', result.data.error);  // Log any error response
    }
  } catch (error) {
    console.error('Error during modal open request:', error.message);  // Handle network or other errors
  }
};
module.exports = openModal_daily_update;