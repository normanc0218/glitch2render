const { WebClient } = require("@slack/web-api");
const db = require("../db");
const { getPool, sql } = require("../db-sql");
const {
  createInputBlock,
  createInputBlock_select,
  createTextSection,
  createInputBlock_date,
  createInputBlock_time,
} = require('../utils/blockBuilder');

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function fmtTime(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return null;
  return dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function toPhotoArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

async function fetchAzureSqlProject(projectId) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.UniqueIdentifier, projectId)
      .query(`
        SELECT id, title, description, status,
               machine_location, equipment_id,
               scheduled_start, scheduled_end,
               actual_end,
               done_by, issue_picture, finish_picture
        FROM Projects WHERE id = @id
      `);
    return result.recordset[0] || null;
  } catch (err) {
    console.error("fetchAzureSqlProject error:", err.message);
    return null;
  }
}

async function fetchSqlTask(taskId) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.UniqueIdentifier, taskId)
      .query(`
        SELECT t.id, t.title, t.done_by, t.notify_supervisor,
               t.actual_start, t.actual_end, t.issue_picture, t.finish_picture,
               STRING_AGG(COALESCE(e.equipment_name, te.equipment_id), ', ') AS equipment_ids
        FROM Tasks t
        LEFT JOIN TaskEquipment te ON te.task_id = t.id
        LEFT JOIN Equipment e ON e.equipment_id = te.equipment_id
        WHERE t.id = @id
        GROUP BY t.id, t.title, t.done_by, t.notify_supervisor,
                 t.actual_start, t.actual_end, t.issue_picture, t.finish_picture
      `);
    return result.recordset[0] || null;
  } catch (err) {
    console.error("fetchSqlTask error:", err.message);
    return null;
  }
}

