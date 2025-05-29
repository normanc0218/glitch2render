const axios = require('axios');
const today = new Date();
const initialDate = today.toISOString().split("T")[0]; // e.g. "2025-05-28"
const initialTime =  new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/New_York"
}).format(today); // e.g. "14:37"

const openModal_update_progress = async (trigger_id, jobId) => {
  const modal ={
	"type": "modal",
	"callback_id": "update_progress",
	"private_metadata": "JOB-ID-HERE",
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
		{
			"type": "section",
			"block_id": "tools_collected_block",
			"text": {
				"type": "plain_text",
				"text": "All tools have been returned and collected",
				"emoji": true
			},
			"accessory": {
				"type": "static_select",
				"action_id": "select_tools_collected",
				"placeholder": {
					"type": "plain_text",
					"text": "Pick one"
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
				]
			}
		},
		{
			"type": "section",
			"block_id": "reset_verified_block",
			"text": {
				"type": "plain_text",
				"text": "Verified that power supplies, water supplies, and emergency stop buttons are properly reset and secure before resuming operation.",
				"emoji": true
			},
			"accessory": {
				"type": "static_select",
				"action_id": "select_reset_verified",
				"placeholder": {
					"type": "plain_text",
					"text": "Pick one"
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
				]
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
		},
		{
			"type": "input",
			"block_id": "date",
			"element": {
				"type": "datepicker",
				"initial_date": "2025-05-29",
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
				"initial_time": "02:13",
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
			"type": "section",
			"block_id": "complete_job_block",
			"text": {
				"type": "mrkdwn",
				"text": "*Status of the Finished Job*"
			},
			"accessory": {
				"type": "radio_buttons",
				"options": [
					{
						"text": {
							"type": "mrkdwn",
							"text": "Complete the job and Fixed the issue"
						},
						"value": "complete"
					},
					{
						"text": {
							"type": "mrkdwn",
							"text": "Report other job status (Please select from below)"
						},
						"value": "value-4"
					}
				],
				"action_id": "complete_job"
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
						"value": "wait4part"
					},
					{
						"text": {
							"type": "mrkdwn",
							"text": "Follow-up check"
						},
						"value": "fcheck"
					},
					{
						"text": {
							"type": "mrkdwn",
							"text": "Temporarily fixed"
						},
						"value": "temporarilyfixed"
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

module.exports = { openModal_update_progress };
