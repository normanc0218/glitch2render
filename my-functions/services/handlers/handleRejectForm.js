// services/handlers/handleNewJobForm.js
const { saveJobSmart } = require("../firebaseService");
const { displayHome } = require("../modalService");
/**
 * ✅ 处理新任务表单提交
 */
async function handleRejectForm(payload) {
  const { user, view } = payload;
  const ts = new Date();
  const jobId = view.private_metadata;  
  const data = {
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    rejectReason: view.state.values?.rejectReason?.reason_input?.value || "N/A",
    rejectDate: view.state.values?.rejectDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10),
    rejectTime: view.state.values?.rejectTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5),
    status: "Rejected",
  };

  // 4️⃣ 保存
  await saveJobSmart(jobId, data);
  console.log(user);
  await displayHome(user.id)
  // 通知频道
  // await notifyNewOrder(data, jobId);
}

module.exports = handleRejectForm ;
