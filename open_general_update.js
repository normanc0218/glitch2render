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

const initialTime =  new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/New_York"
}).format(new Date()); // e.g. "14:37"

// list of managerUser IDs
const {Supervisors} = require('./userConfig');
const superOption=Object.entries(Supervisors)

const open_general_update = async (viewId, JobId) => {
  const modal = {
    "type": "modal",
    "callback_id": "open_general_update",
    "private_metadata": JobId, // Store the Job ID in private metadata
    "title": {
      "type": "plain_text",
      "text": "Update Your Job",
      "emoji": true
    },
    "submit": {
      "type": "plain_text",
      "text": "Submit",
      "emoji": true
    },
    "close": {
      "type": "plain_text",
      "text": "Cancel",
      "emoji": true
    },
    "blocks": [
      createInputBlock_pic("picture", "Picture of Your Job Update", "file_general_input"),
      createInputBlock("comments", "Comments", "remarks_input"),
      // Supervisor Approval (static select dropdown)
      createInputBlock_radio({
        block_id: "supervisor_notify",
        label: "Notify the supervisor",
        action_id: "notify_supervisor",
        options: superOption
      }),
      {
        "type": "input",
        "block_id": "supervisor",
        "label": {
          "type": "plain_text",
          "text": "Supervisor Approval",
          "emoji": true
        },
        "element": {
          "type": "static_select",
          "placeholder": {
            "type": "plain_text",
            "text": "Select approving supervisor",
            "emoji": true
          },
          "options": Object.entries(Supervisors).map(([name, userId]) => ({
            text: {
              type: "plain_text",
              text: `Supervisor: ${name}`,
              emoji: true
            },
            value: userId
          }))
          ,
          "action_id": "supervisor_select"
        }
      },
      // Date picker for start date
      {
        "type": "input",
        "block_id": "date",
        "element": {
          "type": "datepicker",
          "initial_date": initialDate,
          "placeholder": {
            "type": "plain_text",
            "text": "Select a date",
            "emoji": true
          },
          "action_id": "datepickeraction"
        },
        "label": {
          "type": "plain_text",
          "text": "End date",
          "emoji": true
        }
      },
      // Time picker for start time
      {
        "type": "input",
        "block_id": "time",
        "element": {
          "type": "timepicker",
          "initial_time": initialTime,
          "placeholder": {
            "type": "plain_text",
            "text": "Select time",
            "emoji": true
          },
          "action_id": "timepickeraction"
        },
        "label": {
          "type": "plain_text",
          "text": "End time",
          "emoji": true
        }
      }
    ]
  };

  // API call to open the modal
  const args = {
    token: process.env.SLACK_BOT_TOKEN,  // Ensure correct bot token
    view_id: viewId,  // The trigger ID that comes from the button press
    view: JSON.stringify(modal)  // Pass the modal structure as JSON
  };

  try {
    const result = await axios.post('https://slack.com/api/views.update', qs.stringify(args));
    
    if (result.data.ok) {
      console.log('Modal opened successfully!');
    } else {
      console.error('Error opening modal:', result.data.error);  // Log any error response
    }
  } catch (error) {
    console.error('Error during modal open request:', error.message);  // Handle network or other errors
  }
};
module.exports = { open_general_update};