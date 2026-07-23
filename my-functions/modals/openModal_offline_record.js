const { WebClient } = require("@slack/web-api");
const db = require("../db");
const {
  createMultiInputBlock,
  createInputBlock_select,
  createInputBlock_pic,
  createInputBlock_date,
  createInputBlock_time,
  createInputBlock_radio,
} = require("../utils/blockBuilder");

const CAUSE_OPTIONS = [
  { text: { type: "plain_text", text: "Wear or Tear" },     value: "wear_or_tear" },
  { text: { type: "plain_text", text: "Operator error" },   value: "operator_error" },
  { text: { type: "plain_text", text: "Part replacement" }, value: "part_replacement" },
  { text: { type: "plain_text", text: "Unknown issue" },    value: "unknown_issue" },
  { text: { type: "plain_text", text: "Other" },            value: "other" },
];

const STATUS_OPTIONS = [
  ["Complete the job", "completed"],
  ["Other situation",  "other_situation"],
];

const OTHER_SITUATION_OPTIONS = [
  ["Temporarily fixed", "temporarily_fixed"],
  ["Waiting for parts", "waiting_for_parts"],
];

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

function getNYParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map(p => [p.type, p.value]));
}

function buildOfflineRecordModal(meta, showOtherOptions = false, selectedStatus = null, selectedOtherStatus = null) {
  let jobId, techName, scheduledStart, contextLines, issueImageBlocks;

  if (typeof meta === "object" && meta !== null) {
    jobId          = meta.jobId;
    techName       = meta.techName;
    scheduledStart = meta.scheduledStart;
    contextLines   = meta.contextLines;
    issueImageBlocks = meta.issueImageBlocks || [];
  } else {
    try {
      const parsed = JSON.parse(meta);
      jobId          = parsed.jobId;
      techName       = parsed.techName;
      scheduledStart = parsed.scheduledStart;
      contextLines   = parsed.contextLines;
      issueImageBlocks = parsed.issueImageBlocks || [];
    } catch {
      jobId = meta;
    }
  }

  const p = getNYParts();
  const today = `${p.year}-${p.month}-${p.day}`;
  const now   = `${p.hour.padStart(2, "0")}:${p.minute}`;

  const statusInitial = selectedStatus
    ? STATUS_OPTIONS.find(([, v]) => v === selectedStatus) || null
    : null;

  const blocks = [];

  if (contextLines) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: contextLines } });
    if (issueImageBlocks.length > 0) blocks.push(...issueImageBlocks);
    blocks.push({ type: "divider" });
  }

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: `Fill in the completion details for *${techName || "technician"}* (no Slack access):` },
  });

  blocks.push(createInputBlock_date("actualStartDate", "Actual Start Date", "datepickeraction", today));
  blocks.push(createInputBlock_time("actualStartTime", "Actual Start Time", "timepickeraction", now));
  blocks.push(createInputBlock_date("actualEndDate",   "Actual End Date",   "datepickeraction", today));
  blocks.push(createInputBlock_time("actualEndTime",   "Actual End Time",   "timepickeraction", now));
  blocks.push(createInputBlock_select({ block_id: "toolCleanUp",  label: "All tools collected?",         action_id: "toolCleanUp",  options: ["Yes", "No"], initial_option: "Yes" }));
  blocks.push(createInputBlock_select({ block_id: "machineReset", label: "Power/emergency stops reset?", action_id: "machineReset", options: ["Yes", "No"], initial_option: "Yes" }));
  blocks.push({
    type: "input",
    block_id: "reason_defect_block",
    label: { type: "plain_text", text: "What is the cause of this issue?" },
    element: {
      type: "static_select",
      action_id: "reason_defect",
      placeholder: { type: "plain_text", text: "Select cause" },
      options: CAUSE_OPTIONS,
    },
  });
  blocks.push(createMultiInputBlock("completionNotes", "What was done", "completionNotes", `Describe what ${techName || "the technician"} did...`));
  blocks.push({
    type: "input",
    block_id: "checkDetail",
    optional: true,
    label: { type: "plain_text", text: "Check detail (optional)" },
    element: {
      type: "plain_text_input",
      action_id: "checkDetail",
      multiline: true,
      placeholder: { type: "plain_text", text: "Additional observations from your inspection..." },
    },
  });
  blocks.push({
    type: "input",
    block_id: "whoCleanUp",
    optional: true,
    label: { type: "plain_text", text: "Other people who helped clean the area (optional)" },
    element: {
      type: "plain_text_input",
      action_id: "whoCleanUp",
      placeholder: { type: "plain_text", text: "Names of additional helpers" },
    },
  });

  blocks.push(createInputBlock_date("checkDate", "Check Date (when supervisor reviewed)", "datepickeraction", today));
  blocks.push(createInputBlock_time("checkTime", "Check Time", "timepickeraction", now));

  blocks.push(createInputBlock_radio({
    block_id: "offline_complete_job",
    label: "Complete Job or Other Situation",
    action_id: "offline_complete_job",
    dispatch_action: true,
    options: STATUS_OPTIONS,
    initial_option: statusInitial,
  }));

  if (showOtherOptions) {
    const otherInitial = selectedOtherStatus
      ? OTHER_SITUATION_OPTIONS.find(([, v]) => v === selectedOtherStatus) || null
      : null;
    blocks.push(createInputBlock_radio({
      block_id: "offline_other_status",
      label: "Other Situation",
      action_id: "offline_other_status",
      options: OTHER_SITUATION_OPTIONS,
      initial_option: otherInitial,
    }));
  }

  blocks.push(createInputBlock_pic("finishPicture", "Completion photos", "file_input_action_id_1"));

  const metaStr = typeof meta === "string" ? meta : JSON.stringify(meta);

  return {
    type: "modal",
    callback_id: "offlineRecord",
    private_metadata: metaStr,
    title: { type: "plain_text", text: `Record: ${techName || ""}`.slice(0, 24), emoji: true },
    submit: { type: "plain_text", text: "Submit Record", emoji: true },
    close:  { type: "plain_text", text: "Cancel",        emoji: true },
    blocks,
  };
}

