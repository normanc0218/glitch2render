const { saveJob } = require("../firebaseService");
const { notifyNewOrder } = require("../../utils/notifyChannel");
const generateUniqueJobId = require("../../utils/generateUniqueJobId");
const db = require("../../db");
const { displayHome } = require("../modalService");
/**
 * ✅ 处理新任务表单提交
 */
async function handleAssignDispatchForm(payload) {
  const { user, view } = payload;
  const ts = new Date();
  const metadata = JSON.parse(view.private_metadata);
  //delete dispatch record
  const oldId = metadata.jobId;
  const scheduleRef = db.ref(`jobs/Dispatch/${oldId}`);
  await scheduleRef.remove();
  //generate new Id
  const jobId = await generateUniqueJobId();
  
  const data = {
    jobId,
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    orderedBy: user?.username || "Unknown",
    machineLocation: view.state.values?.machineLocation?.machineLocation?.selected_option?.value || "N/A",
    description: view.state.values?.description?.issue?.value,
    assignedTo:
      view.state.values?.assignedTo?.pickedGuy?.selected_options?.map(
        (opt) => opt.text.text 
      ) || [],
    issuePicture: metadata.issuePicture,
    orderDate: view.state.values?.orderDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10),
    orderTime: view.state.values?.orderTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5),
    dispatchDate: metadata?.dispatchDate|| "",
    dispatchTime: metadata?.dispatchTime|| "",
    status: "Pending",

  };
  // 通知频道
  const messageTs = await notifyNewOrder(data, jobId);
  data.messageTs = messageTs;
  // 保存任务
  await saveJob(`jobs/Release/Regular`,data);
  await displayHome(user.id);
}

module.exports = handleAssignDispatchForm ;
