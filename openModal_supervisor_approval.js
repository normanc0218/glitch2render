const axios = require('axios');
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
const supervisors = {
  // "Chris" : "U06D0NAAL5N",// Chris
  "Norman":  "U06DSKC32E4",// Norman
  "Justin": "U06D0NA0H16", // Justin
  "Tim": "U06CBUTM4JW",// Tim
  "Grace":"U0"
};


const openModal_supervisor_approval = async (trigger_id, jobId) => {
  const modal ={
	"type": "modal",
	"callback_id": "review_progress",
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

module.exports = { openModal_supervisor_approval };
