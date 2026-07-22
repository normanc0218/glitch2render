const userConfig = require("./slackUserService");
const {
  getRelease, getTasksForTechnician, getProjectsForTechnician,
  getUpcomingTasks, getPromotedRtdbJobIds, getSlackUserRow,
} = require("./homeQueries");
const { DIV, fmtDate, fmtTime, greetingHeader, browseButtonBlocks, calendarBlocks } = require("./homeBlocks");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function buildMaintenanceHome(userId, techNames) {
  const dbStart = Date.now();
  const [release, azureTasks, techProjects, upcomingTasks, promotedIds, slackUserRow] = await Promise.all([
    getRelease(),
    getTasksForTechnician(techNames),
    getProjectsForTechnician(techNames),
    getUpcomingTasks(),
    getPromotedRtdbJobIds(),
    getSlackUserRow(userId),
  ]);
  console.log(`📊 DB queries: ${Date.now() - dbStart}ms`);

  const buildStart = Date.now();
  const blocks = [
    greetingHeader(slackUserRow),
    DIV,
    { type: "header", text: { type: "plain_text", text: "🧰 My Assigned Jobs" } },
  ];

  // PM Tasks assigned to this technician (limit 5)
  if (azureTasks.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "*PM Tasks:*" } });
    for (const task of azureTasks.slice(0, 5)) {
      const date      = fmtDate(task.scheduled_start) || "N/A";
      const taskStart = fmtTime(task.scheduled_start);
      const taskEnd   = fmtTime(task.scheduled_end);
      const timeRange = taskStart && taskEnd ? ` ${taskStart} – ${taskEnd}` : taskStart ? ` ${taskStart}` : "";
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*${task.title}*  •  ${task.status}\n${date}${timeRange}  •  📍 ${task.equipment_ids || "N/A"}${task.description ? `\n${task.description}` : ""}` },
        accessory: { type: "button", text: { type: "plain_text", text: "Update Task" }, style: "primary", value: `sql:${task.id}`, action_id: "update_daily_job" },
      });
    }
    blocks.push(DIV);
  }

  // Projects assigned to this technician (limit 5)
  if (techProjects.length > 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "*Projects:*" } });
    for (const p of techProjects.slice(0, 5)) {
      const equipPath = p.equipment_area
        ? [p.equipment_area, p.equipment_machine_line, p.equipment_id].filter(Boolean).join(' > ')
        : (p.equipment_other || p.machine_location || 'N/A');
      const startStr = fmtDate(p.scheduled_start) || "N/A";
      const endStr   = fmtDate(p.scheduled_end)   || "N/A";
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*${p.title}*  •  ${p.status}\n📍 ${equipPath}  •  Start: ${startStr}  •  Due: ${endStr}${p.description ? `\n${p.description}` : ""}` },
        accessory: { type: "button", text: { type: "plain_text", text: "Update Project" }, style: "primary", value: String(p.id), action_id: "update_project" },
      });
    }
    blocks.push(DIV);
  }

  // RTDB Regular jobs — excludes promoted, only assigned to this technician (limit 5)
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
    blocks.push(DIV);
  }

  if (azureTasks.length === 0 && techProjects.length === 0 && regularJobs.length === 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "_No assigned jobs currently._" } });
    blocks.push(DIV);
  }

  blocks.push(...browseButtonBlocks());
  blocks.push(...calendarBlocks(release, upcomingTasks));

  console.log(`🏗️ View built: ${Date.now() - buildStart}ms`);
  return blocks;
}

module.exports = { buildMaintenanceHome };
