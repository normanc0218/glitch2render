const { WebClient } = require("@slack/web-api");
const { getPool, sql } = require("../db-sql");
const {
  createInputBlock,
  createInputBlock_pic,
  createInputBlock_date,
  createInputBlock_time,
  createInputBlock_radio,
  createTextSection,
} = require("../utils/blockBuilder");
const userConfig = require("../services/slackUserService");

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

async function fetchSqlTask(taskId) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.UniqueIdentifier, taskId)
      .query(`
        SELECT t.id, t.title, t.scheduled_start, t.scheduled_end,
               t.is_all_day, t.status, t.description, t.issue_picture,
               tech.name AS technician_name,
               STRING_AGG(COALESCE(e.equipment_name, te.equipment_id), ', ') AS equipment_ids
        FROM Tasks t
        LEFT JOIN Technicians tech ON t.technician_id = tech.id
        LEFT JOIN TaskEquipment te ON te.task_id = t.id
        LEFT JOIN Equipment e ON e.equipment_id = te.equipment_id
        WHERE t.id = @id
        GROUP BY t.id, t.title, t.scheduled_start, t.scheduled_end,
                 t.is_all_day, t.status, t.description, t.issue_picture, tech.name
      `);
    return result.recordset[0] || null;
  } catch (err) {
    console.error("fetchSqlTask error:", err.message);
    return null;
  }
}

const openModal_daily_update = async (trigger_id, jobId) => {
  const isSqlTask = jobId.startsWith("sql:");
  const taskId = isSqlTask ? jobId.slice(4) : null;

  const p = getNYParts();
  const initialDate = `${p.year}-${p.month}-${p.day}`;
  const initialTime = `${p.hour.padStart(2, "0")}:${p.minute}`;

  // Computed fresh each call so the cache is warm and the list is current
  const superNameOptions = Object.keys(userConfig.Supervisors).map(name => [name, name]);

  const blocks = [];

  if (isSqlTask) {
    const task = await fetchSqlTask(taskId);
    if (task) {
      const toDate = (v) => { if (!v) return null; const d = v instanceof Date ? v : new Date(v); return isNaN(d) ? null : d; };
      const fmtLocalDate = (d) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : null;
      const fmtLocalTime = (d) => d ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : null;

      const startDt  = toDate(task.scheduled_start);
      const endDt    = toDate(task.scheduled_end);
      const dateStr  = fmtLocalDate(startDt) || "N/A";
      const isAllDay = task.is_all_day;

      let timeRange = "";
      if (!isAllDay && startDt) {
        const startT = fmtLocalTime(startDt);
        const endT   = fmtLocalTime(endDt);
        timeRange = endT ? `  🕐 ${startT} – ${endT}` : `  🕐 ${startT}`;
      }

      blocks.push(createTextSection(`*${task.title}*`));
      blocks.push(createTextSection(`📅 ${dateStr}${timeRange}`));
      blocks.push(createTextSection(`📍 ${task.equipment_ids || "N/A"}  •  Status: ${task.status}`));
      if (task.description) blocks.push(createTextSection(task.description));

      if (task.issue_picture) {
        try {
          const urls = JSON.parse(task.issue_picture);
          if (Array.isArray(urls) && urls.length > 0) {
            blocks.push(createTextSection("*Issue Pictures:*"));
            urls.slice(0, 5).forEach((url, i) => {
              blocks.push({ type: "image", image_url: url, alt_text: `Issue picture ${i + 1}` });
            });
          }
        } catch { /* not a JSON array — skip */ }
      }
      blocks.push({ type: "divider" });
    }
  }

  blocks.push(
    createInputBlock_pic("finishPicture", "Picture of your job update (optional)", "file_general_input", true),
    createInputBlock("supervisor_message", "Comments", "supervisor_message", "Comments or notes about this task"),
    ...(superNameOptions.length > 0 ? [createInputBlock_radio({
      block_id: "supervisor_notify",
      label: "Notify the supervisor",
      action_id: "supervisor_notify",
      options: superNameOptions,
    })] : []),
    createInputBlock_date("startDate", "Actual Start Date", "datepickeraction", initialDate, initialDate),
    createInputBlock_time("startTime", "Actual Start Time", "timepickeraction", initialTime),
    createInputBlock_date("endDate", "Actual End Date", "datepickeraction", initialDate, initialDate),
    createInputBlock_time("endTime", "Actual End Time", "timepickeraction", initialTime),
  );

  await client.views.open({
    trigger_id,
    view: {
      type: "modal",
      callback_id: "update_daily",
      private_metadata: jobId,
      title: { type: "plain_text", text: isSqlTask ? "Update PM Task" : "Update Your Job", emoji: true },
      submit: { type: "plain_text", text: "Submit", emoji: true },
      close: { type: "plain_text", text: "Cancel", emoji: true },
      blocks,
    },
  });
};

module.exports = openModal_daily_update;
