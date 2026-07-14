const { WebClient } = require("@slack/web-api");
const db = require("../db");
const { getPool, sql } = require("../db-sql");
const userConfig = require("./slackUserService");
const token = process.env.SLACK_BOT_TOKEN;
const client = new WebClient(token);
const { createButton } = require("../utils/blockBuilder");

const fmtDate = (d) => {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return null;
  const y  = dt.getFullYear();
  const m  = String(dt.getMonth() + 1).padStart(2, '0');
  const dy = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
};

const fmtTime = (d) => {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return null;
  return dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
};

// ── RTDB in-memory caches (TTL pattern mirrors slackUserService) ─────────────

let _releaseCache    = null;
let _releaseFetchedAt = 0;
const RELEASE_TTL_MS  = 30 * 1000; // 30 s — jobs change more often than user config

async function getRelease() {
  if (_releaseCache && Date.now() - _releaseFetchedAt < RELEASE_TTL_MS) return _releaseCache;
  const snap = await db.ref("jobs/Release/Regular").once("value");
  _releaseCache     = snap.val() || {};
  _releaseFetchedAt = Date.now();
  return _releaseCache;
}

let _usersCache    = null;
let _usersFetchedAt = 0;
const USERS_TTL_MS  = 60 * 1000; // 60 s — RTDB users node changes rarely

async function getUsers() {
  if (_usersCache && Date.now() - _usersFetchedAt < USERS_TTL_MS) return _usersCache;
  const snap = await db.ref("users").once("value");
  _usersCache    = snap.val() || {};
  _usersFetchedAt = Date.now();
  return _usersCache;
}

function getUserRoles(userId) {
  const roles = [];
  const isIn = (obj) => Object.values(obj || {}).includes(userId);
  if (isIn(userConfig.managerUsers))    roles.push("manager");
  if (isIn(userConfig.Supervisors))     roles.push("supervisor");
  if (isIn(userConfig.maintenanceStaff)) roles.push("maintenance");
  if (isIn(userConfig.trainUsers))      roles.push("trainer");
  return roles.length > 0 ? roles : ["guest"];
}

// ── Azure SQL helpers ────────────────────────────────────────────────────────

async function getPromotedRtdbJobIds() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT source_rtdb_job_id FROM Projects WHERE source_rtdb_job_id IS NOT NULL`
    );
    return new Set(result.recordset.map(r => r.source_rtdb_job_id));
  } catch {
    return new Set();
  }
}

async function getProjectsPendingApproval() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT p.id, p.title, p.description, p.status,
             p.machine_location, p.equipment_id,
             p.scheduled_start, p.scheduled_end,
             p.ordered_by, p.notify_supervisor,
             p.done_by, p.updated_at
      FROM Projects p
      WHERE p.status = 'Completed and waiting for approval'
      ORDER BY p.updated_at DESC
    `);
    return result.recordset;
  } catch (err) {
    console.error("Azure SQL projects fetch error:", err.message);
    return [];
  }
}

async function getTasksForTechnician(techNames) {
  try {
    const names = Array.isArray(techNames) ? techNames : [techNames];
    if (names.length === 0) return [];

    const pool = await getPool();
    const req = pool.request();
    const placeholders = names.map((n, i) => {
      req.input(`t${i}`, sql.NVarChar, n);
      return `@t${i}`;
    }).join(", ");

    const result = await req.query(`
      SELECT t.id, t.title, t.scheduled_start, t.scheduled_end,
             t.status, t.priority, t.description,
             tech.name AS technician_name,
             STRING_AGG(COALESCE(e.equipment_name, te.equipment_id), ', ') AS equipment_ids
      FROM Tasks t
      LEFT JOIN Technicians tech ON t.technician_id = tech.id
      LEFT JOIN TaskEquipment te ON te.task_id = t.id
      LEFT JOIN Equipment e ON e.equipment_id = te.equipment_id
      WHERE t.status NOT IN ('completed and waiting for approval', 'checked by supervisor')
        AND tech.name IN (${placeholders})
        AND (
          t.scheduled_start IS NULL
          OR CAST(t.scheduled_start AS DATE) <= CAST(GETDATE() AS DATE)
        )
      GROUP BY t.id, t.title, t.scheduled_start, t.scheduled_end,
               t.status, t.priority, t.description, tech.name
      ORDER BY t.scheduled_start ASC
    `);
    return result.recordset;
  } catch (err) {
    console.error("Azure SQL tasks fetch error:", err.message);
    return [];
  }
}

