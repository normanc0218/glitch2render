// services/handlers/handleNewJobForm.js
const { saveJobSmart } = require("../firebaseService");
const { displayHome } = require("../modalService");
/**
 * ✅ 处理新任务表单提交
 */
async function handleReview(payload) {
  const { user, view } = payload;
  const ts = new Date();
  const jobId = view.private_metadata;  
  const data = {
    checkBy:user?.username,
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    toolCheck: view.state.values?.tool_check?.tool_check?.selected_option?.value|| "N/A",
    cleanCheck: view.state.values?.working_area?.working_area?.value || "N/A",
    whoCleanUp: view.state.values?.clean_input?.clean_input?.selected_option?.value|| "N/A",
    checkDetail: view.state.values?.detailOfJob?.detailOfJob?.selected_option?.value|| "N/A",
    checkDate: view.state.values?.checkDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10),
    checkTime: view.state.values?.checkTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5),
    status: "Checked by Supervisor",
  };


  // 通知频道
  const msg = `✅ Job *${jobId}* was *Reviewed* by <@${user.id}> `;
  console.log("what:",data.messageTs);
  await displayHome(user.id);

  // 4️⃣ 保存
  await saveJobSmart(jobId, data, true, msg);
}

module.exports = handleReview ;