const openModal_supervisor_approval = async (trigger_id, jobId, msgTs = null, channel = null) => {
  const isSqlTask     = jobId.startsWith("sqltask:");
  const isAzureProject = !isSqlTask && UUID_RE.test(jobId);

  const p = getNYParts();
  const initialDate = `${p.year}-${p.month}-${p.day}`;
  const initialTime = `${p.hour.padStart(2, "0")}:${p.minute}`;

  const blocks = [];

  if (isSqlTask) {
    // ── PM Task summary ──
    const taskId = jobId.slice(8);
    const task = await fetchSqlTask(taskId);
    if (task) {
      const equipment   = task.equipment_ids || "N/A";
      const doneBy      = task.done_by       || "N/A";
      const actualStart = task.actual_start;
      const actualEnd   = task.actual_end;
      const startStr    = actualStart ? `${fmtDate(actualStart)} ${fmtTime(actualStart)}` : "N/A";
      const endStr      = actualEnd   ? `${fmtDate(actualEnd)} ${fmtTime(actualEnd)}`     : "N/A";

      blocks.push(createTextSection(`*${task.title}*`));
      blocks.push(createTextSection(`📍 ${equipment}`));
      blocks.push(createTextSection(`Done by: *${doneBy}*\nStart: ${startStr}  •  End: ${endStr}`));
      if (task.description) blocks.push(createTextSection(`_${task.description}_`));

      const issuePics  = toPhotoArray(task.issue_picture);
      const finishPics = toPhotoArray(task.finish_picture);
      if (issuePics.length > 0) {
        blocks.push(createTextSection("*Issue Pictures:*"));
        for (const url of issuePics.slice(0, 5)) {
          blocks.push({ type: "image", image_url: url, alt_text: "Issue picture" });
        }
      }
      if (finishPics.length > 0) {
        blocks.push(createTextSection("*Finish Pictures:*"));
        for (const url of finishPics.slice(0, 5)) {
          blocks.push({ type: "image", image_url: url, alt_text: "Finish picture" });
        }
      }
      blocks.push({ type: "divider" });
    }
  } else if (isAzureProject) {
    // ── Azure SQL project summary ──
    const project = await fetchAzureSqlProject(jobId);
    if (project) {
      const location   = project.equipment_id || project.machine_location || "N/A";
      const startDate  = fmtDate(project.scheduled_start) || "N/A";
      const finishDate = fmtDate(project.actual_end)      || "N/A";
      const finishTime = project.actual_end ? fmtTime(project.actual_end) : "";
      const doneBy     = project.done_by                  || "N/A";
      blocks.push(createTextSection(
        `*${project.title}*\n📍 ${location}  •  Start: ${startDate}  •  Finished: ${finishDate}${finishTime ? ` ${finishTime}` : ""}\nDone by: ${doneBy}${project.description ? `\n_${project.description}_` : ""}`
      ));

      const issuePics  = toPhotoArray(project.issue_picture);
      const finishPics = toPhotoArray(project.finish_picture);

      if (issuePics.length > 0) {
        blocks.push(createTextSection("*Issue Pictures:*"));
        for (const url of issuePics.slice(0, 5)) {
          blocks.push({ type: "image", image_url: url, alt_text: "Issue picture" });
        }
      }
      if (finishPics.length > 0) {
        blocks.push(createTextSection("*Finish Pictures:*"));
        for (const url of finishPics.slice(0, 5)) {
          blocks.push({ type: "image", image_url: url, alt_text: "Finish picture" });
        }
      }
      blocks.push({ type: "divider" });
    }
  } else {
    // ── RTDB job summary ──
    let job = null;
    try {
      const releaseSnap = await db.ref("jobs/Release").once("value");
      const release = releaseSnap.val() || {};
      for (const branch of ["Regular", "Daily", "Project"]) {
        if (release[branch]?.[jobId]) { job = release[branch][jobId]; break; }
      }
    } catch (err) {
      console.error("Failed to fetch RTDB job for review modal:", err.message);
    }

    if (job) {
      blocks.push(createTextSection(
        `*Start:*  ${job.actualStartDate || "_N/A_"}  ${job.actualStartTime || ""}    •    *End:*  ${job.actualEndDate || "_N/A_"}  ${job.actualEndTime || ""}`
      ));

      const toArr = v => Array.isArray(v) ? v : (v ? [v] : []);
      const issuePics  = toArr(job.issuePicture);
      const finishPics = toArr(job.finishPicture);

      if (issuePics.length > 0) {
        blocks.push(createTextSection("*Issue Pictures:*"));
        for (const url of issuePics.slice(0, 5)) {
          blocks.push({ type: "image", image_url: url, alt_text: "Issue picture" });
        }
      }
      if (finishPics.length > 0) {
        blocks.push(createTextSection("*Finish Pictures:*"));
        for (const url of finishPics.slice(0, 5)) {
          blocks.push({ type: "image", image_url: url, alt_text: "Finish picture" });
        }
      }
      blocks.push({ type: "divider" });
    }
  }

  // ── Review form (shared across all paths) ──
  blocks.push(createInputBlock_select({
    block_id: "tool_check",
    label: "Assigned maintenance has/have collected their tools and materials",
    action_id: "tool_check",
    options: ["Yes", "No"],
  }));
  blocks.push(createInputBlock_select({
    block_id: "working_area",
    label: "Working area needs extra help for cleaning?",
    action_id: "working_area",
    options: ["Yes", "No"],
  }));
  blocks.push(createInputBlock("clean_input", "Assign who to help cleaning?", "clean_input", "e.g. Someone", true));
  blocks.push(createInputBlock("detailOfJob", "Other details related to this job", "detailOfJob", "e.g. Notes", true));
  blocks.push(createInputBlock_date("checkDate", "Check Date", "datepickeraction", initialDate));
  blocks.push(createInputBlock_time("checkTime", "Check Time", "timepickeraction", initialTime));

  await client.views.open({
    trigger_id,
    view: {
      type: "modal",
      callback_id: isSqlTask ? "sql_task_review" : "review",
      private_metadata: msgTs ? JSON.stringify({ jobId, msgTs, channel }) : jobId,
      title: { type: "plain_text", text: "Review & Approve" },
      submit: { type: "plain_text", text: "Approve" },
      close: { type: "plain_text", text: "Cancel" },
      blocks,
    },
  });
};

module.exports = openModal_supervisor_approval;
