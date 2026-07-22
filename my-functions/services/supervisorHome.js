const userConfig = require("./slackUserService");
const {
  getRelease, getProjectsPendingApproval, getTasksPendingApproval,
  getUpcomingTasks, getSlackUserRow,
} = require("./homeQueries");
const { DIV, fmtDate, greetingHeader, browseButtonBlocks, calendarBlocks } = require("./homeBlocks");

async function buildSupervisorHome(userId, supervisorName) {
  const dbStart = Date.now();
  const [release, azureProjects, azureTasksApproval, upcomingTasks, slackUserRow] = await Promise.all([
    getRelease(),
    getProjectsPendingApproval(),
    getTasksPendingApproval(),
    getUpcomingTasks(),
    getSlackUserRow(userId),
  ]);
  console.log(`📊 DB queries: ${Date.now() - dbStart}ms`);

  const buildStart = Date.now();
  const blocks = [
    greetingHeader(slackUserRow),
    DIV,
    { type: "header", text: { type: "plain_text", text: "👨‍💼 Supervisor Dashboard" } },
    {
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "🚚 Dispatch Job" }, style: "primary", action_id: "openModal_dispatch" },
        { type: "button", text: { type: "plain_text", text: "View Dispatch" }, action_id: "openModal_view_dispatch" },
        { type: "button", text: { type: "plain_text", text: "Submit Order" }, action_id: "openModal" },
      ],
    },
    DIV,
  ];

  // RTDB Regular jobs assigned to offline techs — supervisor needs to fill in the record
  const offlinePending = Object.entries(release || {})
    .map(([id, job]) => ({ ...job, id }))
    .filter(j => {
      const assignedName = Array.isArray(j.assignedTo) ? j.assignedTo[0] : j.assignedTo;
      const isOffline = assignedName && (userConfig.offlineTechs || []).includes(assignedName);
      return (j.status || "").toLowerCase() === "pending" && isOffline && j.notifySupervisor === supervisorName;
    })
    .slice(0, 10);

  if (offlinePending.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "*🖊️ Offline tech jobs — fill in their record:*" } });
    for (const job of offlinePending) {
      const techName = Array.isArray(job.assignedTo) ? job.assignedTo[0] : (job.assignedTo || "N/A");
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*${job.id}* — ${job.description || " "}\n📍 ${job.equipmentName || "N/A"}  •  ${job.scheduledStart?.slice(0, 10) || ""}  •  👤 ${techName} _(no Slack)_` },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "Fill Record" },
          style: "primary",
          action_id: "fill_offline_record",
          value: JSON.stringify({ jobId: job.id, techName }),
        },
      });
    }
    blocks.push(DIV);
  }

  // PM Tasks completed — pending review for this supervisor
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
    blocks.push(DIV);
  }

  // Projects pending approval for this supervisor
  const myProjects = azureProjects.filter(p => p.notify_supervisor === supervisorName).slice(0, 10);
  if (myProjects.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "*📋 Projects pending approval:*" } });
    for (const p of myProjects) {
      const date = fmtDate(p.scheduled_start) || "N/A";
      const equipPath = p.equipment_area
        ? [p.equipment_area, p.equipment_machine_line, p.equipment_id].filter(Boolean).join(' > ')
        : (p.equipment_other || p.machine_location || 'N/A');
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*${p.title}*\n📍 ${equipPath}  •  Start: ${date}  •  Done by: ${p.done_by || "N/A"}` },
        accessory: { type: "button", text: { type: "plain_text", text: "Approve" }, style: "primary", value: String(p.id), action_id: "review_progress" },
      });
    }
    blocks.push(DIV);
  }

  // RTDB Regular jobs pending approval for this supervisor
  const rtdbFinished = Object.entries(release || {})
    .map(([id, job]) => ({ ...job, id }))
    .filter(j => {
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
    blocks.push(DIV);
  }

  if (myTasksApproval.length === 0 && myProjects.length === 0 && rtdbFinished.length === 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "_No jobs waiting for approval._" } });
  }

  blocks.push(...browseButtonBlocks());
  blocks.push(...calendarBlocks(release, upcomingTasks));

  console.log(`🏗️ View built: ${Date.now() - buildStart}ms`);
  return blocks;
}

module.exports = { buildSupervisorHome };