async function getTasksPendingApproval() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT t.id, t.title, t.scheduled_start, t.status,
             t.done_by, t.notify_supervisor, t.description, t.updated_at,
             tech.name AS technician_name,
             STRING_AGG(COALESCE(e.equipment_name, te.equipment_id), ', ') AS equipment_ids
      FROM Tasks t
      LEFT JOIN Technicians tech ON t.technician_id = tech.id
      LEFT JOIN TaskEquipment te ON te.task_id = t.id
      LEFT JOIN Equipment e ON e.equipment_id = te.equipment_id
      WHERE t.status = 'completed and waiting for approval'
      GROUP BY t.id, t.title, t.scheduled_start, t.status,
               t.done_by, t.notify_supervisor, t.description, t.updated_at, tech.name
      ORDER BY t.updated_at DESC
    `);
    return result.recordset;
  } catch (err) {
    console.error("Azure SQL tasks pending approval error:", err.message);
    return [];
  }
}

async function getProjectsForTechnician(techNames) {
  try {
    const names = Array.isArray(techNames) ? techNames : [techNames];
    if (names.length === 0) return [];
    const pool = await getPool();
    const req  = pool.request();
    const placeholders = names.map((n, i) => {
      req.input(`pn${i}`, sql.NVarChar, n);
      return `@pn${i}`;
    }).join(", ");
    const result = await req.query(`
      SELECT p.id, p.title, p.description, p.status,
             p.machine_location, p.equipment_id,
             p.scheduled_start, p.scheduled_end,
             tech.name AS technician_name,
             e.equipment_name
      FROM Projects p
      JOIN Technicians tech ON p.technician_id = tech.id
      LEFT JOIN Equipment e ON e.equipment_id = p.equipment_id
      WHERE tech.name IN (${placeholders})
        AND p.status NOT IN ('Completed and waiting for approval','Checked by Supervisor','Cancelled','Completed')
      ORDER BY p.scheduled_start ASC
    `);
    return result.recordset;
  } catch (err) {
    console.error("Azure SQL projects for technician error:", err.message);
    return [];
  }
}

async function getUpcomingTasks() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT t.id, t.title, t.scheduled_start, t.status,
             tech.name AS technician_name,
             STRING_AGG(COALESCE(e.equipment_name, te.equipment_id), ', ') AS equipment_ids
      FROM Tasks t
      LEFT JOIN Technicians tech ON t.technician_id = tech.id
      LEFT JOIN TaskEquipment te ON te.task_id = t.id
      LEFT JOIN Equipment e ON e.equipment_id = te.equipment_id
      WHERE t.scheduled_start >= CAST(GETDATE() AS DATE)
        AND t.scheduled_start <= DATEADD(day, 3, CAST(GETDATE() AS DATE))
        AND t.status NOT IN ('completed and waiting for approval', 'checked by supervisor')
      GROUP BY t.id, t.title, t.scheduled_start, t.status, tech.name
      ORDER BY t.scheduled_start ASC
    `);
    return result.recordset;
  } catch (err) {
    console.error("Azure SQL upcoming tasks fetch error:", err.message);
    return [];
  }
}

// ── Main home tab renderer ───────────────────────────────────────────────────

