const { WebClient } = require("@slack/web-api");
const { saveJobSmart } = require("../firebaseService");
const { displayHome } = require("../modalService");
const { getPool, sql } = require("../../db-sql");
const userConfig = require("../slackUserService");
const resolveDisplayName = require("../../utils/resolveDisplayName");
const { TaskCompletionSchema } = require("../../schemas/sqlTask");
const { ProjectCompletionSchema } = require("../../schemas/sqlProject");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sendSupervisorNotification(supervisorName, taskId, taskTitle, doneBy) {
  const slackId = userConfig.Supervisors[supervisorName];
  if (!slackId) return;
  try {
    await client.chat.postMessage({
      channel: slackId,
      text: `✅ PM Task *${taskTitle}* has been completed by ${doneBy}.`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `✅ PM Task *${taskTitle}* has been completed by *${doneBy}*.\nPlease review.`,
          },
          accessory: {
            type: "button",

            text: { type: "plain_text", text: "Check and Approve" },
            value: `sql:${taskId}`,
            action_id: "approve_sql_task",
            style: "primary",
          },
        },
      ],
    });
    // Refresh supervisor's App Home so the pending task appears immediately
    displayHome(slackId).catch(err => console.error("Failed to refresh supervisor home:", err.message));
  } catch (err) {
    console.error("Failed to notify supervisor:", err.message);
  }
}

async function handleSqlTaskUpdate(taskId, vals, user) {
  const description     = vals?.supervisor_message?.supervisor_message?.value || null;
  const notifySupervisor = vals?.supervisor_notify?.supervisor_notify?.selected_option?.value || null;
  console.log(`[handleSqlTaskUpdate] taskId=${taskId} notifySupervisor=${notifySupervisor}`);
  const startDate = vals?.startDate?.datepickeraction?.selected_date || null;
  const startTime = vals?.startTime?.timepickeraction?.selected_time || null;
  const endDate   = vals?.endDate?.datepickeraction?.selected_date || null;
  const endTime   = vals?.endTime?.timepickeraction?.selected_time || null;

  const actualStart = startDate && startTime ? `${startDate}T${startTime}:00` : null;
  const actualEnd   = endDate   && endTime   ? `${endDate}T${endTime}:00`     : null;

  const picFiles = vals?.finishPicture?.file_general_input?.files || [];
  const finishPicture = picFiles.length > 0
    ? JSON.stringify(picFiles.map(f => f.url_private))
    : null;

  const statusComplete = vals?.complete_job?.complete_job?.selected_option?.value || "completed";
  const statusOther    = vals?.other_status?.other_status?.selected_option?.value || null;
  const sqlStatus = (statusComplete === "other_situation" && statusOther === "temporarily_fixed")
    ? "temporarily fixed"
    : "completed and waiting for approval";

  const doneBy = await resolveDisplayName(user?.id, user?.username || null);

  try {
    TaskCompletionSchema.parse({
      status:            sqlStatus,
      done_by:           doneBy,
      actual_start:      actualStart,
      actual_end:        actualEnd,
      finish_picture:    finishPicture,
      description,
      notify_supervisor: notifySupervisor,
    });
  } catch (err) {
    console.error("[handleSqlTaskUpdate] schema validation failed:", err.issues ?? err.message);
    throw err;
  }

  const pool = await getPool();
  await pool.request()
    .input("id",               sql.UniqueIdentifier, taskId)
    .input("status",           sql.NVarChar,         sqlStatus)
    .input("description",      sql.NVarChar,         description)
    .input("doneBy",           sql.NVarChar,         doneBy)
    .input("notifySupervisor", sql.NVarChar,         notifySupervisor)
    .input("actualStart",      sql.DateTime2,        actualStart)
    .input("actualEnd",        sql.DateTime2,        actualEnd)
    .input("finishPicture",    sql.NVarChar,         finishPicture)
    .query(`
      UPDATE Tasks SET
        status            = @status,
        description       = COALESCE(@description, description),
        done_by           = @doneBy,
        notify_supervisor = COALESCE(@notifySupervisor, notify_supervisor),
        actual_start      = COALESCE(@actualStart, actual_start),
        actual_end        = COALESCE(@actualEnd, actual_end),
        finish_picture    = COALESCE(@finishPicture, finish_picture),
        updated_at        = GETDATE()
      WHERE id = @id
    `);

  if (notifySupervisor) {
    const titleRes = await pool.request()
      .input("id", sql.UniqueIdentifier, taskId)
      .query("SELECT title FROM Tasks WHERE id = @id");
    const taskTitle = titleRes.recordset[0]?.title || "PM Task";
    await sendSupervisorNotification(notifySupervisor, taskId, taskTitle, doneBy);
  }
}

