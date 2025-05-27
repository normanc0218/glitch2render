const axios = require('axios');
const qs = require('qs');
const openModal = async(trigger_id) => {
  const modal_json = `{
	"type": "modal",
	"title": {
		"type": "plain_text",
		"text": "My App",
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
			"block_id": "note01",
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
			"block_id": "note01",
			"label": {
				"type": "plain_text",
				"text": "Description of the issue"
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
			"block_id": "note03",
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
							"text": "*Fai",
							"emoji": true
						},
						"value": "value-0"
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
				"action_id": "multi_static_select-action"
			}
		},
		{
			"type": "input",
			"block_id": "input_block_id",
			"label": {
				"type": "plain_text",
				"text": "Picture of the  defect"
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
			"element": {
				"type": "datepicker",
				"initial_date": "1990-04-28",
				"placeholder": {
					"type": "plain_text",
					"text": "Select a date",
					"emoji": true
				},
				"action_id": "datepicker-action"
			},
			"label": {
				"type": "plain_text",
				"text": "Start date",
				"emoji": true
			}
		},
		{
			"type": "input",
			"element": {
				"type": "timepicker",
				"initial_time": "13:37",
				"placeholder": {
					"type": "plain_text",
					"text": "Select time",
					"emoji": true
				},
				"action_id": "timepicker-action"
			},
			"label": {
				"type": "plain_text",
				"text": "Start time",
				"emoji": true
			}
		}
	]
}`;
  const modal=JSON.parse(modal_json);

  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: trigger_id,
    view: JSON.stringify(modal)
  };
  
  const result = await axios.post('https://slack.com/api/views.open', qs.stringify(args));
};
module.exports = { openModal};