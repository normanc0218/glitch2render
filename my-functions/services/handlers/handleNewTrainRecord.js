// services/handlers/handleNewJobForm.js
const generateUniqueJobId = require("../../utils/generateUniqueJobId");
const { saveJob } = require("../firebaseService");
const { notifyNewOrder } = require("../../utils/notifyChannel");
const { displayHome } = require("../modalService");
/**
 * ✅ 处理新任务表单提交
 */
async function handleNewTrainRecord(payload) {
  const { user, view } = payload;
  const ts = new Date();
  let jobId = await generateUniqueJobId();
  jobId = `TRAIN${jobId.slice(3)}`;


  const data = {
    jobId,
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    trainer: user?.username || "Unknown",
    machineLocation: view.state.values?.machineLocation?.machineLocation?.selected_option?.value || "N/A",
    description: view.state.values?.description?.issue?.value || [],
    traineeName: view.state.values?.traineeName?.trainee?.value || [],
    trainPicture:
      view.state.values?.picture?.file_input_action_id_1?.files?.map(
        (file) => file.url_private
      ) || [],
    orderDate: view.state.values?.orderDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10),
    orderTime: view.state.values?.orderTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5),
    comment: view.state.values?.comment?.comment?.value || [],
  };
  // 通知频道
  const messageTs = await notifyNewOrder(data, jobId);
  data.messageTs = messageTs;
  // 保存任务
  await saveJob(`jobs/Train`,data);
  await displayHome(user.id)
}

module.exports = handleNewTrainRecord ;
