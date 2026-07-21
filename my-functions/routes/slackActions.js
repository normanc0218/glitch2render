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
  updateDispatchPage,
  openModal_sql_task_view,
  openJobList,
  updateJobList,
  openModal_offline_record,
  pushModal_sql_task_view,
  pushModal_sql_project_view,
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
  handleNewTrainRecord,
} = require("../services/handlers");
const { threadNotify } = require("../services/firebaseService")
const { maintenanceStaff} = require("../userConfig");
const { getPool, sql } = require("../db-sql");
const { TaskReviewSchema } = require("../schemas/sqlTask");
const { invalidateDispatchCache } = require("../services/dispatchService");

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

  // Parse view private_metadata once — may be a plain string (RTDB jobId) or a JSON object
  let viewMeta = null;
  if (view?.private_metadata) {
    try { viewMeta = JSON.parse(view.private_metadata); } catch { /* plain string */ }
  }
  const viewJobId = viewMeta?.jobId ?? view?.private_metadata ?? null;

  // For review, validate check date/time >= actual end date/time (SQL projects and RTDB jobs).
  // actualEnd is embedded in private_metadata at modal-open time (openModal_supervisor_approval.js)
  // — this is now a pure in-memory comparison, no SQL/RTDB round trip.
  if (type === "view_submission" && view?.callback_id === "review") {
    const vals = view.state?.values || {};
    const checkDate = vals?.checkDate?.datepickeraction?.selected_date;
    const checkTime = vals?.checkTime?.timepickeraction?.selected_time;
    // Still used (cheap, in-memory regex — not a network branch anymore) to pick which of
    // the two pre-existing error-message formats to render.
    const UUID_RE_REVIEW = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (checkDate && checkTime && viewMeta?.actualEnd) {
      const checkMs = new Date(`${checkDate}T${checkTime}`).getTime();
      const actualEndMs = new Date(viewMeta.actualEnd).getTime();

      if (!isNaN(actualEndMs) && checkMs < actualEndMs) {
        if (UUID_RE_REVIEW.test(viewJobId)) {
          // SQL Project — actualEnd round-tripped through JSON as an ISO string (from the
          // mssql Date object). Format using local getters, matching useUTC:false convention.
          const d = new Date(viewMeta.actualEnd);
          const endStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
          return res.json({
            response_action: "errors",
            errors: { checkDate: `Check date/time cannot be earlier than the job's actual end time (${endStr}).` },
          });
        } else {
          // RTDB job — actualEnd is already the plain "YYYY-MM-DDTHH:MM" string, unchanged.
          return res.json({
            response_action: "errors",
            errors: { checkDate: `Check date/time cannot be earlier than end date/time (${viewMeta.actualEnd.replace('T', ' ')}).` },
          });
        }
      }
    }
  }

  // For update_daily SQL tasks: validate actual start date >= scheduled date
  // scheduledStart is embedded in private_metadata at modal-open time — no SQL round trip needed here
  if (type === "view_submission" && view?.callback_id === "update_daily" && viewJobId?.startsWith("sql:") && viewMeta?.scheduledStart) {
    const vals = view.state?.values || {};
    const startDate = vals?.startDate?.datepickeraction?.selected_date;
    if (startDate && startDate < viewMeta.scheduledStart) {
      return res.json({
        response_action: "errors",
        errors: {
          startDate: `Actual start date cannot be earlier than the scheduled date (${viewMeta.scheduledStart}).`,
        },
      });
    }
  }

  // For update_daily SQL tasks: validate end date/time > start date/time
  if (type === "view_submission" && view?.callback_id === "update_daily" && viewJobId?.startsWith("sql:")) {
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
    // scheduledStart was embedded in private_metadata when the modal was opened — no RTDB read needed
    if (viewJobId && !viewJobId.startsWith("sql:") && startDate && startTime && !errors["startDate"] && viewMeta?.scheduledStart) {
      const orderMs = new Date(viewMeta.scheduledStart).getTime();
      const startMs = new Date(`${startDate}T${startTime}`).getTime();
      if (startMs < orderMs) {
        errors["startDate"] = `Start date/time cannot be earlier than the order date (${viewMeta.scheduledStart.replace('T', ' ')}).`;
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.json({ response_action: "errors", errors });
    }
  }

  // For planAccept ("Plan When?"), validate the planned start >= the order date.
  // scheduledStart was embedded in private_metadata when the modal was opened (openModal_accept.js).
  if (type === "view_submission" && view?.callback_id === "planAccept" && viewMeta?.scheduledStart) {
    const vals       = view.state?.values || {};
    const acceptDate = vals?.acceptDate?.datepickeraction?.selected_date;
    const acceptTime = vals?.acceptTime?.timepickeraction?.selected_time;

    if (acceptDate && acceptTime) {
      const orderMs  = new Date(viewMeta.scheduledStart).getTime();
      const acceptMs = new Date(`${acceptDate}T${acceptTime}`).getTime();
      if (acceptMs < orderMs) {
        return res.json({
          response_action: "errors",
          errors: {
            acceptDate: `Plan date/time cannot be earlier than the order date (${viewMeta.scheduledStart.replace('T', ' ')}).`,
          },
        });
      }
    }
  }

  // For offlineRecord: actual start must be >= order date; actual end must be > actual start
  if (type === "view_submission" && view?.callback_id === "offlineRecord") {
    const vals      = view.state?.values || {};
    const startDate = vals?.actualStartDate?.datepickeraction?.selected_date;
    const startTime = vals?.actualStartTime?.timepickeraction?.selected_time;
    const endDate   = vals?.actualEndDate?.datepickeraction?.selected_date;
    const endTime   = vals?.actualEndTime?.timepickeraction?.selected_time;
    const errors    = {};

    if (startDate && startTime && endDate && endTime) {
      const startMs = new Date(`${startDate}T${startTime}`).getTime();
      const endMs   = new Date(`${endDate}T${endTime}`).getTime();
      if (endMs <= startMs) {
        errors["actualEndDate"] = `End date/time must be later than actual start (${startDate} ${startTime.slice(0, 5)}).`;
      }
    }

    if (startDate && startTime && viewMeta?.scheduledStart) {
      const orderMs = new Date(viewMeta.scheduledStart).getTime();
      const startMs = new Date(`${startDate}T${startTime}`).getTime();
      if (startMs < orderMs) {
        errors["actualStartDate"] = `Actual start cannot be earlier than the order date/time (${viewMeta.scheduledStart.replace('T', ' ')}).`;
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
    } else if (area === "__other__") {
      if (!vals?.otherLocation?.otherLocation?.value)  errors["otherLocation"]  = "Please enter the location.";
      if (!vals?.otherEquipment?.otherEquipment?.value) errors["otherEquipment"] = "Please enter the equipment name.";
    } else {
      const { findDynBlock } = require("../utils/blockReader");
      const machineLineOpt = findDynBlock(vals, 'machineLine');
      const equipmentOpt   = findDynBlock(vals, 'equipmentId');
      const machineLine    = machineLineOpt?.value;
      const equipmentId    = equipmentOpt?.value;
      if (!machineLine) errors[`machineLine_${area}`]      = "Please select a machine line.";
      if (!equipmentId) errors[`equipmentId_${machineLine || ''}`] = "Please select an equipment.";
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
      const jobId = action?.value ?? null;  // buttons; selects use action.selected_option.value
      const viewId = view?.id||[];
      console.log("[block_actions] action_id=%s jobId=%s selected=%s user=%s", action.action_id, jobId, action?.selected_option?.value ?? null, user?.id);

      switch (action.action_id) {
        //Submit Order
        case "openModal":
          await openModal(trigger_id);
          break;

        // Cascading area selection → enable Machine Line
        case "area": {
          const selected = action.selected_option;
          const techOpt  = view?.state?.values?.assignedTo?.pickedGuy?.selected_option;
          const isOfflineTech = techOpt?.value?.startsWith("offline:");
          const state = {
            area: selected?.value, areaLabel: selected?.text?.text,
            selectedTechValue: techOpt?.value,
            selectedTechLabel: techOpt?.text?.text,
            offlineWarning: isOfflineTech ? techOpt.value.slice(8) : null,
          };
          const callbackId = view?.callback_id;
          const updatedView = callbackId === "dispatch" ? buildDispatchModalView(state)
                            : buildOrderModalView(state);
          await slackClient.views.update({ view_id: viewId, view: updatedView });
          break;
        }

        // Cascading machine line selection → enable Equipment
        case "machineLine": {
          const areaOpt  = view?.state?.values?.area?.area?.selected_option;
          const lineOpt  = action.selected_option;
          const techOpt  = view?.state?.values?.assignedTo?.pickedGuy?.selected_option;
          const isOfflineTech = techOpt?.value?.startsWith("offline:");
          const state = {
            area: areaOpt?.value, areaLabel: areaOpt?.text?.text,
            machineLine: lineOpt?.value, machineLineLabel: lineOpt?.text?.text,
            selectedTechValue: techOpt?.value,
            selectedTechLabel: techOpt?.text?.text,
            offlineWarning: isOfflineTech ? techOpt.value.slice(8) : null,
          };
          const callbackId = view?.callback_id;
          const updatedView = callbackId === "dispatch" ? buildDispatchModalView(state)
                            : buildOrderModalView(state);
          await slackClient.views.update({ view_id: viewId, view: updatedView });
          break;
        }

        // Technician selection → show offline warning if applicable
        case "pickedGuy": {
          const selected  = action.selected_option;
          const isOffline = selected?.value?.startsWith("offline:");
          const areaOpt   = view?.state?.values?.area?.area?.selected_option;
          const { findDynBlock } = require("../utils/blockReader");
          const lineOpt   = findDynBlock(view?.state?.values, 'machineLine');
          const equipOpt  = findDynBlock(view?.state?.values, 'equipmentId');
          const state = {
            area: areaOpt?.value, areaLabel: areaOpt?.text?.text,
            machineLine: lineOpt?.value, machineLineLabel: lineOpt?.text?.text,
            equipmentId: equipOpt?.value, equipmentLabel: equipOpt?.text?.text,
            selectedTechValue: selected?.value,
            selectedTechLabel: selected?.text?.text,
            offlineWarning: isOffline ? selected.value.slice(8) : null,
          };
          await slackClient.views.update({ view_id: viewId, view: buildOrderModalView(state) });
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
        case "view_dispatch_page":
          await updateDispatchPage(viewId, parseInt(action.value, 10));
          break;
        //Dispatch job by a supervisor
        case "openModal_dispatch":
          await openModal_dispatch(trigger_id);
          break;
        case "fill_offline_record": {
          let meta;
          try { meta = JSON.parse(action.value); } catch { meta = {}; }
          await openModal_offline_record(trigger_id, meta.jobId, meta.techName);
          break;
        }
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
        // Job list modal — 3 type buttons
        case "open_job_list_regular":
          await openJobList(trigger_id, 'Regular');
          break;
        case "open_job_list_project":
          await openJobList(trigger_id, 'Project');
          break;
        case "open_job_list_task":
          await openJobList(trigger_id, 'Task');
          break;
        // Job list modal — tab switching and pagination
        case "job_list_tab_unfinished":
        case "job_list_tab_finished":
        case "job_list_page": {
          const jlMeta = JSON.parse(action.value);
          await updateJobList(viewId, jlMeta.type, jlMeta.tab, jlMeta.page);
          break;
        }
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
            invalidateDispatchCache();
            // Refresh the modal the delete was clicked from so the removed
            // job disappears immediately instead of waiting for a reopen.
            if (view?.callback_id === "viewDispatch") {
              const page = parseInt(view.private_metadata, 10) || 0;
              await updateDispatchPage(viewId, page);
            }
            break;
          }
        // 审核
        case "review_progress": {
          const reviewMsgTs = payload.container?.message_ts || null;
          const reviewChan  = payload.container?.channel_id || null;
          console.log("[review_progress] jobId=%s user=%s", jobId, user?.id);
          await openModal_supervisor_approval(trigger_id, jobId, reviewMsgTs, reviewChan);
          console.log("[review_progress] views.open succeeded for jobId=%s", jobId);
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

        case "project_complete_job": {
          const { buildProjectUpdateModal } = require("../modals/openModal_project_update");
          const selected = action.selected_option?.value;
          const showOther = selected === "other_situation";
          await slackClient.views.update({
            view_id: view.id,
            hash: view.hash,
            view: buildProjectUpdateModal(view.private_metadata, showOther, selected, null),
          });
          break;
        }

        case "project_other_status": {
          const { buildProjectUpdateModal } = require("../modals/openModal_project_update");
          const selected = action.selected_option?.value;
          const vals = view.state?.values || {};
          const currentStatus = vals?.project_complete_job?.project_complete_job?.selected_option?.value || "other_situation";
          await slackClient.views.update({
            view_id: view.id,
            hash: view.hash,
            view: buildProjectUpdateModal(view.private_metadata, true, currentStatus, selected),
          });
          break;
        }

        case "offline_complete_job": {
          const { buildOfflineRecordModal } = require("../modals/openModal_offline_record");
          const selected = action.selected_option?.value;
          const showOther = selected === "other_situation";
          await slackClient.views.update({
            view_id: view.id,
            hash: view.hash,
            view: buildOfflineRecordModal(view.private_metadata, showOther, selected, null),
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
        // View detail from job list modal (uses push to stack on top of the list)
        case "view_sql_task_detail": {
          const tId = action.value;
          await pushModal_sql_task_view(trigger_id, tId);
          break;
        }
        case "view_sql_project_detail": {
          const pId = action.value;
          await pushModal_sql_project_view(trigger_id, pId);
          break;
        }

        case "approve_sql_task": {
          const taskId  = jobId.startsWith("sql:") ? jobId.slice(4) : jobId;
          const msgTs   = payload.container?.message_ts  || null;
          const channel = payload.container?.channel_id  || null;
          // Open the modal immediately — skip the pre-check SQL round trip to avoid
          // burning the 3-second trigger_id window. Double-approval is idempotent.
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
      console.log("[view_submission] callback_id=%s user=%s", callback_id, user?.id);

      // 把你的每种 view.callback_id 对应逻辑放在独立函数或 switch 内
      switch (callback_id) {
        case "submitOrder":
          await handleNewJobForm(payload);
          break;
        case "offlineRecord": {
          const { user: recUser, view: recView } = payload;
          let recMeta;
          try { recMeta = JSON.parse(recView.private_metadata); } catch { recMeta = {}; }
          const { jobId: recJobId, techName: recTechName } = recMeta;
          const recVals = recView.state.values;
          const recStartDate = recVals?.actualStartDate?.datepickeraction?.selected_date || null;
          const recStartTime = recVals?.actualStartTime?.timepickeraction?.selected_time || null;
          const recEndDate   = recVals?.actualEndDate?.datepickeraction?.selected_date   || null;
          const recEndTime   = recVals?.actualEndTime?.timepickeraction?.selected_time   || null;
          const recActualStart = recStartDate && recStartTime ? `${recStartDate}T${recStartTime.slice(0, 5)}` : null;
          const recActualEnd   = recEndDate   && recEndTime   ? `${recEndDate}T${recEndTime.slice(0, 5)}`     : null;
          const recToolCleanUp    = recVals?.toolCleanUp?.toolCleanUp?.selected_option?.value           || "Yes";
          const recMachineReset   = recVals?.machineReset?.machineReset?.selected_option?.value         || "Yes";
          const recReasonDefect   = recVals?.reason_defect_block?.reason_defect?.selected_option?.value || null;
          const recNotes          = recVals?.completionNotes?.completionNotes?.value                    || null;
          const recCheckDetail    = recVals?.checkDetail?.checkDetail?.value                            || null;
          const recWhoCleanUp     = recVals?.whoCleanUp?.whoCleanUp?.value                              || null;
          const recPhotos         = (recVals?.finishPicture?.file_input_action_id_1?.files || []).map(f => f.url_private);
          const recCheckDate      = recVals?.checkDate?.datepickeraction?.selected_date || null;
          const recCheckTime      = recVals?.checkTime?.timepickeraction?.selected_time || null;
          const recCheckDatetime  = recCheckDate && recCheckTime
            ? `${recCheckDate}T${recCheckTime.slice(0, 5)}`
            : new Date().toISOString().slice(0, 16);
          const recOrderedBy      = await (require("../utils/resolveDisplayName"))(recUser?.id, recUser?.username);
          const recStatusComplete = recVals?.offline_complete_job?.offline_complete_job?.selected_option?.value || "completed";
          const recStatusOther    = recVals?.offline_other_status?.offline_other_status?.selected_option?.value || null;

          await db.ref(`jobs/Release/Regular/${recJobId}`).update({
            doneBy:              recTechName,
            actualStart:         recActualStart,
            actualEnd:           recActualEnd,
            toolCleanUp:         recToolCleanUp,
            machineReset:        recMachineReset,
            reasonDefect:        recReasonDefect,
            messageToSupervisor: recNotes,
            finishPicture:       recPhotos,
            statusComplete:      recStatusComplete,
            statusOther:         recStatusOther || null,
            checkBy:             recOrderedBy,
            checkDatetime:       recCheckDatetime,
            toolCheck:           recToolCleanUp,
            cleanCheck:          recMachineReset,
            whoCleanUp:          recWhoCleanUp,
            checkDetail:         recCheckDetail,
            offlineSubmission:   true,
            status:              "Checked by Supervisor",
          });
          console.log(`[offlineRecord] job=${recJobId} tech=${recTechName} by=${recOrderedBy}`);
          const { displayHome: _dh, invalidateReleaseCache: _inv } = require("../services/modalService");
          _inv();
          await _dh(recUser.id);
          break;
        }
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

          try {
            TaskReviewSchema.parse({
              status:       'checked by supervisor',
              check_by:     checkBy,
              check_date:   checkDatetime,
              tool_check:   toolCheck,
              clean_check:  cleanCheck,
              who_clean_up: whoCleanUp,
              check_detail: checkDetail,
            });
          } catch (err) {
            console.error("[slackActions sql_task_update] schema validation failed:", err.issues ?? err.message);
            throw err;
          }

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

          // Refresh the technician's home so they see the approved status
          try {
            const techRes = await pool.request()
              .input("id", sql.UniqueIdentifier, taskId)
              .query("SELECT tech.name FROM Tasks t JOIN Technicians tech ON t.technician_id = tech.id WHERE t.id = @id");
            const techName = techRes.recordset[0]?.name;
            const { maintenanceStaff: mStaff } = require("../services/slackUserService");
            const techSlackId = techName ? mStaff[techName] : null;
            if (techSlackId && techSlackId !== user.id) {
              displayHome(techSlackId).catch(err => console.error("Failed to refresh technician home after task approval:", err.message));
            }
          } catch {}
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

          // Refresh the technician's home so they see the approved status
          try {
            const techRes = await pool.request()
              .input("id", sql.UniqueIdentifier, taskId)
              .query("SELECT tech.name FROM Tasks t JOIN Technicians tech ON t.technician_id = tech.id WHERE t.id = @id");
            const techName = techRes.recordset[0]?.name;
            const { maintenanceStaff: mStaff } = require("../services/slackUserService");
            const techSlackId = techName ? mStaff[techName] : null;
            if (techSlackId && techSlackId !== user.id) {
              displayHome(techSlackId).catch(err => console.error("Failed to refresh technician home after task check:", err.message));
            }
          } catch {}
          break;
        }
        case "trainingRecord":
          await handleNewTrainRecord(payload);
          break;
      }
    }
  } catch (error) {
    console.error("❌ Error processing Slack action for user", user?.id, error.message, error.stack);
    try {
      await slackClient.chat.postMessage({
        channel: user.id,
        text: `⚠️ Something went wrong processing your request. Please try again or contact admin.\n\`${error.message}\``,
      });
    } catch (_) {}
  }
};
