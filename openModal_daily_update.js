const axios = require('axios');
const qs = require('qs');
const { 
  createInputBlock, 
  createInputBlock_pic, 
  createInputBlock_date, 
  createInputBlock_time, 
  createInputBlock_radio 
} = require('./blockBuilder'); // Importing your block builders
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
const {Supervisors} = require('./userConfig');
const superOption=Object.entries(Supervisors)

const openModal_daily_update = async (viewId, JobId) => {
  const modal = {
    type: "modal",
    callback_id: "daily_update",
    private_metadata: JobId, // Store the Job ID in private metadata
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
      createInputBlock_pic("picture", "Picture of Your Job Update", "file_general_input"),
      createInputBlock("comments", "Comments", "remarks_input","comments"),
      createInputBlock_radio({
        block_id: "supervisor_notify",
        label: "Notify the supervisor",
        action_id: "notify_supervisor",
        options: superOption.slice(1,4) //Skip Chris
      }),
      createInputBlock_date("sdate", "Actual Start Date", "datepickeraction"),
      createInputBlock_time("stime", "Actual Start Time", "timepickeraction"),
      createInputBlock_date("edate", "Actual End Date", "datepickeraction", initialDate),
      createInputBlock_time("etime", "Actual End Time", "timepickeraction", initialTime)
    ]
  }
     

  // API call to open the modal
try {
    const result = await axios.post(
      'https://slack.com/api/views.update',
      {
        token: process.env.SLACK_BOT_TOKEN,
        view_id: viewId,
        view: modal
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        }
      }
    );
    
    if (result.data.ok) {
      console.log('Modal opened successfully!');
    } else {
      console.error('Error opening modal:', result.data.error, result.data);
    }
  } catch (error) {
    console.error('Error during modal open request:', error.message);
  }
};
module.exports = { openModal_daily_update};