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

const { maintenanceStaff, managerUsers } = require('./userConfig');
const staffOptions = Object.entries(maintenanceStaff).map(([name, value]) => ({
  text: {
    type: "plain_text",
    text: name,
    emoji: true
  },
  value: value
}));
const open_general_update = async(trigger_id,JobId) => {
  const modal = {
	"type": "modal",
  "callback_id":"open_general_update",
  "private_metadata":JobId,
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
		
		{
			"type": "input",
			"block_id": "picture",
			"label": {
				"type": "plain_text",
				"text": "Picture of Your job Update"
			},
			"element": {
				"type": "file_input",
				"action_id": "file_general_input",
				"filetypes": [
					"jpg",
					"png"
				],
				"max_files": 5
			}
		},{
  type: "input",
  block_id: "supervisor",
  label: {
    type: "plain_text",
    text: "Supervisor Approval",
    emoji: true
  },
  element: {
    type: "static_select",
    placeholder: {
      type: "plain_text",
      text: "Select approving supervisor",
      emoji: true
    },
    options: managerUsers.map(userId => ({
      text: {
        type: "plain_text",
        text: `Supervisor: ${userId}`, // You could resolve names if you want
        emoji: true
      },
      value: userId
    })),
    action_id: "supervisor_select"
  }
},
		{
			"type": "input",
      "block_id":"date",
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
				"text": "Start date",
				"emoji": true
			}
		},
		{
			"type": "input",
      "block_id":"time",
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
				"text": "Start time",
				"emoji": true
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
module.exports = { open_general_update};