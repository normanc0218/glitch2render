const { saveJob } = require("../firebaseService");

/**
 * ✅ 处理新任务表单提交
 */
async function handleModifyScheduleForm(payload) {
  const { user, view } = payload;
  const ts = new Date();
  const jobId = view.private_metadata;  

  const data = {
    jobId,
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    orderedBy: view.state.values?.supervisor_notify?.supervisor_notify?.selected_option?.text.text || "N/A",
    machineLocation: view.state.values?.machineLocation?.machineLocation?.selected_option?.value || "N/A",
    description: view.state.values?.description?.issue?.value,
    assignedTo:
      view.state.values?.assignedTo?.pickedGuy?.selected_options?.map(
        (opt) => opt.text.text 
      ) || [],
    repeat: view.state.values?.repeat?.repeat_option?.selected_option?.value || "N/A",
    ModifyDate: view.state.values?.startDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10),
    orderTime: view.state.values?.startTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5),

  };
  console.log(data);
  // 保存任务
  await saveJob(`jobs/Schedule`,data);

}

module.exports = handleModifyScheduleForm ;