async function openModal_offline_record(trigger_id, jobId, techName, channel, messageTs) {
  const p = getNYParts();
  const today = `${p.year}-${p.month}-${p.day}`;
  const now   = `${p.hour.padStart(2, "0")}:${p.minute}`;

  const snap = await db.ref(`jobs/Release/Regular/${jobId}`).once("value");
  const job  = snap.val() || {};

  const locationParts = [job.area, job.machineLine, job.equipmentName].filter(Boolean);
  const locationStr   = locationParts.length ? locationParts.join(" › ") : "N/A";
  const issuePics     = Array.isArray(job.issuePicture) ? job.issuePicture : [];

  const issueImageBlocks = issuePics.slice(0, 5).map((url, i) => {
    const fileId = url.match(/-(F[A-Z0-9]+)\//i)?.[1];
    if (!fileId) return null;
    return { type: "image", slack_file: { id: fileId }, alt_text: `Issue photo ${i + 1}` };
  }).filter(Boolean);

  const contextLines = [
    `📍 *${locationStr}*`,
    job.description ? `📝 ${job.description}` : null,
    `🗓 Scheduled: ${job.scheduledStart?.slice(0, 10) || "N/A"}  ·  Ordered by: ${job.orderedBy || "N/A"}`,
  ].filter(Boolean).join("\n");

  const meta = {
    jobId,
    techName,
    scheduledStart: job.scheduledStart || null,
    contextLines,
    issueImageBlocks,
    channel:   channel   || null,
    messageTs: messageTs || null,
  };

  await client.views.open({
    trigger_id,
    view: buildOfflineRecordModal(meta),
  });
}

module.exports = openModal_offline_record;
module.exports.buildOfflineRecordModal = buildOfflineRecordModal;
