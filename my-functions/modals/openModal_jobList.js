const { WebClient } = require("@slack/web-api");
const db = require("../db");
const { getPool } = require("../db-sql");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const PAGE_SIZE = 20;

const fmtDate = (d) => {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

async function getPromotedIds() {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT source_rtdb_job_id FROM Projects WHERE source_rtdb_job_id IS NOT NULL`
    );
    return new Set(r.recordset.map(row => row.source_rtdb_job_id));
  } catch { return new Set(); }
}

async function fetchRegularJobs(tab) {
  const [snap, promotedIds] = await Promise.all([
    db.ref("jobs/Release/Regular").once("value"),
    getPromotedIds(),
  ]);
  const raw = snap.val() || {};
  return Object.entries(raw)
    .map(([id, job]) => ({ ...job, id }))
    .filter(j => {
      if (promotedIds.has(j.id)) return false;
      const s = (j.status || "").toLowerCase();
      return tab === 'unfinished' ? !s.includes("checked") : s.includes("checked");
    })
    .slice(0, 50);
}

async function fetchProjects(tab) {
  const pool = await getPool();
  const isFinished = tab === 'finished';
  // Projects has no equipment_id column of its own — equipment is linked via
  // the ProjectEquipment junction table (same pattern as Tasks/TaskEquipment),
  // with equipment_other covering "not in the equipment list" projects.
  const r = await pool.request().query(`
    SELECT TOP 50 p.id, p.title, p.status,
           p.scheduled_start, p.scheduled_end,
           tech.name AS technician_name,
           (SELECT TOP 1 pe.equipment_id    FROM ProjectEquipment pe WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_id,
           (SELECT TOP 1 e.equipment_name   FROM ProjectEquipment pe JOIN Equipment e ON e.equipment_id = pe.equipment_id WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_name,
           (SELECT TOP 1 pe.equipment_other FROM ProjectEquipment pe WHERE pe.project_id = p.id AND pe.equipment_other IS NOT NULL) AS equipment_other
    FROM Projects p
    LEFT JOIN Technicians tech ON p.technician_id = tech.id
    WHERE p.status ${isFinished
      ? `IN ('Checked by Supervisor', 'Completed', 'Cancelled')`
      : `NOT IN ('Checked by Supervisor', 'Completed', 'Cancelled')`}
    ORDER BY p.scheduled_start ${isFinished ? 'DESC' : 'ASC'}
  `);
  return r.recordset;
}

async function fetchTasks(tab) {
  const pool = await getPool();
  const isFinished = tab === 'finished';
  const r = await pool.request().query(`
    SELECT TOP 50 t.id, t.title, t.status,
           t.scheduled_start, t.scheduled_end,
           tech.name AS technician_name,
           STRING_AGG(COALESCE(e.equipment_name, te.equipment_id), ', ') AS equipment_ids
    FROM Tasks t
    LEFT JOIN Technicians tech ON t.technician_id = tech.id
    LEFT JOIN TaskEquipment te ON te.task_id = t.id
    LEFT JOIN Equipment e ON e.equipment_id = te.equipment_id
    WHERE t.status ${isFinished
      ? `IN ('checked by supervisor', 'completed')`
      : `NOT IN ('checked by supervisor', 'completed')`}
    GROUP BY t.id, t.title, t.status, t.scheduled_start, t.scheduled_end, tech.name
    ORDER BY t.scheduled_start ${isFinished ? 'DESC' : 'ASC'}
  `);
  return r.recordset;
}

async function fetchJobs(type, tab) {
  if (type === 'Regular') return fetchRegularJobs(tab);
  if (type === 'Project') return fetchProjects(tab);
  return fetchTasks(tab);
}

function buildJobBlock(type, job) {
  if (type === 'Regular') {
    const s = (job.status || "").toLowerCase();
    const emoji = s.includes("checked") ? "✅" : s.includes("complete") ? "🕓" : "⚙️";
    // This is a browse/history list open to every user regardless of role —
    // never show an action button here, only View. Approving happens from
    // the Home tab, scoped to the notified supervisor.
    const actionBtn = { type: "button", text: { type: "plain_text", text: "View" }, value: job.id, action_id: "openModal_viewDetail" };
    const assigned = Array.isArray(job.assignedTo) ? job.assignedTo.join(', ') : (job.assignedTo || "Unassigned");
    const date = (job.scheduledStart || job.actualStart || "").slice(0, 10) || "N/A";
    return {
      type: "section",
      text: { type: "mrkdwn", text: `${emoji} *${job.id}*\n${job.description || "Untitled"}\n📍 ${job.equipmentName || "N/A"}  •  🧑 ${assigned}  •  🗓 ${date}\n⚙️ ${job.status || "Pending"}` },
      accessory: actionBtn,
    };
  } else if (type === 'Project') {
    const s = (job.status || "").toLowerCase();
    const emoji = s.includes("checked") || s.includes("completed") ? "✅" : "🏗️";
    const location = job.equipment_name || job.equipment_id || job.equipment_other || "N/A";
    const start = fmtDate(job.scheduled_start) || "N/A";
    const end = fmtDate(job.scheduled_end) || "N/A";
    return {
      type: "section",
      text: { type: "mrkdwn", text: `${emoji} *${job.title}*\n📍 ${location}  •  Start: ${start}  •  Due: ${end}\n🧑 ${job.technician_name || "Unassigned"}  •  ⚙️ ${job.status}` },
      accessory: { type: "button", text: { type: "plain_text", text: "View" }, value: String(job.id), action_id: "view_sql_project_detail" },
    };
  } else {
    const s = (job.status || "").toLowerCase();
    const emoji = s.includes("checked") || s.includes("completed") ? "✅" : "🔧";
    const start = fmtDate(job.scheduled_start) || "N/A";
    return {
      type: "section",
      text: { type: "mrkdwn", text: `${emoji} *${job.title}*\n📍 ${job.equipment_ids || "N/A"}  •  ${start}\n🧑 ${job.technician_name || "Unassigned"}  •  ⚙️ ${job.status}` },
      accessory: { type: "button", text: { type: "plain_text", text: "View" }, value: String(job.id), action_id: "view_sql_task_detail" },
    };
  }
}

const TYPE_TITLES = { Regular: '📋 Regular Jobs', Project: '🏗️ Projects', Task: '🔧 PM Tasks' };

function buildJobListView(type, tab, page, jobs) {
  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const pageJobs = jobs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const isUnfinished = tab === 'unfinished';

  const blocks = [
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: isUnfinished ? "▶ Unfinished" : "Unfinished" },
          action_id: "job_list_tab_unfinished",
          value: JSON.stringify({ type, tab: 'unfinished', page: 0 }),
          ...(isUnfinished ? { style: "primary" } : {}),
        },
        {
          type: "button",
          text: { type: "plain_text", text: !isUnfinished ? "▶ Finished" : "Finished" },
          action_id: "job_list_tab_finished",
          value: JSON.stringify({ type, tab: 'finished', page: 0 }),
          ...(!isUnfinished ? { style: "primary" } : {}),
        },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${jobs.length} job${jobs.length !== 1 ? 's' : ''}* — Page ${page + 1}/${totalPages}` },
    },
    { type: "divider" },
  ];

  if (pageJobs.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `_No ${isUnfinished ? 'unfinished' : 'finished'} jobs found._` },
    });
  } else {
    for (const job of pageJobs) {
      blocks.push(buildJobBlock(type, job));
      blocks.push({ type: "divider" });
    }
  }

  const navElements = [];
  if (page > 0) {
    navElements.push({
      type: "button",
      text: { type: "plain_text", text: "◀ Prev" },
      action_id: "job_list_page",
      value: JSON.stringify({ type, tab, page: page - 1 }),
    });
  }
  if (page < totalPages - 1) {
    navElements.push({
      type: "button",
      text: { type: "plain_text", text: "▶ Next" },
      action_id: "job_list_page",
      value: JSON.stringify({ type, tab, page: page + 1 }),
    });
  }
  if (navElements.length > 0) blocks.push({ type: "actions", elements: navElements });

  return {
    type: "modal",
    callback_id: "job_list_modal",
    title: { type: "plain_text", text: TYPE_TITLES[type] },
    close: { type: "plain_text", text: "Close" },
    private_metadata: JSON.stringify({ type, tab, page }),
    blocks,
  };
}

