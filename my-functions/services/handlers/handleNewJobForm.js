// services/handlers/handleNewJobForm.js
const generateUniqueJobId = require("../../utils/generateUniqueJobId");
const { saveJob } = require("../firebaseService");
const { notifyNewOrder } = require("../../utils/notifyChannel");
const { displayHome } = require("../modalService");
/**
 * ✅ 处理新任务表单提交
 */
async function handleNewJobForm(payload) {
  const { user, view } = payload;
  const ts = new Date();
  const jobId = await generateUniqueJobId();

  console.log("Slack view.state:", JSON.stringify(view.state, null, 2));
  console.log(jobId);

  const data = {
    jobId,
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    orderedBy: user?.username || "Unknown",
    machineLocation: view.state.values?.machineLocation?.machineLocation?.selected_option?.value || "N/A",
    reporter: view.state.values?.reporter?.reporter?.value || "N/A",
    description: view.state.values?.description?.issue?.value,
    assignedTo:
      view.state.values?.assignedTo?.pickedGuy?.selected_options?.map(
        (opt) => opt.text.text 
      ) || [],
    issuePicture:
      view.state.values?.issuePicture?.file_input_action_id_1?.files?.map(
        (file) => file.url_private
      ) || [],
    orderDate: view.state.values?.orderDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10),
    orderTime: view.state.values?.orderTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5),
    status: "Pending",
  };
  // 通知频道
  const messageTs = await notifyNewOrder(data, jobId);
  data.messageTs = messageTs;
  // 保存任务
  await saveJob(`jobs/Release/Regular`,data);
  await displayHome(user.id)

}

module.exports = handleNewJobForm ;