async function handleProjectUpdate(projectId, vals, user) {
  const notifySupervisor = vals?.supervisor_notify?.supervisor_notify?.selected_option?.value || null;
  const message   = vals?.supervisor_message?.supervisor_message?.value || null;
  const endDate   = vals?.endDate?.datepickeraction?.selected_date   || null;
  const endTime   = vals?.endTime?.timepickeraction?.selected_time   || null;
  const startDate = vals?.startDate?.datepickeraction?.selected_date || null;
  const startTime = vals?.startTime?.timepickeraction?.selected_time || null;

  const statusComplete = vals?.project_complete_job?.project_complete_job?.selected_option?.value || "completed";
  const statusOther    = vals?.project_other_status?.project_other_status?.selected_option?.value || null;
  const projectStatus = "Completed and waiting for approval";

  const picFiles = vals?.finishPicture?.file_input_action_id_1?.files || [];
  const finishPicture = picFiles.length > 0
    ? JSON.stringify(picFiles.map(f => f.url_private))
    : null;

  const doneBy = await resolveDisplayName(user?.id, user?.username || null);

  const actualEnd   = endDate && endTime     ? `${endDate}T${endTime}:00`     : null;
  const actualStart = startDate && startTime ? `${startDate}T${startTime}:00` : (startDate ? `${startDate}T00:00:00` : null);

  try {
    ProjectCompletionSchema.parse({
      status:                projectStatus,
      done_by:               doneBy,
      actual_start:          actualStart,
      actual_end:            actualEnd,
      finish_picture:        finishPicture,
      status_complete:       statusComplete,
      status_other:          statusOther,
      notify_supervisor:     notifySupervisor,
      message_to_supervisor: message,
    });
  } catch (err) {
    console.error("[handleProjectUpdate] schema validation failed:", err.issues ?? err.message);
    throw err;
  }

  console.log("[handleProjectUpdate] id=%s status=%s statusComplete=%s doneBy=%s", projectId, projectStatus, statusComplete, doneBy);

  const pool = await getPool();
  let result;
  try {
    result = await pool.request()
      .input("id",               sql.UniqueIdentifier, projectId)
      .input("status",           sql.NVarChar(100),    projectStatus)
      .input("statusComplete",   sql.NVarChar(50),     statusComplete)
      .input("statusOther",      sql.NVarChar(50),     statusOther || null)
      .input("doneBy",           sql.NVarChar(255),    doneBy)
      .input("actualStart",      sql.DateTime2,        actualStart)
      .input("actualEnd",        sql.DateTime2,        actualEnd)
      .input("notifySupervisor", sql.NVarChar(255),    notifySupervisor)
      .input("message",          sql.NVarChar(sql.MAX), message)
      .input("finishPicture",    sql.NVarChar(sql.MAX), finishPicture)
      .query(`
        UPDATE Projects SET
          status                = @status,
          status_complete       = @statusComplete,
          status_other          = @statusOther,
          done_by               = @doneBy,
          actual_start          = COALESCE(@actualStart, actual_start),
          actual_end            = COALESCE(@actualEnd, actual_end),
          notify_supervisor     = COALESCE(@notifySupervisor, notify_supervisor),
          message_to_supervisor = COALESCE(@message, message_to_supervisor),
          finish_picture        = COALESCE(@finishPicture, finish_picture),
          updated_at            = GETDATE()
        WHERE id = @id
      `);
  } catch (err) {
    console.error("[handleProjectUpdate] SQL error for id=%s: %s", projectId, err.message);
    throw err;
  }

  const affected = result?.rowsAffected?.[0] ?? -1;
  if (affected === 0) {
    console.warn("[handleProjectUpdate] UPDATE matched 0 rows for id=%s — project may not exist", projectId);
    return;
  }
  console.log("[handleProjectUpdate] updated %d row(s) for id=%s", affected, projectId);

  if (notifySupervisor) {
    const slackId = userConfig.Supervisors[notifySupervisor];
    if (slackId) {
      const titleRes = await pool.request()
        .input("id", sql.UniqueIdentifier, projectId)
        .query("SELECT title FROM Projects WHERE id = @id");
      const title = titleRes.recordset[0]?.title || "Project";
      try {
        await client.chat.postMessage({
          channel: slackId,
          text: `✅ Project *${title}* has been completed by ${doneBy}.`,
          blocks: [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: `✅ Project *${title}* has been completed by *${doneBy}*.\nPlease review.`,
            },
            accessory: {
              type: "button",
              text: { type: "plain_text", text: "Approve" },
              value: projectId,
              action_id: "review_progress",
              style: "primary",
            },
          }],
        });
        // Refresh supervisor's App Home so the pending project appears immediately
        // (app_home_opened only fires on navigation; the DM alone won't update a stale home tab)
        displayHome(slackId).catch(err => console.error("Failed to refresh supervisor home:", err.message));
      } catch (err) {
        console.error("Failed to notify supervisor for project:", err.message);
      }
    }
  }
}