async function openJobList(trigger_id, type) {
  const loadingResult = await client.views.open({
    trigger_id,
    view: {
      type: "modal",
      callback_id: "job_list_modal",
      title: { type: "plain_text", text: TYPE_TITLES[type] },
      close: { type: "plain_text", text: "Close" },
      private_metadata: JSON.stringify({ type, tab: 'unfinished', page: 0 }),
      blocks: [{ type: "section", text: { type: "mrkdwn", text: "⏳ Loading jobs..." } }],
    },
  });
  const view_id = loadingResult.view?.id;
  if (!view_id) return;

  try {
    const jobs = await fetchJobs(type, 'unfinished');
    await client.views.update({ view_id, view: buildJobListView(type, 'unfinished', 0, jobs) });
  } catch (err) {
    console.error(`openJobList(${type}) fetch error:`, err.message);
    await client.views.update({
      view_id,
      view: {
        type: "modal",
        callback_id: "job_list_modal",
        title: { type: "plain_text", text: TYPE_TITLES[type] },
        close: { type: "plain_text", text: "Close" },
        private_metadata: JSON.stringify({ type, tab: 'unfinished', page: 0 }),
        blocks: [{ type: "section", text: { type: "mrkdwn", text: "❌ Failed to load jobs. Please try again." } }],
      },
    });
  }
}

async function updateJobList(view_id, type, tab, page) {
  try {
    const jobs = await fetchJobs(type, tab);
    await client.views.update({ view_id, view: buildJobListView(type, tab, page, jobs) });
  } catch (err) {
    console.error(`updateJobList(${type}) error:`, err.message);
  }
}

module.exports = { openJobList, updateJobList };
