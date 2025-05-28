const axios = require('axios');
const qs = require('qs');
const openModal_accept = async(trigger_id,jobId) => {
  const modal = {
	"type": "modal",
	"callback_id": "accept_form",
	"title": {
		"type": "plain_text",
		"text": "Accept Task"
	},
	"submit": {
		"type": "plain_text",
		"text": "Accept"
	},
	"close": {
		"type": "plain_text",
		"text": "Cancel"
	},
	"blocks": [
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "Who are you?"
			},
			"accessory": {
				"type": "static_select",
				"placeholder": {
					"type": "plain_text",
					"text": "Name",
					"emoji": true
				},
				"options": [
					{
						"text": {
							"type": "plain_text",
							"text": "Fai",
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
				"action_id": "whoaccept"
			}
		},
		{
			"type": "input",
			"block_id": "remarks_block",
			"label": {
				"type": "plain_text",
				"text": "Accept the Job and Sign"
			},
			"element": {
				"type": "plain_text_input",
				"action_id": "remarks_input"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "plain_text",
				"text": "Date to Start",
				"emoji": true
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "datepicker",
					"initial_date": "1990-04-28",
					"placeholder": {
						"type": "plain_text",
						"text": "Select a date",
						"emoji": true
					},
					"action_id": "start date"
				}
			]
		},
		{
			"type": "section",
			"text": {
				"type": "plain_text",
				"text": "Time to Start",
				"emoji": true
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "timepicker",
					"initial_time": "13:37",
					"placeholder": {
						"type": "plain_text",
						"text": "Select time",
						"emoji": true
					},
					"action_id": "actionId-0"
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Click Me",
						"emoji": true
					},
					"value": "click_me_123",
					"action_id": "actionId-1"
				}
			]
		}
	]
}
    ;
  
  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: trigger_id,
    view: modal  };
  
  const result = await axios.post('https://slack.com/api/views.open', qs.stringify(args));
};
module.exports = { openModal_accept};