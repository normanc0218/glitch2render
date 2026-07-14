const { WebClient } = require("@slack/web-api");
const { getPool, sql } = require("../db-sql");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function fetchProject(projectId) {
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input("id", sql.UniqueIdentifier, projectId)
      .query(`
        SELECT p.id, p.title, p.status, p.priority,
               p.scheduled_start, p.scheduled_end,
               p.actual_start, p.actual_end,
               p.machine_location,
               p.source_rtdb_job_id,
               p.description, p.done_by, p.check_date,
               p.notify_supervisor, p.message_to_supervisor,
               p.issue_picture, p.finish_picture,
               tech.name AS technician_name,
               (SELECT TOP 1 pe.equipment_id   FROM ProjectEquipment pe WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_id,
               (SELECT TOP 1 e.area            FROM ProjectEquipment pe JOIN Equipment e ON e.equipment_id = pe.equipment_id WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_area,
               (SELECT TOP 1 e.machine_line    FROM ProjectEquipment pe JOIN Equipment e ON e.equipment_id = pe.equipment_id WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_machine_line,
               (SELECT TOP 1 e.equipment_name  FROM ProjectEquipment pe JOIN Equipment e ON e.equipment_id = pe.equipment_id WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_name,
               (SELECT TOP 1 pe.equipment_other FROM ProjectEquipment pe WHERE pe.project_id = p.id AND pe.equipment_other IS NOT NULL) AS equipment_other
        FROM Projects p
        LEFT JOIN Technicians tech ON p.technician_id = tech.id
        WHERE p.id = @id
      `);
    return r.recordset[0] || null;
  } catch (err) {
    console.error("fetchProject error:", err.message);
    return null;
  }
}

function fmt(d) {
  if (!d) return "N/A";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return "N/A";
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const dy = String(dt.getDate()).padStart(2, '0');
  const h  = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${dy} ${h}:${mi}`;
}

function buildProjectDetailBlocks(project) {
  if (!project) return [{ type: "section", text: { type: "mrkdwn", text: "_Project not found._" } }];

  const equipPath = project.equipment_area
    ? [project.equipment_area, project.equipment_machine_line, project.equipment_id].filter(Boolean).join(' > ')
    : (project.equipment_other || project.machine_location || 'N/A');
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${project.title}*\n📍 ${equipPath}  •  Priority: ${project.priority || "N/A"}\nAssigned: ${project.technician_name || "N/A"}`,
      },
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `Project ID: \`${project.id}\`` },
        ...(project.source_rtdb_job_id
          ? [{ type: "mrkdwn", text: `Source Job: \`${project.source_rtdb_job_id}\`` }]
          : []),
      ],
    },
    { type: "divider" },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Status:*\n${project.status || "N/A"}` },
        { type: "mrkdwn", text: `*Done by:*\n${project.done_by || "N/A"}` },
        { type: "mrkdwn", text: `*Scheduled Start:*\n${fmt(project.scheduled_start)}` },
        { type: "mrkdwn", text: `*Scheduled End:*\n${fmt(project.scheduled_end)}` },
        { type: "mrkdwn", text: `*Actual Start:*\n${fmt(project.actual_start)}` },
        { type: "mrkdwn", text: `*Actual End:*\n${fmt(project.actual_end)}` },
      ],
    },
  ];

  if (project.check_date) {
    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Supervisor Check:*\n${fmt(project.check_date)}` },
        { type: "mrkdwn", text: `*Notified:*\n${project.notify_supervisor || "N/A"}` },
      ],
    });
  }

  if (project.description) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Description:*\n${project.description}` } });
  }

  if (project.message_to_supervisor) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Message to Supervisor:*\n${project.message_to_supervisor}` } });
  }

  if (project.issue_picture) {
    try {
      const urls = JSON.parse(project.issue_picture);
      if (Array.isArray(urls) && urls.length > 0) {
        blocks.push({ type: "divider" });
        blocks.push({ type: "section", text: { type: "mrkdwn", text: "*Issue Pictures:*" } });
        urls.slice(0, 5).forEach((url, i) => {
          blocks.push({ type: "image", image_url: url, alt_text: `Issue ${i + 1}` });
        });
      }
    } catch { /* not JSON array */ }
  }

  if (project.finish_picture) {
    try {
      const urls = JSON.parse(project.finish_picture);
      if (Array.isArray(urls) && urls.length > 0) {
        blocks.push({ type: "divider" });
        blocks.push({ type: "section", text: { type: "mrkdwn", text: "*Finish Pictures:*" } });
        urls.slice(0, 5).forEach((url, i) => {
          blocks.push({ type: "image", image_url: url, alt_text: `Finish ${i + 1}` });
        });
      }
    } catch { /* not JSON array */ }
  }

  return blocks;
}

const openModal_sql_project_view = async (trigger_id, projectId) => {
  const project = await fetchProject(projectId);
  await client.views.open({
    trigger_id,
    view: {
      type: "modal",
      callback_id: "sql_project_view",
      title: { type: "plain_text", text: "Project Details" },
      close: { type: "plain_text", text: "Close" },
      blocks: buildProjectDetailBlocks(project),
    },
  });
};

const pushModal_sql_project_view = async (trigger_id, projectId) => {
  const project = await fetchProject(projectId);
  await client.views.push({
    trigger_id,
    view: {
      type: "modal",
      callback_id: "sql_project_view",
      title: { type: "plain_text", text: "Project Details" },
      close: { type: "plain_text", text: "Close" },
      blocks: buildProjectDetailBlocks(project),
    },
  });
};

module.exports = openModal_sql_project_view;
module.exports.pushModal_sql_project_view = pushModal_sql_project_view;
