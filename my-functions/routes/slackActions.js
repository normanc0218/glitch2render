/**
 * ✅ Slack Actions handler
 * 处理：
 * - Slash Commands (/homeapp)
 * - Block actions（按钮点击）
 * - Modal submissions（view_submission）
 */

const axios = require("axios");
const db = require("../db");
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
  openModal_create_project,
  openModal_add_schedule,
  openModal_manage_schedule,
  openModal_modify_schedule,
  openModal_manage_dispatch,
  openModal_assign_dispatch,
  openModal_dispatch,
  openModal_submit_training,
  openModal_unfinished,
  openModal_finished,
  updateFinishedPage,
  openModal_view_dispatch
} = require("../modals");

const { generateUniqueJobId } = require("../utils/generateUniqueJobId");
const { 
  handleNewJobForm,
  handleNewProjectForm,
  handleNewScheduleForm,
  handleModifyScheduleForm,
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

  // ✅ Slack 要求 3 秒内响应
  res.send();

  try {
    const { type, user, actions, trigger_id, view } = payload;
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
        //Create Project 
        case "openModal_create_project":
          await openModal_create_project(trigger_id);
          break;  
        // Manage Schedule Job
        case "openModal_manage_schedule":
          await openModal_manage_schedule(trigger_id);
          break;
        // Add Schedule Job
        case "openModal_add_schedule":
          await openModal_add_schedule(viewId);
          break;  
       // Modify Schedule Job
        case "openModal_modify_schedule":
          await openModal_modify_schedule(viewId,jobId);
          break;
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
        case "delete_schedule": {
            // 删除数据库中的对应记录
            const scheduleRef = db.ref(`jobs/Schedule/${jobId}`);
            await scheduleRef.remove();
            break;
          }
        case "delete_dispatch": {
            // 删除数据库中的对应记录
            const dispatchRef = db.ref(`jobs/Dispatch/${jobId}`);
            await dispatchRef.remove();
            break;
          }
        // 审核
        case "review_progress":
          await openModal_supervisor_approval(trigger_id, jobId);
          break;

        // Daily / Project 按钮逻辑
        case "update_daily_job":
          await openModal_daily_update(trigger_id, jobId);
          break;

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
        case "createProject":
          await handleNewProjectForm(payload);
          break;
        case "createSchedule":
          await handleNewScheduleForm(payload);
          break;
        case "modifySchedule":
          await handleModifyScheduleForm(payload);
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
        case "trainingRecord":
          await handleNewTrainRecord(payload);
          break;
      }
    }
  } catch (error) {
    console.error("❌ Error processing Slack action:", error);
  }
};
