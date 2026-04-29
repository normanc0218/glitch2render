// services/handlers/handleNewJobForm.js
const { saveJobSmart } = require("../firebaseService");
const { displayHome } = require("../modalService");
/**
 * ✅ 处理新任务表单提交
 */
async function handlePlanAcceptForm(payload) {
  const { user, view } = payload;
  const ts = new Date();
  const jobId = view.private_metadata;  
  const data = {
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    remarks: view.state.values?.remarks?.remarks_input?.value || "N/A",
    acceptDate: view.state.values?.acceptDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10),
    acceptTime: view.state.values?.acceptTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5),
    status: "Accepted",
  };

  // 4️⃣ 保存
  await saveJobSmart(jobId, data);
  console.log(user);
  await displayHome(user.id)
}

module.exports = handlePlanAcceptForm ;
