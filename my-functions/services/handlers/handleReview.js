const { WebClient } = require("@slack/web-api");
const { saveJobSmart } = require("../firebaseService");
const { displayHome } = require("../modalService");
const { getPool, sql } = require("../../db-sql");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function disableApproveButton(channel, ts, checkedBy) {
  if (!channel || !ts) return;
  try {
    await client.chat.update({
      channel,
      ts,
      text: `✅ Approved by *${checkedBy}*`,
      blocks: [{
        type: "section",
        text: { type: "mrkdwn", text: `✅ Approved by *${checkedBy}*` },
      }],
    });
  } catch (err) {
    console.error("chat.update after approval failed:", err.message);
  }
}

async function resolveCheckBy(pool, slackUserId, fallback) {
  try {
    const r = await pool.request()
      .input("slackId", sql.NVarChar, slackUserId)
      .query("SELECT name FROM SlackUsers WHERE slack_id = @slackId AND active = 1");
    return r.recordset[0]?.name || fallback;
  } catch {
    return fallback;
  }
}

async function handleReview(payload) {
  const { user, view } = payload;
  const ts    = new Date();
  const rawMeta = view.private_metadata;
  let jobId, reviewMsgTs = null, reviewChannel = null;
  try {
    const meta = JSON.parse(rawMeta);
    jobId         = meta.jobId;
    reviewMsgTs   = meta.msgTs   || null;
    reviewChannel = meta.channel || null;
  } catch {
    jobId = rawMeta;
  }
  const vals  = view.state.values;

  const toolCheck   = vals?.tool_check?.tool_check?.selected_option?.value   || "N/A";
  const cleanCheck  = vals?.working_area?.working_area?.selected_option?.value || "N/A";
  const whoCleanUp  = vals?.clean_input?.clean_input?.value                  || null;
  const checkDetail = vals?.detailOfJob?.detailOfJob?.value                  || null;
  const checkDate   = vals?.checkDate?.datepickeraction?.selected_date       || null;
  const checkTime   = vals?.checkTime?.timepickeraction?.selected_time       || null;

  if (UUID_RE.test(jobId)) {
    // ── Azure SQL project approval ──
    const checkDatetime = checkDate && checkTime ? `${checkDate}T${checkTime}:00` : null;
    const pool = await getPool();
    const checkBy = await resolveCheckBy(pool, user?.id, user?.username || null);

    // Guard: check_date must not be earlier than actual_end
    if (checkDatetime) {
      const res2 = await pool.request()
        .input("id", sql.UniqueIdentifier, jobId)
        .query("SELECT actual_end FROM Projects WHERE id = @id");
      const actualEnd = res2.recordset[0]?.actual_end;
      if (actualEnd && new Date(checkDatetime) < new Date(actualEnd)) {
        console.warn(`handleReview: check_date ${checkDatetime} earlier than actual_end ${actualEnd} for project ${jobId} — aborting`);
        return;
      }
    }

    await pool.request()
      .input("id",          sql.UniqueIdentifier, jobId)
      .input("checkBy",     sql.NVarChar,         checkBy)
      .input("checkDate",   sql.DateTime2,        checkDatetime)
      .input("checkDetail", sql.NVarChar(sql.MAX), checkDetail)
      .input("cleanCheck",  sql.NVarChar(100),    cleanCheck)
      .input("toolCheck",   sql.NVarChar(50),     toolCheck)
      .input("whoCleanUp",  sql.NVarChar(255),    whoCleanUp)
      .query(`
        UPDATE Projects SET
          status       = 'Checked by Supervisor',
          check_by     = @checkBy,
          check_date   = @checkDate,
          check_detail = @checkDetail,
          clean_check  = @cleanCheck,
          tool_check   = @toolCheck,
          who_clean_up = @whoCleanUp,
          updated_at   = GETDATE()
        WHERE id = @id
      `);
    await disableApproveButton(reviewChannel, reviewMsgTs, checkBy);
    await displayHome(user.id);
    return;
  }

  // ── RTDB job approval ──
  const pool2 = await getPool();
  const checkBy = await resolveCheckBy(pool2, user?.id, user?.username || null);
  const data = {
    checkBy,
    timestamp:  ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    toolCheck,
    cleanCheck,
    whoCleanUp:  whoCleanUp  || "N/A",
    checkDetail: checkDetail || "N/A",
    checkDatetime: `${checkDate || ts.toISOString().slice(0, 10)}T${(checkTime || ts.toTimeString().slice(0, 5)).slice(0, 5)}`,
    status: "Checked by Supervisor",
  };

  const msg = `✅ Job *${jobId}* was *Reviewed* by <@${user.id}>`;
  await saveJobSmart(jobId, data, true, msg);
  await disableApproveButton(reviewChannel, reviewMsgTs, checkBy);
  await displayHome(user.id);
}

module.exports = handleReview;
