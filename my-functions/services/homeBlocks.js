const DIV = { type: "divider" };

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

function greetingHeader(slackUserRow) {
  const name  = slackUserRow?.name || "there";
  const label = { supervisor: "Supervisor", maintenance: "Technician", manager: "Manager", trainer: "Trainer" }[slackUserRow?.role] || "";
  const text  = `Hi ${name}${label ? ` (${label})` : ""}, welcome to Maintenance Assistant`;
  return { type: "header", text: { type: "plain_text", text: `👋 ${text}`, emoji: true } };
}

function browseButtonBlocks() {
  return [
    { type: "section", text: { type: "mrkdwn", text: "*Browse Jobs:*" } },
    {
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "📋 Regular Jobs" }, action_id: "open_job_list_regular" },
        { type: "button", text: { type: "plain_text", text: "🏗️ Projects" }, action_id: "open_job_list_project" },
        { type: "button", text: { type: "plain_text", text: "🔧 PM Tasks" }, action_id: "open_job_list_task" },
      ],
    },
    { type: "context", elements: [{ type: "mrkdwn", text: "_Tap a button to browse jobs. Each list shows up to 50, split into Unfinished / Finished tabs._" }] },
    DIV,
  ];
}

function calendarBlocks(release, upcomingTasks) {
  try {
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const dayMs   = 86400000;
    const dayMap  = {};
    for (let i = 0; i < 3; i++) {
      const d   = new Date(todayMs + i * dayMs);
      const key = fmtDate(d);
      dayMap[key] = [];
    }

    Object.entries(release || {}).forEach(([, job]) => {
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

    const DAY_NAMES   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const calendarText = Object.entries(dayMap).map(([dateStr, jobs]) => {
      const d     = new Date(dateStr + "T00:00:00");
      const label = `*${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}*`;
      if (jobs.length === 0) return `${label}\n_No jobs scheduled_`;
      return `${label}\n${jobs.map(j => `• [${j.source}] ${j.description} — ${j.assigned}  📍 ${j.location}`).join("\n")}`;
    }).join("\n\n");

    return [
      DIV,
      { type: "header", text: { type: "plain_text", text: "Upcoming 3 Days" } },
      { type: "section", text: { type: "mrkdwn", text: calendarText } },
    ];
  } catch (err) {
    console.error("Error building calendar view:", err);
    return [{ type: "section", text: { type: "mrkdwn", text: "_Unable to load calendar data._" } }];
  }
}

module.exports = { DIV, fmtDate, fmtTime, greetingHeader, browseButtonBlocks, calendarBlocks };