async function handleUpdateProgress(payload) {
  const { user, view } = payload;
  const ts = new Date();
  const rawMeta = view.private_metadata;
  let jobId;
  try { jobId = JSON.parse(rawMeta).jobId; } catch { jobId = rawMeta; }
  const vals  = view.state.values;

  if (jobId.startsWith("sql:")) {
    const taskId = jobId.slice(4);
    await handleSqlTaskUpdate(taskId, vals, user);
    await displayHome(user.id);
    return;
  }

  if (UUID_RE.test(jobId)) {
    await handleProjectUpdate(jobId, vals, user);
    await displayHome(user.id);
    return;
  }

  // RTDB flow (Regular / Daily jobs)
  const doneBy = await resolveDisplayName(user?.id, user?.username || null);
  const data = {
    doneBy,
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    reasonDefect: vals?.reason_defect_block?.reason_defect?.selected_option?.value || null,
    otherReason:  vals?.other_reason_input?.otherreason?.value || "N/A",
    toolCleanUp:  vals?.select_tools?.tool_collected?.selected_option?.value || "N/A",
    machineReset: vals?.resetbuttons?.resetbuttons?.selected_option?.value || "N/A",
    notifySupervisor:   vals?.supervisor_notify?.supervisor_notify?.selected_option?.text.text || "N/A",
    messageToSupervisor: vals?.supervisor_message?.supervisor_message?.value || "N/A",
    statusComplete: vals?.complete_job?.complete_job?.selected_option?.value || "N/A",
    statusOther:   vals?.other_status?.other_status?.selected_option?.value || null,
    partsNeeded:   vals?.parts_needed?.parts_needed?.value || null,
    finishPicture: vals?.finishPicture?.file_input_action_id_1?.files?.map(f => f.url_private) || [],
    actualStart: (() => { const d = vals?.startDate?.datepickeraction?.selected_date; const t = vals?.startTime?.timepickeraction?.selected_time; return d && t ? `${d}T${t.slice(0, 5)}` : null; })(),
    actualEnd:   (() => { const d = vals?.endDate?.datepickeraction?.selected_date;   const t = vals?.endTime?.timepickeraction?.selected_time;   return d && t ? `${d}T${t.slice(0, 5)}` : null; })(),
    status: "Completed and waiting for approval",
  };

  const msg = `✅ Job *${jobId}* was *Updated* by <@${user.id}> `;
  await saveJobSmart(jobId, data, true, msg);
  await displayHome(user.id);

  // Refresh the notified supervisor's App Home so the pending job appears immediately
  const supervisorSlackId = userConfig.Supervisors[data.notifySupervisor];
  if (supervisorSlackId) {
    displayHome(supervisorSlackId).catch(err =>
      console.error("Failed to refresh supervisor home after RTDB update:", err.message)
    );
  }
}

module.exports = handleUpdateProgress ;
