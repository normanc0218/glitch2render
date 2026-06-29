const { WebClient } = require("@slack/web-api");
const { getPool, sql } = require("../db-sql");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function fetchSqlTaskFull(taskId) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.UniqueIdentifier, taskId)
      .query(`
        SELECT t.id, t.title, t.description, t.scheduled_date, t.status,
               t.actual_start, t.actual_end,
               t.done_by, t.notify_supervisor, t.notes, t.finish_picture,
               tech.name AS technician_name,
               STRING_AGG(COALESCE(e.equipment_name, te.equipment_id), ', ') AS equipment_ids
        FROM Tasks t
        LEFT JOIN Technicians tech ON t.technician_id = tech.id
        LEFT JOIN TaskEquipment te ON te.task_id = t.id
        LEFT JOIN Equipment e ON e.equipment_id = te.equipment_id
        WHERE t.id = @id
        GROUP BY t.id, t.title, t.description, t.scheduled_date, t.status,
                 t.actual_start, t.actual_end,
                 t.done_by, t.notify_supervisor, t.notes, t.finish_picture, tech.name
      `);
    return result.recordset[0] || null;
  } catch (err) {
    console.error("fetchSqlTaskFull error:", err.message);
    return null;
  }
}

function fmtDate(d) {
  if (!d) return "N/A";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "N/A";
  const y = dt.getFullYear(), m = String(dt.getMonth() + 1).padStart(2, "0"), dy = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${dy}`;
}

function fmt(dt) {
  if (!dt) return "N/A";
  const d = dt instanceof Date ? dt : new Date(dt);
  if (isNaN(d)) return "N/A";
  const y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, "0"), dy = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0"), mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${dy} ${h}:${mi}`;
}

const openModal_sql_task_view = async (trigger_id, taskId) => {
  const task = await fetchSqlTaskFull(taskId);

  const blocks = [];

  if (!task) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "_Task not found._" } });
  } else {
    const scheduled = fmtDate(task.scheduled_date);

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${task.title}*\n${task.description ? `${task.description}\n` : ""}📅 Scheduled: ${scheduled}  •  📍 ${task.equipment_ids || "N/A"}\nAssigned to: ${task.technician_name || "N/A"}`,
      },
    });
    blocks.push({ type: "divider" });

    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Status:*\n${task.status}` },
        { type: "mrkdwn", text: `*Done by:*\n${task.done_by || "N/A"}` },
        { type: "mrkdwn", text: `*Actual Start:*\n${fmt(task.actual_start)}` },
        { type: "mrkdwn", text: `*Actual End:*\n${fmt(task.actual_end)}` },
        { type: "mrkdwn", text: `*Notified Supervisor:*\n${task.notify_supervisor || "N/A"}` },
      ],
    });

    if (task.notes) {
      blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Notes:*\n${task.notes}` } });
    }

    // Finish pictures
    if (task.finish_picture) {
      try {
        const urls = JSON.parse(task.finish_picture);
        if (Array.isArray(urls) && urls.length > 0) {
          blocks.push({ type: "divider" });
          blocks.push({ type: "section", text: { type: "mrkdwn", text: "*Finish Pictures:*" } });
          urls.slice(0, 5).forEach((url, i) => {
            blocks.push({ type: "image", image_url: url, alt_text: `Finish picture ${i + 1}` });
          });
        }
      } catch {
        // not a JSON array — skip
      }
    }
  }

  const needsCheck = task?.status === "completed and waiting for approval";

  await client.views.open({
    trigger_id,
    view: {
      type: "modal",
      callback_id: needsCheck ? "sql_task_check" : "sql_task_view",
      private_metadata: needsCheck ? taskId : "",
      title: { type: "plain_text", text: "PM Task Details", emoji: true },
      ...(needsCheck && { submit: { type: "plain_text", text: "Mark as Checked", emoji: true } }),
      close: { type: "plain_text", text: "Close", emoji: true },
      blocks,
    },
  });
};

module.exports = openModal_sql_task_view;
