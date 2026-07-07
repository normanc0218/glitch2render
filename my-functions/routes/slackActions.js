/**
 * ✅ Slack Actions handler
 * 处理：
 * - Slash Commands (/homeapp)
 * - Block actions（按钮点击）
 * - Modal submissions（view_submission）
 */

const axios = require("axios");
const { WebClient } = require("@slack/web-api");
const db = require("../db");
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const { buildOrderModalView } = require("../utils/orderModalBuilder");
const { buildDispatchModalView } = require("../modals/openModal_dispatch");
const { buildTrainingModalView } = require("../modals/openModal_submit_training");
const {
  openModal,
  openModal_accept,
  openModal_accept_message,
  openModal_reject,
  openModal_update_progress,
  openModal_view_detail,
  openModal_view_detail_home,
  openModal_supervisor_approval,
  openModal_daily_update,
  openModal_project_update,
  openModal_manage_dispatch,
  openModal_assign_dispatch,
  openModal_dispatch,
  openModal_submit_training,
  openModal_unfinished,
  updateUnfinishedPage,
  openModal_finished,
  updateFinishedPage,
  openModal_view_dispatch,
  openModal_sql_task_view,
} = require("../modals");

const { generateUniqueJobId } = require("../utils/generateUniqueJobId");
const { 
  handleNewJobForm,
  handleNewDispatchForm,
  handleAssignDispatchForm,
  handleUpdateProgress,
  handlePlanAcceptForm,
  handleRejectForm,
  handleReview,
  handleNewTrainRecord
} = require("../services/handlers");
const { threadNotify } = require("../services/firebaseService")
const { maintenanceStaff} = require("../userConfig");
const { getPool, sql } = require("../db-sql");

