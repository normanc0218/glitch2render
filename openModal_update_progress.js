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

const openModal_update_progress = async (trigger_id, jobId) => {
  const modal ={
	"type": "modal",
	"callback_id": "update_progress",
	"private_metadata":jobId,
	"title": {
		"type": "plain_text",
		"text": "Update progress"
	},
	"submit": {
		"type": "plain_text",
		"text": "Submit"
	},
	"close": {
		"type": "plain_text",
		"text": "Cancel"
	},
	"blocks": [
		{
			"type": "input",
			"block_id": "accept_block",
			"label": {
				"type": "plain_text",
				"text": "Your Name"
			},
			"element": {
				"type": "static_select",
				"placeholder": {
					"type": "plain_text",
					"text": "name ",
					"emoji": true
				},
				"options": [
					{
						"text": {
							"type": "plain_text",
							"text": "Fai",
							"emoji": true
						},
						"value": "Fai"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "Steven",
							"emoji": true
						},
						"value": "Steven"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "Sam",
							"emoji": true
						},
						"value": "Sam"
					}
				],
				"action_id": "whoupdate"
			}
		},
		{
			"type": "input",
			"block_id": "reason_defect_block",
			"element": {
				"type": "checkboxes",
				"options": [
					{
						"text": {
							"type": "mrkdwn",
							"text": "Wear or Tear"
						},
						"value": "wear_tear"
					},
					{
						"text": {
							"type": "mrkdwn",
							"text": "Operator error"
						},
						"value": "operator_error"
					},
					{
						"text": {
							"type": "mrkdwn",
							"text": "No issue"
						},
						"value": "no_issue"
					},
					{
						"text": {
							"type": "mrkdwn",
							"text": "Unknown issue"
						},
						"value": "unknown_issue"
					},
					{
						"text": {
							"type": "mrkdwn",
							"text": "Other"
						},
						"value": "other"
					}
				],
				"action_id": "reason_defect"
			},
			"label": {
				"type": "plain_text",
				"text": "What is the cause of this issue?",
				"emoji": true
			}
		},
		{
			"type": "input",
			"block_id": "other_reason_input",
			"element": {
				"type": "plain_text_input",
				"multiline": true,
				"action_id": "plain_text_input-action"
			},
			"label": {
				"type": "plain_text",
				"text": "*Specify the other reason if any?",
				"emoji": true
			},
			"optional": true
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
		{
			"type": "input",
			"block_id": "supervisor_notify",
			"label": {
				"type": "plain_text",
				"text": "Notify Supervisor",
				"emoji": true
			},
			"element": {
				"type": "users_select",
				"placeholder": {
					"type": "plain_text",
					"text": "Select supervisor"
				},
				"action_id": "notify_supervisor_select"
			}
		},
		{
			"type": "input",
			"block_id": "supervisor_message",
			"element": {
				"type": "plain_text_input",
				"action_id": "notify_supervisor_message",
				"placeholder": {
					"type": "plain_text",
					"text": "e.g. Please arrange for cleanup after repair"
				}
			},
			"label": {
				"type": "plain_text",
				"text": "Message to Supervisor",
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
				"text": "End date",
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
				"text": "End time",
				"emoji": true
			}
		},
		{
			"type": "input",
			"block_id": "complete_job_block",
			"element": {
				"type": "radio_buttons",
				"options": [
					{
						"text": {
							"type": "mrkdwn",
							"text": "Complete the job and Fixed the issue"
						},
						"value": "Completed"
					},
					{
						"text": {
							"type": "mrkdwn",
							"text": "Report other job status (Please select from below)"
						},
						"value": "Reported other job status"
					}
				],
				"action_id": "complete_job"
			},			
      "label": {
				"type": "plain_text",
				"text": "Status of Completed Job",
				"emoji": true
			}
      		},
		{
			"type": "input",
			"block_id": "other_status_block",
			"element": {
				"type": "checkboxes",
				"options": [
					{
						"text": {
							"type": "mrkdwn",
							"text": "Waiting for parts"
						},
						"value": "Waiting for parts"
					},
					{
						"text": {
							"type": "mrkdwn",
							"text": "Temporarily fixed"
						},
						"value": "Temporarilyfixed"
					},
					{
						"text": {
							"type": "mrkdwn",
							"text": "Other"
						},
						"value": "other"
					}
				],
				"action_id": "otheroption"
			},
			"label": {
				"type": "plain_text",
				"text": "Other Job Status (if not completed)",
				"emoji": true
			},
			"optional": true
		},{
			"type": "input",
			"element": {
				"type": "plain_text_input",
				"action_id": "specify_other"
			},
			"label": {
				"type": "plain_text",
				"text": "If you select other, please specify*",
				"emoji": true
			},
			"optional": true
		},
		{
			"type": "input",
			"block_id": "follow_up_block",
			"element": {
				"type": "radio_buttons",
				"options": [
					{
						"text": {
							"type": "mrkdwn",
							"text": "Yes,I will follow up the job"
						},
						"value": "Completed"
					}
				],
				"action_id": "followUp"
			},			
      "label": {
				"type": "plain_text",
				"text": "Please make sure to follow up the job!",
				"emoji": true
			}
      
		}
	,{
			"type": "input",
			"block_id": "picture",
			"label": {
				"type": "plain_text",
				"text": "Picture of the Job (Max: 5 pics)"
			},
			"element": {
				"type": "file_input",
				"action_id": "finish_pic",
				"filetypes": [
					"jpg",
					"png"
				],
				"max_files": 5
			}
		}]
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

module.exports = { openModal_update_progress };
