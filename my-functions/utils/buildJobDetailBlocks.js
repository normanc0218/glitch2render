const { findJobById } = require("../services/firebaseService");
const { getPool, sql } = require("../db-sql");
const { createTextSection, createDivider, createHeader, createImage } = require("./blockBuilder");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toUrlArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "object") return Object.values(v).filter(Boolean);
  return [];
}

function toPhotoArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p.filter(Boolean) : []; } catch { return []; }
}

function fmtDate(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
}

function fmtDateTime(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return null;
  return dt.toLocaleString("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true });
}

// ── SQL Task ─────────────────────────────────────────────────────────────────
async function fetchSqlTask(taskId) {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.UniqueIdentifier, taskId)
    .query(`
      SELECT t.id, t.title, t.description, t.status, t.priority,
             t.scheduled_start, t.scheduled_end,
             t.actual_start, t.actual_end,
             t.done_by, t.notify_supervisor, t.finish_picture,
             t.check_by, t.check_date, t.check_detail,
             tech.name AS technician_name,
             STRING_AGG(COALESCE(e.equipment_name, te.equipment_id), ', ') AS equipment_ids
      FROM Tasks t
      LEFT JOIN Technicians tech ON t.technician_id = tech.id
      LEFT JOIN TaskEquipment te ON te.task_id = t.id
      LEFT JOIN Equipment e ON e.equipment_id = te.equipment_id
      WHERE t.id = @id
      GROUP BY t.id, t.title, t.description, t.status, t.priority,
               t.scheduled_start, t.scheduled_end,
               t.actual_start, t.actual_end,
               t.done_by, t.notify_supervisor, t.finish_picture,
               t.check_by, t.check_date, t.check_detail, tech.name
    `);
  return result.recordset[0] || null;
}

function buildSqlTaskBlocks(t) {
  const blocks = [
    createTextSection(`*PM Task:* ${t.title}`),
    createTextSection(
      `*Status:* ${t.status || "N/A"}  •  *Priority:* ${t.priority || "N/A"}\n` +
      `*Technician:* ${t.technician_name || "N/A"}  •  *Equipment:* ${t.equipment_ids || "N/A"}`
    ),
    createTextSection(
      `*Scheduled:* ${fmtDateTime(t.scheduled_start) || "N/A"}\n` +
      `*Plan End:* ${fmtDateTime(t.scheduled_end) || "N/A"}`
    ),
    createDivider(),
  ];

  if (t.actual_start || t.actual_end || t.done_by) {
    blocks.push(createTextSection(
      `*Done By:* ${t.done_by || "N/A"}\n` +
      `*Actual Start:* ${fmtDateTime(t.actual_start) || "N/A"}\n` +
      `*Actual End:* ${fmtDateTime(t.actual_end) || "N/A"}\n` +
      `*Notify Supervisor:* ${t.notify_supervisor || "N/A"}`
    ));
    if (t.description) blocks.push(createTextSection(`*Notes:* ${t.description}`));
    blocks.push(createDivider());
  }

  if (t.check_by) {
    blocks.push(createTextSection(
      `*Checked By:* ${t.check_by}\n` +
      `*Check Date:* ${fmtDate(t.check_date) || "N/A"}\n` +
      `*Check Detail:* ${t.check_detail || "N/A"}`
    ));
    blocks.push(createDivider());
  }

  const finishPics = toPhotoArray(t.finish_picture);
  if (finishPics.length > 0) {
    blocks.push(createHeader("Finish Pictures"));
    blocks.push(...finishPics.slice(0, 5).map((url, i) => createImage(url, `Finish image ${i+1}`)));
  }

  return blocks;
}

// ── SQL Project ───────────────────────────────────────────────────────────────
async function fetchSqlProject(projectId) {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.UniqueIdentifier, projectId)
    .query(`
      SELECT p.id, p.title, p.description, p.status, p.priority,
             p.machine_location, p.equipment_id,
             p.scheduled_start, p.scheduled_end,
             p.ordered_by, p.assigned_to,
             p.done_by, p.notify_supervisor, p.message_to_supervisor,
             p.actual_end,
             p.check_by, p.check_date, p.check_detail,
             p.issue_picture, p.finish_picture,
             tech.name AS technician_name,
             e.equipment_name
      FROM Projects p
      LEFT JOIN Technicians tech ON tech.id = p.technician_id
      LEFT JOIN Equipment e ON e.equipment_id = p.equipment_id
      WHERE p.id = @id
    `);
  return result.recordset[0] || null;
}

