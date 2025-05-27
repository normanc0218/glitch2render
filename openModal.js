const axios = require('axios');
const qs = require('qs');
const openModal = async(trigger_id) => {
  const modal = {
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
			"block_id": "note02",
			"label": {
				"type": "plain_text",
				"text": "Description of the Issue"
			},
			"element": {
				"type": "plain_text_input",
				"action_id": "issue_description_input",
				"multiline": true,
				"placeholder": {
					"type": "plain_text",
					"text": "What is happening?"
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
			"type": "image",
			"slack_file": {
				"url": "<insert slack file url here>"
			},
			"alt_text": "inspiration"
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