const axios = require('axios');
const qs = require('qs');
const openModal_accept = async(trigger_id) => {
  const modal = {
        type: "modal",
        callback_id: "accept_form",
        title: {
          type: "plain_text",
          text: "Accept Task"
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
            block_id: "remarks_block",
            label: {
              type: "plain_text",
              text: "Remarks"
            },
            element: {
              type: "plain_text_input",
              action_id: "remarks_input",
              multiline: true
            }
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
module.exports = { openModal_accept};