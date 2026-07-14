const { saveJob } = require("../firebaseService");
const { notifyNewOrder } = require("../../utils/notifyChannel");
const generateUniqueJobId = require("../../utils/generateUniqueJobId");
const db = require("../../db");
const { displayHome } = require("../modalService");
const resolveDisplayName = require("../../utils/resolveDisplayName");
const userConfig = require("../slackUserService");
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
  const jobId = await generateUniqueJobId(user?.id === "U_E2E" || process.env.FORCE_TEST_JOB_IDS === "true");
  
  const orderedBy = await resolveDisplayName(user?.id, user?.username);
  const data = {
    jobId,
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    orderedBy,
    equipmentName: view.state.values?.machineLocation?.machineLocation?.selected_option?.value || "N/A",
    description: view.state.values?.description?.issue?.value,
    assignedTo:
      view.state.values?.assignedTo?.pickedGuy?.selected_options?.map(
        (opt) => opt.text.text 
      ) || [],
    issuePicture: metadata.issuePicture,
    scheduledStart: `${view.state.values?.orderDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10)}T${(view.state.values?.orderTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5)).slice(0, 5)}`,
    dispatchDatetime: metadata?.dispatchDatetime || null,
    status: "Pending",
    priority: "medium",
  };
  // 通知频道
  const messageTs = await notifyNewOrder(data, jobId);
  data.messageTs = messageTs;
  // 保存任务
  await saveJob(`jobs/Release/Regular`,data);
  await displayHome(user.id);

  // Refresh the assigned technician(s)' Home tab so the job shows up immediately.
  for (const name of data.assignedTo || []) {
    const techSlackId = userConfig.maintenanceStaff[name];
    if (techSlackId && techSlackId !== user.id) {
      displayHome(techSlackId).catch(err =>
        console.error("Failed to refresh assigned technician's home:", err.message)
      );
    }
  }
}

module.exports = handleAssignDispatchForm ;