async function displayHome(userId) {
  try {
    const startTime = Date.now();
    await userConfig.refreshIfStale();
    const roles = getUserRoles(userId);
    console.log(`Rendering Home for ${userId}, roles: ${roles.join(", ")}`);

    const techNames = roles.includes("maintenance")
      ? Object.entries(userConfig.maintenanceStaff).filter(([, id]) => id === userId).map(([name]) => name)
      : [];

    const supervisorName = roles.includes("supervisor")
      ? (Object.keys(userConfig.Supervisors).find(name => userConfig.Supervisors[name] === userId) || null)
      : null;

    // Parallel fetch: RTDB + Azure SQL
    const dbStart = Date.now();
    const [release, azureProjects, azureTasks, techProjects, upcomingTasks, azureTasksApproval, promotedIds, slackUserRow] = await Promise.all([
      getRelease(),
      roles.includes("supervisor") ? getProjectsPendingApproval() : Promise.resolve([]),
      techNames.length > 0 ? getTasksForTechnician(techNames) : Promise.resolve([]),
      techNames.length > 0 ? getProjectsForTechnician(techNames) : Promise.resolve([]),
      getUpcomingTasks(),
      roles.includes("supervisor") ? getTasksPendingApproval() : Promise.resolve([]),
      getPromotedRtdbJobIds(),
      (async () => {
        try {
          const pool = await getPool();
          const r = await pool.request()
            .input("slackId", sql.NVarChar, userId)
            .query("SELECT TOP 1 name, role FROM SlackUsers WHERE slack_id = @slackId AND active = 1");
          return r.recordset[0] || null;
        } catch { return null; }
      })(),
    ]);
    console.log(`📊 DB queries: ${Date.now() - dbStart}ms`);


    const buildStart = Date.now();
    const divider = { type: "divider" };

    const displayName = slackUserRow?.name || "there";
    const roleLabel   = slackUserRow?.role === "supervisor" ? "Supervisor"
      : slackUserRow?.role === "maintenance" ? "Technician"
      : slackUserRow?.role === "manager"     ? "Manager"
      : slackUserRow?.role === "trainer"     ? "Trainer"
      : "";
    const greeting = `Hi ${displayName}${roleLabel ? ` (${roleLabel})` : ""}, welcome to Maintenance Assistant`;

    let blocks = [
      { type: "header", text: { type: "plain_text", text: `👋 ${greeting}`, emoji: true } },
      divider,
    ];

    //#region Supervisor
    if (roles.includes("supervisor")) {
      blocks.push({ type: "header", text: { type: "plain_text", text: "👨‍💼 Supervisor Dashboard" } });
      blocks.push({
        type: "actions",
        elements: [
          { type: "button", text: { type: "plain_text", text: "🚚 Dispatch Job" }, style: "primary", action_id: "openModal_dispatch" },
          { type: "button", text: { type: "plain_text", text: "View Dispatch" }, action_id: "openModal_view_dispatch" },
          { type: "button", text: { type: "plain_text", text: "Submit Order" }, action_id: "openModal" },
        ],
      });
      blocks.push(divider);

      // Azure SQL PM Tasks completed, pending review — only tasks notified to this supervisor
      const myTasksApproval = azureTasksApproval.filter(t => t.notify_supervisor === supervisorName).slice(0, 10);
      if (myTasksApproval.length > 0) {
        blocks.push({ type: "section", text: { type: "mrkdwn", text: "*🔧 PM Tasks completed — pending your review:*" } });
        for (const t of myTasksApproval) {
          const date = fmtDate(t.scheduled_start) || "N/A";
          blocks.push({
            type: "section",
            text: { type: "mrkdwn", text: `*${t.title}*\nScheduled: ${date}  •  📍 ${t.equipment_ids || "N/A"}\nDone by: ${t.done_by || "N/A"}${t.description ? `  •  ${t.description}` : ""}` },
            accessory: { type: "button", text: { type: "plain_text", text: "Check and Approve" }, style: "primary", value: `sql:${t.id}`, action_id: "approve_sql_task" },
          });
        }
        blocks.push(divider);
      }

      // Azure SQL Projects pending approval — only projects notified to this supervisor
      const myProjects = azureProjects.filter(p => p.notify_supervisor === supervisorName).slice(0, 10);
      if (myProjects.length > 0) {
        blocks.push({ type: "section", text: { type: "mrkdwn", text: "*📋 Projects pending approval:*" } });
        for (const p of myProjects) {
          const date = fmtDate(p.scheduled_start) || "N/A";
          const location = p.equipment_id || p.machine_location || "N/A";
          blocks.push({
            type: "section",
            text: { type: "mrkdwn", text: `*${p.title}*\n📍 ${location}  •  Start: ${date}  •  Done by: ${p.done_by || "N/A"}` },
            accessory: { type: "button", text: { type: "plain_text", text: "Approve" }, style: "primary", value: String(p.id), action_id: "review_progress" },
          });
        }
        blocks.push(divider);
      }

      // RTDB Regular jobs pending approval (existing flow — excludes promoted jobs)
      const rtdbFinished = Object.entries(release || {})
        .map(([id, job]) => ({ ...job, id }))
        .filter(j => {
          if (promotedIds.has(j.id)) return false;
          const s = (j.status || "").toLowerCase();
          return (s.includes("waiting") || s.includes("completed")) && userConfig.Supervisors[j.notifySupervisor] === userId;
        })
        .slice(0, 10);

      if (rtdbFinished.length > 0) {
        blocks.push({ type: "section", text: { type: "mrkdwn", text: "*📋 Regular jobs pending your approval:*" } });
        for (const job of rtdbFinished) {
          blocks.push({
            type: "section",
            text: { type: "mrkdwn", text: `*${job.id}* — ${job.description || " "}\n📍 ${job.equipmentName || "N/A"}  •  ${job.scheduledStart?.slice(0, 10) || ""}  •  ${job.status || ""}` },
            accessory: { type: "button", text: { type: "plain_text", text: "Approve" }, style: "primary", value: job.id, action_id: "review_progress" },
          });
        }
        blocks.push(divider);
      }

      if (myTasksApproval.length === 0 && myProjects.length === 0 && rtdbFinished.length === 0) {
        blocks.push({ type: "section", text: { type: "mrkdwn", text: "_No jobs waiting for approval._" } });
      }
    }
    //#endregion

    //#region Maintenance
    if (roles.includes("maintenance")) {
      blocks.push({ type: "header", text: { type: "plain_text", text: "🧰 My Assigned Jobs" } });

      // PM Tasks assigned to this technician (limit 5)
      if (azureTasks.length > 0) {
        blocks.push({ type: "section", text: { type: "mrkdwn", text: "*PM Tasks:*" } });
        for (const task of azureTasks.slice(0, 5)) {
          const date      = fmtDate(task.scheduled_start) || "N/A";
          const startTime = fmtTime(task.scheduled_start);
          const endTime   = fmtTime(task.scheduled_end);
          const timeRange = startTime && endTime ? ` ${startTime} – ${endTime}` : startTime ? ` ${startTime}` : "";
          blocks.push({
            type: "section",
            text: { type: "mrkdwn", text: `*${task.title}*  •  ${task.status}\n${date}${timeRange}  •  📍 ${task.equipment_ids || "N/A"}${task.description ? `\n${task.description}` : ""}` },
            accessory: { type: "button", text: { type: "plain_text", text: "Update Task" }, style: "primary", value: `sql:${task.id}`, action_id: "update_daily_job" },
          });
        }
        blocks.push(divider);
      }

      // Projects assigned to this technician (limit 5)
      if (techProjects.length > 0) {
        blocks.push({ type: "section", text: { type: "mrkdwn", text: "*Projects:*" } });
        for (const p of techProjects.slice(0, 5)) {
          const location = p.equipment_name || p.equipment_id || p.machine_location || "N/A";
          const startStr = fmtDate(p.scheduled_start) || "N/A";
          const endStr   = fmtDate(p.scheduled_end)   || "N/A";
          blocks.push({
            type: "section",
            text: { type: "mrkdwn", text: `*${p.title}*  •  ${p.status}\n📍 ${location}  •  Start: ${startStr}  •  Due: ${endStr}${p.description ? `\n${p.description}` : ""}` },
            accessory: { type: "button", text: { type: "plain_text", text: "Update Project" }, style: "primary", value: String(p.id), action_id: "update_project" },
          });
        }
        blocks.push(divider);
      }

      // RTDB Regular jobs — excludes promoted, only jobs assigned to this technician (limit 5)
      const regularJobs = Object.entries(release || {})
        .map(([id, job]) => ({ ...job, id }))
        .filter(job => {
          if (promotedIds.has(job.id)) return false;
          const s = (job.status || "").toLowerCase();
          if (["complete", "completed", "approved", "rejected", "checked", "promoted"].some(w => s.includes(w))) return false;
          const assignedNames = Array.isArray(job.assignedTo) ? job.assignedTo : [job.assignedTo];
          return assignedNames.some(name => userConfig.maintenanceStaff[name] === userId);
        })
        .slice(0, 5);

      if (regularJobs.length > 0) {
        blocks.push({ type: "section", text: { type: "mrkdwn", text: "*Regular Jobs:*" } });
        for (const job of regularJobs) {
          blocks.push({
            type: "section",
            text: { type: "mrkdwn", text: `*${job.id}* — ${job.description || " "} — ${job.status || "Pending"}\n📍 ${job.equipmentName || "N/A"}  •  ${job.scheduledStart?.slice(0, 10) || ""}` },
            accessory: { type: "button", text: { type: "plain_text", text: "View" }, value: job.id, action_id: "openModal_viewDetail_home" },
          });
          if (job.status === "Pending") {
            blocks.push({
              type: "actions",
              elements: [
                { type: "button", text: { type: "plain_text", text: "Accept" }, style: "primary", value: job.id, action_id: "accept_task" },
                { type: "button", text: { type: "plain_text", text: "Plan When?" }, value: job.id, action_id: "plan_accept" },
                { type: "button", text: { type: "plain_text", text: "Reject" }, style: "danger", value: job.id, action_id: "reject_task" },
              ],
            });
          } else if (job.status === "Accepted") {
            blocks.push({
              type: "actions",
              elements: [
                { type: "button", text: { type: "plain_text", text: "Update Progress" }, style: "primary", value: job.id, action_id: "update_progress" },
              ],
            });
          }
        }
        blocks.push(divider);
      }

      if (azureTasks.length === 0 && techProjects.length === 0 && regularJobs.length === 0) {
        blocks.push({ type: "section", text: { type: "mrkdwn", text: "_No assigned jobs currently._" } });
        blocks.push(divider);
      }
    }
    //#endregion

    //#region Job List Buttons (all non-guest roles)
    if (!roles.includes("guest")) {
      blocks.push({ type: "section", text: { type: "mrkdwn", text: "*Browse Jobs:*" } });
      blocks.push({
        type: "actions",
        elements: [
          { type: "button", text: { type: "plain_text", text: "📋 Regular Jobs" }, action_id: "open_job_list_regular" },
          { type: "button", text: { type: "plain_text", text: "🏗️ Projects" }, action_id: "open_job_list_project" },
          { type: "button", text: { type: "plain_text", text: "🔧 PM Tasks" }, action_id: "open_job_list_task" },
        ],
      });
      blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: "_Tap a button to browse jobs. Each list shows up to 50, split into Unfinished / Finished tabs._" }] });
      blocks.push(divider);
    }
    //#endregion

    //#region Trainer
    if (roles.includes("trainer")) {
      blocks.push({ type: "header", text: { type: "plain_text", text: "👨‍🔧 Maintenance Trainer Dashboard" } });
      blocks.push({ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "🛠️ Submit Training Record" }, style: "primary", action_id: "openModal_submit_training" }] });
      blocks.push(divider);
    }
    //#endregion

    //#region Guest
    if (roles.includes("guest")) {
      blocks.push({ type: "section", text: { type: "mrkdwn", text: "_Welcome! Please contact admin to assign your role._" } });
    }
    //#endregion

    //#region Calendar Overview (next 3 days)
    try {
      const todayMs = new Date().setHours(0, 0, 0, 0);
      const dayMs = 86400000;

      // Build date → jobs map for next 3 days
      const dayMap = {};
      for (let i = 0; i < 3; i++) {
        const d = new Date(todayMs + i * dayMs);
        const key = fmtDate(d);
        dayMap[key] = [];
      }

      // RTDB Regular jobs
      Object.entries(release || {}).forEach(([id, job]) => {
        const date = (job.actualStart || job.scheduledStart)?.slice(0, 10);
        if (date && dayMap[date]) {
          dayMap[date].push({
            description: job.description || "Untitled",
            assigned: (Array.isArray(job.assignedTo) ? job.assignedTo.join(', ') : job.assignedTo) || 'Unassigned',
            location: job.equipmentName || "N/A",
            source: "Regular",
          });
        }
      });

      // Azure SQL PM Tasks
      upcomingTasks.forEach(t => {
        const date = fmtDate(t.scheduled_start);
        if (date && dayMap[date]) {
          dayMap[date].push({
            description: t.title,
            assigned: t.technician_name || "Unassigned",
            location: t.equipment_ids || "N/A",
            source: "PM",
          });
        }
      });

      const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      const calendarText = Object.entries(dayMap).map(([dateStr, jobs]) => {
        const d = new Date(dateStr + "T00:00:00");
        const label = `*${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}*`;
        if (jobs.length === 0) return `${label}\n_No jobs scheduled_`;
        const lines = jobs.map(j => `• [${j.source}] ${j.description} — ${j.assigned}  📍 ${j.location}`);
        return `${label}\n${lines.join("\n")}`;
      }).join("\n\n");

      blocks.push(divider);
      blocks.push({ type: "header", text: { type: "plain_text", text: "Upcoming 3 Days" } });
      blocks.push({ type: "section", text: { type: "mrkdwn", text: calendarText } });
    } catch (err) {
      console.error("Error building calendar view:", err);
      blocks.push({ type: "section", text: { type: "mrkdwn", text: "_Unable to load calendar data._" } });
    }
    //#endregion

    console.log(`🏗️ View built: ${Date.now() - buildStart}ms`);
    await client.views.publish({ user_id: userId, view: { type: "home", callback_id: "home_view", blocks } });
    console.log(`✅ Home published for ${userId} | Total: ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error("❌ Error publishing Home Tab:", error.message);
    if (error.data?.response_metadata?.messages) {
      console.error("Slack validation errors:", JSON.stringify(error.data.response_metadata.messages, null, 2));
    }
    if (typeof blocks !== "undefined") {
      console.error(`Block count: ${blocks.length}`);
      blocks.forEach((b, i) => {
        try { JSON.stringify(b); } catch { console.error(`Block ${i} not serializable:`, b); }
      });
    }
  }
}

module.exports = { displayHome };
