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

const { maintenanceStaff } = require('./userConfig');
const projectManagers={
  Chris: "U06D0NAAL5N",
  Norman: "U06DSKC32E4"
};

const update_finish_project = async (viewId, JobId) => {
  const modal = {
    "type": "modal",
    "callback_id": "update_finish_project",
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
      // File input block for picture upload
      {
        "type": "input",
        "block_id": "picture",
        "label": {
          "type": "plain_text",
          "text": "Pictures of Your Project"
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
        block_id: "comments",
        label: { type: "plain_text", text: "Comments. " },
        element: {
          type: "plain_text_input",
          action_id: "remarks_input"
        }
      },
		{
			"type": "rich_text",
			"elements": [
				{
					"type": "rich_text_section",
					"elements": [
						{
							"type": "text",
							"text": "Clean-up Checklist",
							"style": {
								"bold": true
							}
						}
					]
				}
			]
		},
				{"type": "input",
				"block_id": "select_tools",
				"element": {
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
							"text": "Yes"
						},
						"value": "yes"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "No"
						},
						"value": "no"
					}
				],
          "action_id":"tool_collected"
			}	,
    "label": {
				"type": "plain_text",
				"text": "All tools have been returned and collected",
				"emoji": true}
        },
				{"type": "input",
				"block_id": "resetbuttons",
				"element": {
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
							"text": "Yes"
						},
						"value": "yes"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "No"
						},
						"value": "no"
					}
				],
          "action_id":"tool_collected"
			}	,
    "label": {
				"type": "plain_text",
				"text": "Verified that power supplies, water supplies, and emergency stop buttons are properly reset and secure before resuming operation.",
				"emoji": true}
        },
		{
			"type": "rich_text",
			"elements": [
				{
					"type": "rich_text_section",
					"elements": [
						{
							"type": "text",
							"text": "Call Supervisor to notify them of the Job",
							"style": {
								"bold": true
							}
						}
					]
				}
			]
		},
      // Supervisor Approval (static select dropdown)
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
          "options": Object.entries(projectManagers).map(([name, userId]) => ({
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
          "text": "Start date",
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
          "text": "Start time",
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
module.exports = { update_finish_project};