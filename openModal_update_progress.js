const axios = require('axios');
const {
  createInputBlock,
  createInputBlock_select,
  createTextSection,
  createInputBlock_date,
  createInputBlock_time,
  createInputBlock_checkboxes,
  createInputBlock_radio,
  createInputBlock_pic
} = require('./blockBuilder');

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
const {Supervisors} = require('./userConfig');

const superOptions = Object.entries(Supervisors).map(([name, value]) => ({
  text: {
    type: "mrkdwn",
    text: name
  },
  value: value
}));

const openModal_update_progress = async (trigger_id, jobId) => {
  const blocks=[]
  blocks.push(createInputBlock_select({
    block_id: "accept_block",
    label: "Your Name",
    action_id: "whoupdate",
    options: ["Fai","Sam","Steven"], // <-- make sure this is passed in like this
  }));
  blocks.push(createInputBlock_checkboxes({
    block_id: "reason_defect_block",
    label: "What is the cause of this issue?",
    action_id: "reason_defect",
    options: ["Wear or Tear","Operator error","No issue","Unknown issue","Other"], // <-- make sure this is passed in like this
  }));
  blocks.push(createInputBlock("other_reason_input", "*Specify the other reason if any?", "otherreason", "Enter other reason", true));
  blocks.push(createTextSection("Clean-up Checklist"));
  blocks.push(createInputBlock_select({
    block_id: "select_tools",
    label: "All tools have been returned and collected",
    action_id: "tool_collected",
    options: ["Yes","No"], // <-- make sure this is passed in like this
  }));
  blocks.push(createInputBlock_select({
    block_id: "resetbuttons",
    label: "Verified that power supplies, water supplies, and emergency stop buttons are properly reset and secure before resuming operation.",
    action_id: "reset_buttons",
    options: ["Yes","No"], // <-- make sure this is passed in like this
  }));
  blocks.push(createTextSection("Call Supervisor to notify them of the Job"));
  blocks.push(createInputBlock_radio({
    block_id: "supervisor_notify",
    label: "Notify the supervisor",
    action_id: "notify_supervisor",
    options: superOptions
  }));
  blocks.push(createInputBlock_checkboxes({
    block_id: "other_status_block",
    label: "Other Job Status (if not completed)",
    action_id: "otheroption",
    options: ["Waiting for parts","Temporarily fixed","Other"], // <-- make sure this is passed in like this
  }));
  blocks.push(createInputBlock("specify", "If you select other, please specify", "specify_other"));
  blocks.push(createInputBlock_radio({
    block_id: "follow_up_block",
    label: "Please make sure to follow up the job!",
    action_id: "followUp",
    options: [{ text: "Yes, I will follow up the job", value: "Completed" }]}));
  blocks.push(createInputBlock_pic("picture", "Picture of the Job (Max: 5 pics)", "finish_pic"));

  const modal ={
    type: "modal",
    callback_id: "update_progress",
    private_metadata:jobId,
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
    blocks
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
