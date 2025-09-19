const axios = require('axios');
const { maintenanceStaff, managerUsers } = require('./userConfig');


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

function getNYTimeString() {
  const d = new Date();
  const ny = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hh = ny.getHours().toString().padStart(2, '0');
  const mm = ny.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}
const initialTime = getNYTimeString();

// list of managerUser IDs
const {Supervisors} = require('./userConfig');
const superOption=Object.entries(Supervisors)
const MStaff = Object.keys(maintenanceStaff);
const openModal_update_progress = async (trigger_id, jobId) => {
  const blocks=[]
  blocks.push(createInputBlock_select({
    block_id: "accept_block",
    label: "Your Name",
    action_id: "whoupdate",
    options: MStaff , // <-- make sure this is passed in like this
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
    options: superOption
  }));
  blocks.push(createInputBlock("supervisor_message", "Message to Supervisor", "notify_supervisor_message", "e.g. Please arrange for cleanup after repair"));
  blocks.push(createInputBlock_date("date", "End date", "datepickeraction", initialDate));
  blocks.push(createInputBlock_time("time", "End time", "timepickeraction", initialTime));
  blocks.push(createInputBlock_radio({
      block_id: "complete_job_block",
      label: "Status of Completed Job",
      action_id: "complete_job",
      options:  [["Complete the job and Fixed the issue","Waiting for Supervisor Approval"],
                ["Report other job status (Please select from below)", "Reported other job status"]]
    })
  );
  blocks.push(createInputBlock_checkboxes({
    block_id: "other_status_block",
    label: "Other Job Status (if not completed)",
    action_id: "otheroption",
    options: ["Waiting for parts","Temporarily fixed","Other"], // <-- make sure this is passed in like this
    optional: true
  }));
  blocks.push(createInputBlock("specify", "If you select other, please specify*?", "specify_other", "Enter other reason", true));
  blocks.push(createInputBlock_radio({
      block_id: "follow_up_block",
      label: "Please make sure to follow up the job!",
      action_id: "followUp",
      options:  [["Yes,I will follow up the job","followup"]]
    })
  );
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
