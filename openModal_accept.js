const axios = require('axios');
const today = new Date();
const initialDate = today.toISOString().split("T")[0]; // e.g. "2025-05-28"
const initialTime =  new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/New_York"
}).format(today); // e.g. "14:37"

const openModal_accept = async (trigger_id, jobId) => {
  const modal = {
    type: "modal",
    callback_id: "accept_form",
    private_metadata: jobId,
    title: {
      type: "plain_text",
      text: "Accept Task"
    },
    submit: {
      type: "plain_text",
      text: "Accept"
    },
    close: {
      type: "plain_text",
      text: "Cancel"
    },
    blocks: [
      {
        type: "input",
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
        type: "input",
        block_id: "signature",
        label: { type: "plain_text", text: "Accept the Job and Sign" },
        element: {
          type: "plain_text_input",
          action_id: "remarks_input"
        }
      },
      {
        type: "section",
        text: { type: "plain_text", text: "Date to Start", emoji: true }
      },
      {
        type: "actions",
        block_id: "datepicker",
        elements: [
          {
            type: "datepicker",
            initial_date: initialDate,
            placeholder: { type: "plain_text", text: "Select a date", emoji: true },
            action_id: "start_date"
          }
        ]
      },
      {
        type: "section",
        text: { type: "plain_text", text: "Time to Start", emoji: true }
      },
      {
        type: "actions",
        block_id: "timepicker",
        elements: [
          {
            type: "timepicker",
            initial_time: initialTime,
            placeholder: { type: "plain_text", text: "Select time", emoji: true },
            action_id: "start_time"
          }
          
        ]
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

module.exports = { openModal_accept };