function buildSqlProjectBlocks(p) {
  const location = p.equipment_name || p.equipment_id || p.machine_location || "N/A";
  const blocks = [
    createTextSection(`*Project:* ${p.title}`),
    createTextSection(
      `*Status:* ${p.status || "N/A"}  •  *Priority:* ${p.priority || "N/A"}\n` +
      `*Technician:* ${p.technician_name || "N/A"}  •  📍 ${location}`
    ),
    createTextSection(
      `*Start Date:* ${fmtDate(p.scheduled_start) || "N/A"}  •  *Due:* ${fmtDate(p.scheduled_end) || "N/A"}\n` +
      `*Ordered By:* ${p.ordered_by || "N/A"}  •  *Assigned To:* ${p.assigned_to || "N/A"}`
    ),
  ];
  if (p.description) blocks.push(createTextSection(`*Description:* ${p.description}`));
  blocks.push(createDivider());

  if (p.done_by || p.actual_end) {
    blocks.push(createTextSection(
      `*Done By:* ${p.done_by || "N/A"}\n` +
      `*Actual End:* ${fmtDateTime(p.actual_end) || "N/A"}\n` +
      `*Notify Supervisor:* ${p.notify_supervisor || "N/A"}\n` +
      `*Message to Supervisor:* ${p.message_to_supervisor || "N/A"}`
    ));
    blocks.push(createDivider());
  }

  if (p.check_by) {
    blocks.push(createTextSection(
      `*Checked By:* ${p.check_by}\n` +
      `*Check Date/Time:* ${fmtDateTime(p.check_date) || "N/A"}\n` +
      `*Check Detail:* ${p.check_detail || "N/A"}`
    ));
    blocks.push(createDivider());
  }

  const issuePics  = toPhotoArray(p.issue_picture);
  const finishPics = toPhotoArray(p.finish_picture);
  if (issuePics.length > 0) {
    blocks.push(createHeader("Issue Pictures"));
    blocks.push(...issuePics.slice(0, 5).map((url, i) => createImage(url, `Issue image ${i+1}`)));
  }
  if (finishPics.length > 0) {
    blocks.push(createHeader("Finish Pictures"));
    blocks.push(...finishPics.slice(0, 5).map((url, i) => createImage(url, `Finish image ${i+1}`)));
  }

  return blocks;
}

// ── RTDB job ──────────────────────────────────────────────────────────────────
function buildRtdbBlocks(job) {
  const blocks = [
    createTextSection(`*Job ID:* ${job.id}`),
    createTextSection(
      `*Category:* ${job.category || "N/A"}  •  *Ordered By:* ${job.orderedBy || "N/A"}\n` +
      `*Machine Location:* ${job.equipmentName || "N/A"}  •  *Finder:* ${job.reporter || "N/A"}`
    ),
    createTextSection(`*Description:* ${job.description || "N/A"}`),
    createTextSection(
      `*Assigned Staff:* ${job.assignedTo || "N/A"}\n` +
      `*Order Date/Time:* ${(job.scheduledStart || job.orderDatetime || job.dispatchDatetime)?.replace('T', ' ') || "N/A"}\n` +
      `*Status:* ${job.status || "N/A"}`
    ),
    createDivider(),
  ];

  if (job.status === "Accepted") {
    blocks.push(createTextSection(
      `*Accepted:* ${job.acceptDatetime?.replace('T', ' ') || "N/A"}\n` +
      `*Remarks:* ${job.remarks || "None"}`
    ), createDivider());
  } else if (job.status === "Rejected") {
    blocks.push(createTextSection(
      `*Rejected:* ${job.rejectDatetime?.replace('T', ' ') || "N/A"}\n` +
      `*Rejected By:* ${job.assignedTo || "N/A"}  •  *Reason:* ${job.rejectReason || "N/A"}`
    ), createDivider());
  } else if (job.status !== "Pending") {
    blocks.push(createTextSection(
      `*Accepted:* ${job.acceptDatetime?.replace('T', ' ') || "N/A"}\n` +
      `*Remarks:* ${job.remarks || "None"}`
    ), createDivider());
    blocks.push(createTextSection(
      `*Done By:* ${job.doneBy || "N/A"}  •  *Cause of issue:* ${job.reasonDefect || "N/A"}\n` +
      `*Other reason:* ${job.otherReason || "N/A"}\n` +
      `*Tools collected:* ${job.toolCleanUp || "N/A"}  •  *Machine reset:* ${job.machineReset || "N/A"}\n` +
      `*Notify Supervisor:* ${job.notifySupervisor || "N/A"}\n` +
      `*Message to Supervisor:* ${job.messageToSupervisor || "N/A"}\n` +
      `*Other Status:* ${job.statusOther || "None"}\n` +
      `*End:* ${job.actualEnd?.replace('T', ' ') || "N/A"}`
    ));
    const finishPics = toUrlArray(job.finishPicture);
    if (finishPics.length > 0) {
      blocks.push(createHeader("Finish Pictures"));
      blocks.push(...finishPics.slice(0, 5).map((url, i) => createImage(url, `Finish image ${i+1}`)));
    }
    blocks.push(createDivider());
  }

  const issuePics = toUrlArray(job.issuePicture);
  if (issuePics.length > 0) {
    blocks.push(createHeader("Issue Pictures"));
    blocks.push(...issuePics.slice(0, 5).map((url, i) => createImage(url, `Issue image ${i+1}`)));
  }

  return blocks;
}

// ── Public ────────────────────────────────────────────────────────────────────
async function buildJobDetailBlocks(jobId) {
  if (jobId.startsWith("sql:")) {
    const taskId = jobId.slice(4);
    const task = await fetchSqlTask(taskId);
    if (!task) return null;
    return buildSqlTaskBlocks(task);
  }

  if (UUID_RE.test(jobId)) {
    const project = await fetchSqlProject(jobId);
    if (!project) return null;
    return buildSqlProjectBlocks(project);
  }

  const job = await findJobById(jobId);
  if (!job) return null;
  return buildRtdbBlocks(job);
}

module.exports = { buildJobDetailBlocks };
