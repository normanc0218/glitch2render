const axios = require("axios");
const { getPool, sql } = require("../db-sql");
const { buildCascadeBlocks } = require("../utils/orderModalBuilder");
const {
  createInputBlock,
  createMultiInputBlock,
  createInputBlock_select,
  createInputBlock_pic,
  createInputBlock_date,
  createInputBlock_time,
} = require("../utils/blockBuilder");
const userConfig = require("../services/slackUserService");

function getNYDate() {
  const d = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [m, dy, y] = d.split("/");
  return `${y}-${m}-${dy}`;
}

function getNYTime() {
  const d = new Date();
  const ny = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return `${ny.getHours().toString().padStart(2, "0")}:${ny.getMinutes().toString().padStart(2, "0")}`;
}

async function openModal_offline_job(trigger_id) {
  // Non-Slack techs = in Technicians table but not in SlackUsers maintenanceStaff
  const pool = await getPool();
  const { recordset } = await pool.request().query(
    `SELECT name FROM Technicians WHERE active = 1 ORDER BY name`
  );
  const slackNames  = new Set(Object.keys(userConfig.maintenanceStaff));
  const offlineTechs = recordset.map(r => r.name).filter(n => !slackNames.has(n));

  const techOptions = offlineTechs.map(name => ({
    text: { type: "plain_text", text: name },
    value: name,
  }));

  const supervisorOptions = Object.keys(userConfig.Supervisors).map(name => ({
    text: { type: "plain_text", text: name },
    value: name,
  }));

  const today = getNYDate();
  const now   = getNYTime();

  const blocks = [
    // ── Job Details ───────────────────────────────────────────────────────────
    ...buildCascadeBlocks(),
    createInputBlock("reporter", "Who found the issue?", "reporter", "Name of the finder", true),
    createMultiInputBlock("description", "Description of the issue", "issue", "What happened?"),
    {
      type: "input",
      block_id: "assignedTo",
      label: { type: "plain_text", text: "Assigned Technician (Offline)" },
      element: {
        type: "static_select",
        action_id: "assignedTo",
        placeholder: { type: "plain_text", text: "Select offline technician" },
        options: techOptions.length > 0 ? techOptions : [{ text: { type: "plain_text", text: "No offline techs found" }, value: "__none__" }],
      },
    },
    createInputBlock_date("orderDate", "Order Date", "datepickeraction", today),
    createInputBlock_time("orderTime", "Order Time", "timepickeraction", now),

    // ── Completion Record ─────────────────────────────────────────────────────
    { type: "section", text: { type: "mrkdwn", text: "*— Completion Record —*\n_Fill in what the technician did on their behalf:_" } },
    { type: "divider" },
    createInputBlock_date("actualStartDate", "Actual Start Date", "datepickeraction", today),
    createInputBlock_time("actualStartTime", "Actual Start Time", "timepickeraction", now),
    createInputBlock_date("actualEndDate", "Actual End Date", "datepickeraction", today),
    createInputBlock_time("actualEndTime", "Actual End Time", "timepickeraction", now),
    createInputBlock_select({ block_id: "toolCleanUp", label: "Tools collected?", action_id: "toolCleanUp", options: ["Yes", "No"], initial_option: "Yes" }),
    createInputBlock_select({ block_id: "machineReset", label: "Machine reset?", action_id: "machineReset", options: ["Yes", "No"], initial_option: "Yes" }),
    createMultiInputBlock("completionNotes", "What was done", "completionNotes", "Describe what the technician did...", true),
    {
      type: "input",
      block_id: "notifySupervisor",
      label: { type: "plain_text", text: "Notify Supervisor" },
      element: {
        type: "static_select",
        action_id: "notifySupervisor",
        placeholder: { type: "plain_text", text: "Select supervisor" },
        options: supervisorOptions,
      },
    },
    createInputBlock_pic("finishPicture", "Completion photos (optional)", "file_input_action_id_1", true),
  ];

  const modal = {
    type: "modal",
    callback_id: "offlineJob",
    title: { type: "plain_text", text: "Offline Tech Job" },
    submit: { type: "plain_text", text: "Submit & Close" },
    close: { type: "plain_text", text: "Cancel" },
    blocks,
  };

  const res = await axios.post(
    "https://slack.com/api/views.open",
    { trigger_id, view: modal },
    { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.SLACK_BOT_TOKEN}` } }
  );
  if (!res.data.ok) console.error("[openModal_offline_job] views.open failed:", res.data.error);
}

module.exports = openModal_offline_job;
