// services/handlers/handleNewJobForm.js
const generateUniqueJobId = require("../../utils/generateUniqueJobId");
const { saveJob } = require("../firebaseService");

/**
 * ✅ 处理新任务表单提交
 */
async function handleNewDispatchForm(payload) {
  const { user, view } = payload;
  const ts = new Date();
  let jobId = await generateUniqueJobId();
  jobId = `DSP${jobId.slice(3)}`;

  // console.log("Slack view.state:", JSON.stringify(view.state, null, 2));
  // console.log(jobId);

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
    dispatchDate: view.state.values?.dispatchDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10),
    dispatchTime: view.state.values?.dispatchTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5),
    status: "Dispatched",
  };

  // 保存任务
  await saveJob(`jobs/Dispatch`,data);
  // // 通知频道
  // await notifyNewOrder(data, jobId);
}

module.exports = handleNewDispatchForm ;
