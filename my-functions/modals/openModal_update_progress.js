const { WebClient } = require("@slack/web-api");
const userConfig = require("../services/slackUserService");
const {
  createInputBlock,
  createInputBlock_select,
  createTextSection,
  createInputBlock_date,
  createInputBlock_time,
  createInputBlock_checkboxes,
  createInputBlock_radio,
  createInputBlock_pic,
} = require("../utils/blockBuilder");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

function getNYParts() {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  );
}

const STATUS_OPTIONS = [
  ["Complete the job", "completed"],
  ["Other situation", "other_situation"],
];

const OTHER_SITUATION_OPTIONS = [
  ["Waiting for parts", "waiting_for_parts"],
  ["Temporarily fixed", "temporarily_fixed"],
  ["Follow up check", "follow_up_check"],
];

function buildUpdateProgressModal(jobId, showOtherOptions = false, selectedStatus = null, selectedOtherStatus = null) {
  const p = getNYParts();
  const initialDate = `${p.year}-${p.month}-${p.day}`;
  const initialTime = `${p.hour.padStart(2, "0")}:${p.minute}`;

  const superNameOptions = Object.keys(userConfig.Supervisors).map(name => [name, name]);

  const blocks = [];

  blocks.push(createInputBlock_checkboxes({
    block_id: "reason_defect_block",
    label: "What is the cause of this issue?",
    action_id: "reason_defect",
    options: ["Wear or Tear", "Operator error", "No issue", "Unknown issue", "Other"],
  }));
  blocks.push(createInputBlock("other_reason_input", "Specify the other reason if any?", "otherreason", "Enter other reason", true));
  blocks.push(createTextSection("Clean-up Checklist"));
  blocks.push(createInputBlock_select({
    block_id: "select_tools",
    label: "All tools have been returned and collected",
    action_id: "tool_collected",
    options: ["Yes", "No"],
  }));
  blocks.push(createInputBlock_select({
    block_id: "resetbuttons",
    label: "Verified that power supplies, water supplies, and emergency stop buttons are properly reset and secure before resuming operation.",
    action_id: "resetbuttons",
    options: ["Yes", "No"],
  }));
  blocks.push(createTextSection("Call Supervisor to notify them of the Job"));
  blocks.push(createInputBlock_radio({
    block_id: "supervisor_notify",
    label: "Notify the supervisor",
    action_id: "supervisor_notify",
    options: superNameOptions,
  }));
  blocks.push(createInputBlock("supervisor_message", "Message to Supervisor", "supervisor_message", "e.g. Please arrange for cleanup after repair"));
  blocks.push(createInputBlock_date("endDate", "End date", "datepickeraction", initialDate));
  blocks.push(createInputBlock_time("endTime", "End time", "timepickeraction", initialTime));

  const statusInitial = selectedStatus
    ? STATUS_OPTIONS.find(([, v]) => v === selectedStatus) || null
    : null;

  blocks.push(createInputBlock_radio({
    block_id: "complete_job",
    label: "Status of Completed Job",
    action_id: "complete_job",
    dispatch_action: true,
    options: STATUS_OPTIONS,
    initial_option: statusInitial,
  }));

  if (showOtherOptions) {
    const otherInitial = selectedOtherStatus
      ? OTHER_SITUATION_OPTIONS.find(([, v]) => v === selectedOtherStatus) || null
      : null;

    blocks.push(createInputBlock_radio({
      block_id: "other_status",
      label: "Other Situation",
      action_id: "other_status",
      dispatch_action: true,
      options: OTHER_SITUATION_OPTIONS,
      initial_option: otherInitial,
    }));

    if (selectedOtherStatus === "waiting_for_parts") {
      blocks.push(createInputBlock("parts_needed", "What parts need to be purchased?", "parts_needed", "e.g. Bearing 6205, conveyor belt 50mm"));
    }
  }

  blocks.push(createInputBlock_pic("finishPicture", "Picture of the Job (Max: 5 pics)", "file_input_action_id_1"));

  return {
    type: "modal",
    callback_id: "update_form",
    private_metadata: jobId,
    title: { type: "plain_text", text: "Update progress" },
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks,
  };
}

const openModal_update_progress = async (trigger_id, jobId) => {
  await client.views.open({
    trigger_id,
    view: buildUpdateProgressModal(jobId),
  });
};

module.exports = openModal_update_progress;
module.exports.buildUpdateProgressModal = buildUpdateProgressModal;
