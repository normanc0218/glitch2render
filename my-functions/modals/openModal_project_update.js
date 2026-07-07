const { WebClient } = require("@slack/web-api");
const userConfig = require("../services/slackUserService");
const { getPool, sql } = require("../db-sql");
const {
  createInputBlock,
  createInputBlock_pic,
  createInputBlock_date,
  createInputBlock_time,
  createInputBlock_radio,
  createTextSection,
  createDivider,
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

function fmtDate(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

async function fetchProject(projectId) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.UniqueIdentifier, projectId)
      .query(`
        SELECT p.title, p.description, p.status,
               p.machine_location, p.equipment_id,
               p.scheduled_start, p.scheduled_end,
               e.equipment_name,
               tech.name AS technician_name
        FROM Projects p
        LEFT JOIN Equipment e ON e.equipment_id = p.equipment_id
        LEFT JOIN Technicians tech ON tech.id = p.technician_id
        WHERE p.id = @id
      `);
    return result.recordset[0] || null;
  } catch (err) {
    console.error("fetchProject error:", err.message);
    return null;
  }
}

const openModal_project_update = async (trigger_id, jobId) => {
  await userConfig.refreshIfStale();

  const p = getNYParts();
  const initialDate = `${p.year}-${p.month}-${p.day}`;
  const initialTime = `${p.hour.padStart(2, "0")}:${p.minute}`;

  const superOptions = Object.keys(userConfig.Supervisors).map(name => [name, name]);

  const project = await fetchProject(jobId);

  const blocks = [];

  if (project) {
    const location  = project.equipment_name || project.equipment_id || project.machine_location || "N/A";
    const startStr  = fmtDate(project.scheduled_start)  || "N/A";
    const dueStr    = fmtDate(project.scheduled_end)    || "N/A";
    const desc      = project.description || "";
    blocks.push(createTextSection(
      `*${project.title}*  •  ${project.status}\n📍 ${location}  •  Start: ${startStr}  •  Due: ${dueStr}${desc ? `\n📋 ${desc}` : ""}`
    ));
    blocks.push(createDivider());
  }

  blocks.push(createInputBlock_pic("finishPicture", "Picture of Your Job Update", "file_input_action_id_1"));
  blocks.push(createInputBlock("supervisor_message", "Comments", "supervisor_message", "comments"));
  blocks.push(createInputBlock_radio({
    block_id: "supervisor_notify",
    label: "Notify the supervisor",
    action_id: "supervisor_notify",
    options: superOptions,
  }));
  blocks.push(createInputBlock_date("startDate", "Actual Start Date", "datepickeraction", initialDate));
  blocks.push(createInputBlock_time("startTime", "Actual Start Time", "timepickeraction", initialTime));
  blocks.push(createInputBlock_date("endDate", "Actual End Date", "datepickeraction", initialDate));
  blocks.push(createInputBlock_time("endTime", "Actual End Time", "timepickeraction", initialTime));

  await client.views.open({
    trigger_id,
    view: {
      type: "modal",
      callback_id: "update_project",
      private_metadata: jobId,
      title:  { type: "plain_text", text: "Update Your Job" },
      submit: { type: "plain_text", text: "Submit" },
      close:  { type: "plain_text", text: "Cancel" },
      blocks,
    },
  });
};

module.exports = openModal_project_update;
