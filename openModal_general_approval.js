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



const openModal_general_approval = async (viewId, jobId) => {
  const modal ={
	"type": "modal",
	"callback_id": "approve_general",
	"private_metadata": jobId,
	"title": {
		"type": "plain_text",
		"text": "Review progress"
	},
	"submit": {
		"type": "plain_text",
		"text": "Approved"
	},
	"close": {
		"type": "plain_text",
		"text": "Cancel"
	},
	"blocks": [

		{
			"type": "section",
      "block_id":"tool_id",
			"text": {
				"type": "mrkdwn",
				"text": "*Assigned Maintenance has/have collected their tools and materials*"
			},
			"accessory": {
				"type": "static_select",
				"placeholder": {
					"type": "plain_text",
					"text": "Select an item",
					"emoji": true
				},
				"options": [
					{
						"text": {
							"type": "plain_text",
							"text": "Yes",
							"emoji": true
						},
						"value": "Yes"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "No",
							"emoji": true
						},
						"value": "No"
					}
				],
				"action_id": "Maitenance_tool"
			}
		},
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": "*Working area needs extra helps for cleaning?*"
			},
			"accessory": {
				"type": "static_select",
				"placeholder": {
					"type": "plain_text",
					"text": "Select an item",
					"emoji": true
				},
				"options": [
					{
						"text": {
							"type": "plain_text",
							"text": "Yes",
							"emoji": true
						},
						"value": "Yes"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "No",
							"emoji": true
						},
						"value": "No"
					}
				],
				"action_id": "working_are"
			}
		},
		{
			"type": "input",
			"block_id": "clean_input",
			"element": {
				"type": "plain_text_input",
				"action_id": "name_clean"
			},
			"label": {
				"type": "plain_text",
				"text": "Assign who to help cleaning the working area?",
				"emoji": true
			},
			"optional": true
		},
		{
			"type": "input",
			"block_id": "other_reason_input",
			"element": {
				"type": "plain_text_input",
				"multiline": true,
				"action_id": "detailOfJob"
			},
			"label": {
				"type": "plain_text",
				"text": "*Specify other details related to this job",
				"emoji": true
			},
			"optional": true
		},
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
				"text": "Check date",
				"emoji": true
			}
		},
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
				"text": "Check time",
				"emoji": true
			}
		}
	]
}
;

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

module.exports = { openModal_general_approval };