// ✅ 导出为一个标准 Express handler
module.exports = async (req, res) => {
  // 解析 interactive payload（按钮/表单）
  let payload;
  try {
    payload =
      typeof req.body.payload === "string"
        ? JSON.parse(req.body.payload)
        : req.body.payload;
  } catch (err) {
    console.error("Failed to parse payload:", err);
    return res.status(400).send("Invalid payload");
  }

  const { type, user, actions, trigger_id, view } = payload;

  // For review, validate check date/time >= end date/time
  if (type === "view_submission" && view?.callback_id === "review") {
    const vals = view.state?.values || {};
    const checkDate = vals?.checkDate?.datepickeraction?.selected_date;
    const checkTime = vals?.checkTime?.timepickeraction?.selected_time;
    const jobId = view.private_metadata;

    if (checkDate && checkTime && jobId) {
      try {
        const releaseSnap = await db.ref("jobs/Release").once("value");
        const release = releaseSnap.val() || {};
        let job = null;
        for (const branch of ["Regular", "Daily", "Project"]) {
          if (release[branch]?.[jobId]) { job = release[branch][jobId]; break; }
        }
        if (job?.actualEndDate && job?.actualEndTime) {
          const endMs   = new Date(`${job.actualEndDate}T${job.actualEndTime}`).getTime();
          const checkMs = new Date(`${checkDate}T${checkTime}`).getTime();
          if (checkMs < endMs) {
            return res.json({
              response_action: "errors",
              errors: {
                checkDate: `Check date/time cannot be earlier than end date/time (${job.actualEndDate} ${job.actualEndTime}).`,
              },
            });
          }
        }
      } catch (err) {
        console.error("Check date validation error:", err.message);
      }
    }
  }

  // For update_daily SQL tasks: validate actual start date >= scheduled date
  if (type === "view_submission" && view?.callback_id === "update_daily" && view?.private_metadata?.startsWith("sql:")) {
    const vals = view.state?.values || {};
    const startDate = vals?.startDate?.datepickeraction?.selected_date;
    const taskId = view.private_metadata.slice(4);

    if (startDate && taskId) {
      try {
        const pool = await getPool();
        const result = await pool.request()
          .input("id", sql.UniqueIdentifier, taskId)
          .query("SELECT scheduled_start FROM Tasks WHERE id = @id");
        const row = result.recordset[0];
        if (row?.scheduled_start) {
          const sd = row.scheduled_start;
          const scheduledDateStr = `${sd.getFullYear()}-${String(sd.getMonth()+1).padStart(2,'0')}-${String(sd.getDate()).padStart(2,'0')}`;
          if (startDate < scheduledDateStr) {
            return res.json({
              response_action: "errors",
              errors: {
                startDate: `Actual start date cannot be earlier than the scheduled date (${scheduledDateStr}).`,
              },
            });
          }
        }
      } catch (err) {
        console.error("Start date validation error:", err.message);
      }
    }
  }

  // For update_daily SQL tasks: validate end date/time > start date/time
  if (type === "view_submission" && view?.callback_id === "update_daily" && view?.private_metadata?.startsWith("sql:")) {
    const vals = view.state?.values || {};
    const startDate = vals?.startDate?.datepickeraction?.selected_date;
    const startTime = vals?.startTime?.timepickeraction?.selected_time;
    const endDate   = vals?.endDate?.datepickeraction?.selected_date;
    const endTime   = vals?.endTime?.timepickeraction?.selected_time;

    if (startDate && startTime && endDate && endTime) {
      const startMs = new Date(`${startDate}T${startTime}`).getTime();
      const endMs   = new Date(`${endDate}T${endTime}`).getTime();
      if (endMs <= startMs) {
        return res.json({
          response_action: "errors",
          errors: {
            endDate: `End date/time must be later than start date/time (${startDate} ${startTime}).`,
          },
        });
      }
    }
  }

  // For update_form, validate start > order date and end > start
  if (type === "view_submission" && (view?.callback_id === "update_form" || view?.callback_id === "update_daily" || view?.callback_id === "update_project")) {
    const vals      = view.state?.values || {};
    const startDate = vals?.startDate?.datepickeraction?.selected_date;
    const startTime = vals?.startTime?.timepickeraction?.selected_time;
    const endDate   = vals?.endDate?.datepickeraction?.selected_date;
    const endTime   = vals?.endTime?.timepickeraction?.selected_time;
    const rawMeta = view.private_metadata;
    let jobId;
    try { jobId = JSON.parse(rawMeta).jobId; } catch { jobId = rawMeta; }
    const errors    = {};

    // end must be later than start
    if (startDate && startTime && endDate && endTime) {
      const startMs = new Date(`${startDate}T${startTime}`).getTime();
      const endMs   = new Date(`${endDate}T${endTime}`).getTime();
      if (endMs <= startMs) {
        errors["endDate"] = `End date/time must be later than start (${startDate} ${startTime}).`;
      }
    }

    // start must be later than order date (RTDB jobs only — SQL tasks have no orderDate)
    if (jobId && !jobId.startsWith("sql:") && startDate && startTime && !errors["startDate"]) {
      try {
        const releaseSnap = await db.ref("jobs/Release").once("value");
        const release = releaseSnap.val() || {};
        let job = null;
        for (const branch of ["Regular", "Daily", "Project"]) {
          if (release[branch]?.[jobId]) { job = release[branch][jobId]; break; }
        }
        if (job?.scheduledDate && job?.scheduledTime) {
          const orderMs = new Date(`${job.scheduledDate}T${job.scheduledTime}`).getTime();
          const startMs = new Date(`${startDate}T${startTime}`).getTime();
          if (startMs < orderMs) {
            errors["startDate"] = `Start date/time cannot be earlier than the order date (${job.scheduledDate} ${job.scheduledTime}).`;
          }
        }
      } catch (err) {
        console.error("Date validation error:", err.message);
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.json({ response_action: "errors", errors });
    }
  }

  // For submitOrder, validate before responding so we can return inline errors
  if (type === "view_submission" && view?.callback_id === "submitOrder") {
    const vals = view.state?.values || {};
    const area = vals?.area?.area?.selected_option?.value;
    const errors = {};

    if (!area) {
      errors["area"] = "Please select an area.";
    } else if (area !== "__other__") {
      const machineLine = vals?.machineLine?.machineLine?.selected_option?.value;
      const equipmentId = vals?.equipmentId?.equipmentId?.selected_option?.value;
      if (!machineLine) errors["machineLine"] = "Please select a machine line.";
      if (!equipmentId) errors["equipmentId"] = "Please select an equipment.";
    }

    if (Object.keys(errors).length > 0) {
      return res.json({ response_action: "errors", errors });
    }
  }

  // ✅ Slack 要求 3 秒内响应
  res.send();

  try {
    // const channelId =
    //     payload.channel?.id ||
    //     payload.container?.channel_id ||
    //     payload.view?.private_metadata ||
    //     null;
    
    // === 1️⃣ block actions (按钮点击) ===
    if (type === "block_actions" && actions && actions[0]) {
      const action = actions[0];
      const jobId = action?.value;
      const viewId = view?.id||[];

      switch (action.action_id) {
        //Submit Order
        case "openModal":
          await openModal(trigger_id);
          break;

        // Cascading area selection → enable Machine Line
        case "area": {
          const selected = action.selected_option;
          const state = { area: selected?.value, areaLabel: selected?.text?.text };
          const callbackId = view?.callback_id;
          const updatedView = callbackId === "dispatch"       ? buildDispatchModalView(state)
                            : callbackId === "trainingRecord" ? buildTrainingModalView(state)
                            : buildOrderModalView(state);
          await slackClient.views.update({ view_id: viewId, view: updatedView });
          break;
        }

        // Cascading machine line selection → enable Equipment
        case "machineLine": {
          const areaOpt = view?.state?.values?.area?.area?.selected_option;
          const lineOpt = action.selected_option;
          const state = {
            area: areaOpt?.value, areaLabel: areaOpt?.text?.text,
            machineLine: lineOpt?.value, machineLineLabel: lineOpt?.text?.text,
          };
          const callbackId = view?.callback_id;
          const updatedView = callbackId === "dispatch"       ? buildDispatchModalView(state)
                            : callbackId === "trainingRecord" ? buildTrainingModalView(state)
                            : buildOrderModalView(state);
          await slackClient.views.update({ view_id: viewId, view: updatedView });
          break;
        }
        // Assign Dispatch
        case "openModal_assign_dispatch":
          await openModal_assign_dispatch(viewId,jobId);
          break;
        // Manage Dispatch
        case "openModal_manage_dispatch":
          await openModal_manage_dispatch(trigger_id);
          break;
        // View Dispatch
        case "openModal_view_dispatch":
          await openModal_view_dispatch(trigger_id);
          break;
        //Dispatch job by a supervisor
        case "openModal_dispatch":
          await openModal_dispatch(trigger_id);
          break;  
        //Dispatch job by a supervisor
        case "openModal_submit_training":
          await openModal_submit_training(trigger_id);
          break;  
        case "openModal_unfinished":
          await openModal_unfinished(trigger_id);
          break;
        case "unfinished_prev_page":
        case "unfinished_next_page":
          await updateUnfinishedPage(viewId, parseInt(action.value));
          break;
        case "openModal_finished":
          await openModal_finished(trigger_id);
          break;
        case "finished_prev_page":
        case "finished_next_page":
          await updateFinishedPage(viewId, parseInt(action.value));
          break;
        // 打开详情
        case "openModal_viewDetail_home":
          await openModal_view_detail_home(trigger_id, jobId);
          break;
        case "openModal_viewDetail":
          await openModal_view_detail(viewId, jobId);
          break;

        // 接受任务
        case "accept_task":
          // Quick accept
          await openModal_accept_message(trigger_id,user.id,jobId);
          break;
        // 接受任务
        case "plan_accept":
          await openModal_accept(trigger_id, jobId);
          break;
        // 拒绝任务
        case "reject_task":
          await openModal_reject(trigger_id, jobId);
          break;

        // 更新任务进度
        case "update_progress":
          await openModal_update_progress(trigger_id, jobId);
          break;
        case "delete_dispatch": {
            // 删除数据库中的对应记录
            const dispatchRef = db.ref(`jobs/Dispatch/${jobId}`);
            await dispatchRef.remove();
            break;
          }
        // 审核
        case "review_progress": {
          const reviewMsgTs = payload.container?.message_ts || null;
          const reviewChan  = payload.container?.channel_id || null;
          const UUID_RE_ACTION = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let alreadyDone = false;
          let doneBy = "supervisor";
          if (UUID_RE_ACTION.test(jobId)) {
            // SQL Project — check current status
            try {
              const pool = await getPool();
              const r = await pool.request()
                .input("id", sql.UniqueIdentifier, jobId)
                .query("SELECT status, check_by FROM Projects WHERE id = @id");
              const proj = r.recordset[0];
              if (proj && (proj.status === "Checked by Supervisor" || proj.status === "Completed")) {
                alreadyDone = true;
                doneBy = proj.check_by || "supervisor";
              }
            } catch (err) { console.error("review_progress pre-check error:", err.message); }
          } else {
            // RTDB job — check status across branches
            try {
              const snap = await db.ref("jobs/Release").once("value");
              const release = snap.val() || {};
              for (const branch of ["Regular", "Daily", "Project"]) {
                const job = release[branch]?.[jobId];
                if (job) {
                  if (job.status === "Checked by Supervisor") { alreadyDone = true; doneBy = job.checkBy || "supervisor"; }
                  break;
                }
              }
            } catch (err) { console.error("review_progress RTDB pre-check error:", err.message); }
          }
          if (alreadyDone) {
            if (reviewChan && reviewMsgTs) {
              await slackClient.chat.update({
                channel: reviewChan, ts: reviewMsgTs,
                text: `✅ Already approved by *${doneBy}*`,
                blocks: [{ type: "section", text: { type: "mrkdwn", text: `✅ Already approved by *${doneBy}*` } }],
              }).catch(() => {});
            }
            await slackClient.chat.postEphemeral({
              channel: reviewChan || payload.user.id,
              user: payload.user.id,
              text: "This job has already been approved via the web app.",
            }).catch(() => {});
            break;
          }
          await openModal_supervisor_approval(trigger_id, jobId, reviewMsgTs, reviewChan);
          break;
        }

        // Daily / Project 按钮逻辑
        case "reason_defect": {
          const { buildUpdateProgressModal } = require("../modals/openModal_update_progress");
          const selected = action.selected_option?.value;
          const showOtherReason = selected === "other";
          const vals = view.state?.values || {};
          const currentStatus = vals?.complete_job?.complete_job?.selected_option?.value || null;
          const showOtherStatus = currentStatus === "other_situation";
          const currentOtherStatus = vals?.other_status?.other_status?.selected_option?.value || null;
          await slackClient.views.update({
            view_id: view.id,
            hash: view.hash,
            view: buildUpdateProgressModal(view.private_metadata, showOtherStatus, currentStatus, currentOtherStatus, showOtherReason, selected),
          });
          break;
        }

        case "complete_job": {
          const { buildUpdateProgressModal } = require("../modals/openModal_update_progress");
          const selected = action.selected_option?.value;
          const showOther = selected === "other_situation";
          const vals = view.state?.values || {};
          const currentReason = vals?.reason_defect_block?.reason_defect?.selected_option?.value || null;
          const showOtherReason = currentReason === "other";
          await slackClient.views.update({
            view_id: view.id,
            hash: view.hash,
            view: buildUpdateProgressModal(view.private_metadata, showOther, selected, null, showOtherReason, currentReason),
          });
          break;
        }

        case "other_status": {
          const { buildUpdateProgressModal } = require("../modals/openModal_update_progress");
          const selected = action.selected_option?.value;
          const vals = view.state?.values || {};
          const currentReason = vals?.reason_defect_block?.reason_defect?.selected_option?.value || null;
          const showOtherReason = currentReason === "other";
          await slackClient.views.update({
            view_id: view.id,
            hash: view.hash,
            view: buildUpdateProgressModal(view.private_metadata, true, "other_situation", selected, showOtherReason, currentReason),
          });
          break;
        }

        case "update_daily_job":
          await openModal_daily_update(trigger_id, jobId);
          break;

        case "view_sql_task": {
          const taskId = jobId.startsWith("sql:") ? jobId.slice(4) : jobId;
          await openModal_sql_task_view(trigger_id, taskId);
          break;
        }

        case "approve_sql_task": {
          const taskId  = jobId.startsWith("sql:") ? jobId.slice(4) : jobId;
          const msgTs   = payload.container?.message_ts  || null;
          const channel = payload.container?.channel_id  || null;
          // Check if already approved via web app before opening the modal
          try {
            const pool = await getPool();
            const r = await pool.request()
              .input("id", sql.UniqueIdentifier, taskId)
              .query("SELECT status, check_by FROM Tasks WHERE id = @id");
            const task = r.recordset[0];
            if (task?.status === "checked by supervisor") {
              if (channel && msgTs) {
                await slackClient.chat.update({
                  channel, ts: msgTs,
                  text: `✅ Already approved by *${task.check_by || "supervisor"}*`,
                  blocks: [{ type: "section", text: { type: "mrkdwn", text: `✅ Already approved by *${task.check_by || "supervisor"}*` } }],
                }).catch(() => {});
              }
              await slackClient.chat.postEphemeral({
                channel: channel || payload.user.id,
                user: payload.user.id,
                text: "This task has already been approved via the web app.",
              }).catch(() => {});
              break;
            }
          } catch (err) { console.error("approve_sql_task pre-check error:", err.message); }
          await openModal_supervisor_approval(trigger_id, `sqltask:${taskId}`, msgTs, channel);
          break;
        }

        case "update_project":
          await openModal_project_update(trigger_id, jobId);
          break;
        case "notify":
          try {
              jobData = JSON.parse(jobId);
            } catch (e) {
              console.error("jobData is not JSON", jobId);
            }
          console.log(jobData);
          //this is actually messageTs,not jobId, check the "openModal_unfinished"
          await threadNotify(jobId,`<@${maintenanceStaff[jobData.assignedTo[0]]}> Please come and check the job`,JSON.stringify(jobData.messageTs))
          break;
      }
      return;
    }

    // === 2️⃣ view_submission (Modal 提交) ===
    if (type === "view_submission") {
      const { callback_id } = view;

      // 把你的每种 view.callback_id 对应逻辑放在独立函数或 switch 内
      switch (callback_id) {
        case "submitOrder":
          await handleNewJobForm(payload);
          break;
        case "dispatch":
          await handleNewDispatchForm(payload);
          break;
        case "assignDispatch":
          await handleAssignDispatchForm(payload);
          break;
        case "planAccept":
          await handlePlanAcceptForm(payload);
          break;

        case "rejectSubmit":
          await handleRejectForm(payload);
          break;
        case "update_form":
        case "update_project":
        case "update_daily":
          await handleUpdateProgress(payload);
          break;

        case "review":
          await handleReview(payload);
          break;

        case "sql_task_review": {
          let taskId, reviewMsgTs = null, reviewChannel = null;
          try {
            const meta = JSON.parse(view.private_metadata);
            taskId = meta.jobId.replace(/^sqltask:/, "");
            reviewMsgTs   = meta.msgTs   || null;
            reviewChannel = meta.channel || null;
          } catch {
            taskId = view.private_metadata.replace(/^sqltask:/, "");
          }

          const vals = view.state.values;
          const { displayHome } = require("../services/modalService");
          const pool = await getPool();

          const nameRes = await pool.request()
            .input("slackId", sql.NVarChar, user.id)
            .query("SELECT name FROM SlackUsers WHERE slack_id = @slackId AND active = 1");
          const checkBy = nameRes.recordset[0]?.name || user.username;

          const toolCheck    = vals?.tool_check?.tool_check?.selected_option?.value       || null;
          const cleanNeeded  = vals?.working_area?.working_area?.selected_option?.value;
          const cleanCheck   = cleanNeeded === "Yes" ? "Yes" : "No";
          const whoCleanUp   = vals?.clean_input?.clean_input?.value                      || null;
          const checkDetail  = vals?.detailOfJob?.detailOfJob?.value                      || null;
          const checkDate    = vals?.checkDate?.datepickeraction?.selected_date            || null;
          const checkTime    = vals?.checkTime?.timepickeraction?.selected_time            || null;
          const checkDatetime = checkDate && checkTime ? `${checkDate}T${checkTime}:00` : null;

          const titleRes = await pool.request()
            .input("id", sql.UniqueIdentifier, taskId)
            .query("SELECT title FROM Tasks WHERE id = @id");
          const taskTitle = titleRes.recordset[0]?.title || "PM Task";

          await pool.request()
            .input("id",          sql.UniqueIdentifier, taskId)
            .input("checkBy",     sql.NVarChar,         checkBy)
            .input("checkDate",   sql.DateTime2,        checkDatetime)
            .input("toolCheck",   sql.NVarChar,         toolCheck)
            .input("cleanCheck",  sql.NVarChar,         cleanCheck)
            .input("whoCleanUp",  sql.NVarChar,         whoCleanUp)
            .input("checkDetail", sql.NVarChar,         checkDetail)
            .query(`
              UPDATE Tasks SET
                status       = 'checked by supervisor',
                check_by     = @checkBy,
                check_date   = COALESCE(@checkDate, GETDATE()),
                tool_check   = COALESCE(@toolCheck, tool_check),
                clean_check  = @cleanCheck,
                who_clean_up = COALESCE(@whoCleanUp, who_clean_up),
                check_detail = COALESCE(@checkDetail, check_detail),
                updated_at   = GETDATE()
              WHERE id = @id
            `);

          // Replace the original notification message button with a checked status
          if (reviewMsgTs && reviewChannel) {
            try {
              await slackClient.chat.update({
                channel: reviewChannel,
                ts: reviewMsgTs,
                text: `✅ PM Task *${taskTitle}* — checked by *${checkBy}*`,
                blocks: [
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: `✅ PM Task *${taskTitle}* has been *checked by ${checkBy}*.`,
                    },
                  },
                ],
              });
            } catch (err) {
              console.error("Failed to update approval message:", err.message);
            }
          }

          await displayHome(user.id);
          break;
        }

        case "sql_task_check": {
          const taskId = view.private_metadata;
          const { displayHome } = require("../services/modalService");
          const pool = await getPool();
          const nameRes = await pool.request()
            .input("slackId", sql.NVarChar, user.id)
            .query("SELECT name FROM SlackUsers WHERE slack_id = @slackId AND active = 1");
          const checkBy = nameRes.recordset[0]?.name || user.username;
          await pool.request()
            .input("id",      sql.UniqueIdentifier, taskId)
            .input("checkBy", sql.NVarChar,         checkBy)
            .query(`
              UPDATE Tasks SET
                status     = 'checked by supervisor',
                check_by   = @checkBy,
                check_date = GETDATE(),
                updated_at = GETDATE()
              WHERE id = @id
            `);
          await displayHome(user.id);
          break;
        }
        case "trainingRecord":
          await handleNewTrainRecord(payload);
          break;
      }
    }
  } catch (error) {
    console.error("❌ Error processing Slack action:", error);
  }
};
