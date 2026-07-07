const { WebClient } = require("@slack/web-api");
const { saveJobSmart } = require("../firebaseService");
const { displayHome } = require("../modalService");
const { getPool, sql } = require("../../db-sql");
const userConfig = require("../slackUserService");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveDisplayName(slackUserId, fallback) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("slackId", sql.NVarChar, slackUserId)
      .query("SELECT name FROM SlackUsers WHERE slack_id = @slackId AND active = 1");
    return result.recordset[0]?.name || fallback;
  } catch {
    return fallback;
  }
}

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
  } catch (err) {
    console.error("Failed to notify supervisor:", err.message);
  }
}

async function handleSqlTaskUpdate(taskId, vals, user) {
  const description     = vals?.supervisor_message?.supervisor_message?.value || null;
  const notifySupervisor = vals?.supervisor_notify?.supervisor_notify?.selected_option?.value || null;
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

  const doneBy = await resolveDisplayName(user?.id, user?.username || null);

  const pool = await getPool();
  await pool.request()
    .input("id",               sql.UniqueIdentifier, taskId)
    .input("status",           sql.NVarChar,         "completed and waiting for approval")
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
  const endDate   = vals?.endDate?.datepickeraction?.selected_date || null;
  const endTime   = vals?.endTime?.timepickeraction?.selected_time || null;
  const startDate = vals?.startDate?.datepickeraction?.selected_date || null;

  const picFiles = vals?.finishPicture?.file_input_action_id_1?.files || [];
  const finishPicture = picFiles.length > 0
    ? JSON.stringify(picFiles.map(f => f.url_private))
    : null;

  const doneBy = await resolveDisplayName(user?.id, user?.username || null);

  const actualEnd = endDate && endTime ? `${endDate}T${endTime}:00` : null;

  const pool = await getPool();
  await pool.request()
    .input("id",               sql.UniqueIdentifier, projectId)
    .input("status",           sql.NVarChar,         "Completed and waiting for approval")
    .input("doneBy",           sql.NVarChar,         doneBy)
    .input("actualEnd",        sql.DateTime2,        actualEnd)
    .input("startDate",        sql.Date,             startDate ? new Date(startDate) : null)
    .input("notifySupervisor", sql.NVarChar,         notifySupervisor)
    .input("message",          sql.NVarChar(sql.MAX), message)
    .input("finishPicture",    sql.NVarChar(sql.MAX), finishPicture)
    .query(`
      UPDATE Projects SET
        status                = @status,
        done_by               = @doneBy,
        actual_end            = COALESCE(@actualEnd, actual_end),
        scheduled_start       = COALESCE(@startDate, scheduled_start),
        notify_supervisor     = COALESCE(@notifySupervisor, notify_supervisor),
        message_to_supervisor = COALESCE(@message, message_to_supervisor),
        finish_picture        = COALESCE(@finishPicture, finish_picture),
        updated_at            = GETDATE()
      WHERE id = @id
    `);

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
    actualStartDate: vals?.startDate?.datepickeraction?.selected_date,
    actualStartTime: vals?.startTime?.timepickeraction?.selected_time,
    actualEndDate:   vals?.endDate?.datepickeraction?.selected_date,
    actualEndTime:   vals?.endTime?.timepickeraction?.selected_time,
    status: "Completed and waiting for approval",
  };

  const msg = `✅ Job *${jobId}* was *Updated* by <@${user.id}> `;
  await saveJobSmart(jobId, data, true, msg);
  await displayHome(user.id);
}

module.exports = handleUpdateProgress ;
