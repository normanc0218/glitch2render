// services/handlers/handleNewJobForm.js
const {saveJobSmart } = require("../firebaseService");
const { displayHome } = require("../modalService");
/**
 * ✅ 处理新任务表单提交
 */
async function handleUpdateProgress(payload) {
  const { user, view } = payload;
  const ts = new Date();
  const jobId = view.private_metadata;  
  const data = {
    doneBy:user?.username,
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    reasonDefect: view.state.values?.reason_defect_block?.reason_defect?.selected_options?.map(
        (opt) => opt.value 
      ) || [],
    otherReason: view.state.values?.other_reason_input?.otherreason?.value || "N/A",
    toolCleanUp: view.state.values?.select_tools?.tool_collected?.selected_option?.value|| "N/A",
    machineReset: view.state.values?.resetbuttons?.resetbuttons?.selected_option?.value|| "N/A",

    notifySupervisor: view.state.values?.supervisor_notify?.supervisor_notify?.selected_option?.text.text || "N/A",
    messageToSupervisor: view.state.values?.supervisor_message?.supervisor_message?.value || "N/A",
    
    statusComplete: view.state.values?.complete_job?.complete_job?.selected_option?.value|| "N/A",
    statusOther: view.state.values?.other_status?.other_status?.selected_options?.map(
                (opt) => opt.value
              ) || [],
    otherSpecify: view.state?.values?.specify?.specify_other?.value || "N/A",

    finishPicture:
      view.state.values?.finishPicture?.file_input_action_id_1?.files?.map(
        (file) => file.url_private
      ) || [],
    startDate: view.state.values?.startDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10),
    startTime: view.state.values?.startTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5),
    endDate: view.state.values?.endDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10),
    endTime: view.state.values?.endTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5),
    status: "Completed and waiting for approval",
  };

  // 通知频道
  const msg = `✅ Job *${jobId}* was *Updated* by <@${user.id}> `;
  await displayHome(user.id);
  // 4️⃣ 保存
  await saveJobSmart(jobId, data, true, msg);
}

module.exports = handleUpdateProgress ;
