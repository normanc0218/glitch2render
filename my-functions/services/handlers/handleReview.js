const { saveJobSmart } = require("../firebaseService");
const { displayHome } = require("../modalService");
const { getPool, sql } = require("../../db-sql");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handleReview(payload) {
  const { user, view } = payload;
  const ts    = new Date();
  const jobId = view.private_metadata;
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
    await pool.request()
      .input("id",          sql.UniqueIdentifier, jobId)
      .input("checkBy",     sql.NVarChar,         user?.username || null)
      .input("checkDate",   sql.DateTime2,        checkDatetime)
      .input("checkTime",   sql.NVarChar(10),     checkTime || null)
      .input("checkDetail", sql.NVarChar(sql.MAX), checkDetail)
      .input("cleanCheck",  sql.NVarChar(100),    cleanCheck)
      .input("toolCheck",   sql.NVarChar(50),     toolCheck)
      .input("whoCleanUp",  sql.NVarChar(255),    whoCleanUp)
      .query(`
        UPDATE Projects SET
          status       = 'Checked by Supervisor',
          check_by     = @checkBy,
          check_date   = @checkDate,
          check_time   = @checkTime,
          check_detail = @checkDetail,
          clean_check  = @cleanCheck,
          tool_check   = @toolCheck,
          who_clean_up = @whoCleanUp,
          updated_at   = GETDATE()
        WHERE id = @id
      `);
    await displayHome(user.id);
    return;
  }

  // ── RTDB job approval ──
  const data = {
    checkBy:    user?.username,
    timestamp:  ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    toolCheck,
    cleanCheck,
    whoCleanUp:  whoCleanUp  || "N/A",
    checkDetail: checkDetail || "N/A",
    checkDate:   checkDate   || ts.toISOString().slice(0, 10),
    checkTime:   checkTime   || ts.toTimeString().slice(0, 5),
    status: "Checked by Supervisor",
  };

  const msg = `✅ Job *${jobId}* was *Reviewed* by <@${user.id}>`;
  await saveJobSmart(jobId, data, true, msg);
  await displayHome(user.id);
}

module.exports = handleReview;
