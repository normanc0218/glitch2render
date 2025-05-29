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
  const modal = {
    type: "modal",
    callback_id: "update_progress",
    private_metadata: jobId,
    title: {
      type: "plain_text",
      text: "Update progress"
    },
    submit: {
      type: "plain_text",
      text: "Submit"
    },
    close: {
      type: "plain_text",
      text: "Cancel"
    },
    blocks: [
      {
        type: "input",
        block_id:"accept_block",
        label: {
            type: "plain_text",
            text: "Your Name"
          },
        element: {
          type: "static_select",
          placeholder: { type: "plain_text", text: "name ", emoji: true },
          options: [
            { text: { type: "plain_text", text: "Fai", emoji: true }, value: "value-0" },
            { text: { type: "plain_text", text: "Steven", emoji: true }, value: "value-1" },
            { text: { type: "plain_text", text: "Sam", emoji: true }, value: "value-2" }
          ],
          action_id: "whoaccept"
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
