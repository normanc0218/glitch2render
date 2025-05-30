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

const openModal = async(trigger_id) => {
  const modal = {
	"type": "modal",
  "callback_id":"new_job_form",
	"title": {
		"type": "plain_text",
		"text": "Maintenance Order Form",
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
			"block_id": "machineLocation",
			"label": {
				"type": "plain_text",
				"text": "Machine and Location"
			},
			"element": {
				"type": "plain_text_input",
				"action_id": "machine_location_input",
				"placeholder": {
					"type": "plain_text",
					"text": "Where is the machine?"
				}
			}
		},
		{
			"type": "input",
			"block_id": "Description",
			"label": {
				"type": "plain_text",
				"text": "Description of the issue"
			},
			"element": {
				"type": "plain_text_input",
				"action_id": "issue",
				"placeholder": {
					"type": "plain_text",
					"text": "What is the issue?"
				},
				"multiline": true
			}
		},
		{
			"type": "input",
			"block_id": "maintenanceStaff",
			"label": {
				"type": "plain_text",
				"text": "Assign the job to"
			},
			"element": {
				"type": "multi_static_select",
				"placeholder": {
					"type": "plain_text",
					"text": "Select the person",
					"emoji": true
				},
				"options": [
					{
						"text": {
							"type": "plain_text",
							"text": "Fai",
							"emoji": true
						},
						"value": "U06DSKC32E4"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "Steven",
							"emoji": true
						},
						"value": "value-1"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "Sam",
							"emoji": true
						},
						"value": "value-2"
					}
				],
				"action_id": "pickedGuy"
			}
		},
		{
			"type": "input",
			"block_id": "picture",
			"label": {
				"type": "plain_text",
				"text": "Picture of the defect"
			},
			"element": {
				"type": "file_input",
				"action_id": "file_input_action_id_1",
				"filetypes": [
					"jpg",
					"png"
				],
				"max_files": 5
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
module.exports = { openModal};