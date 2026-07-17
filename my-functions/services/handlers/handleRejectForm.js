const { saveJobSmart } = require("../firebaseService");
const { displayHome } = require("../modalService");
const db = require("../../db");
const userConfig = require("../slackUserService");

async function handleRejectForm(payload) {
  const { user, view } = payload;
  const ts = new Date();
  const jobId = view.private_metadata;
  const data = {
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    rejectReason: view.state.values?.rejectReason?.reason_input?.value || "N/A",
    rejectDatetime: `${view.state.values?.rejectDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10)}T${(view.state.values?.rejectTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5)).slice(0, 5)}`,
    status: "Rejected",
  };

  await saveJobSmart(jobId, data);
  console.log(user);
  await displayHome(user.id);

  // Refresh the supervisor's home so the job disappears from their pending queue
  try {
    const jobSnap = await db.ref(`jobs/Release/Regular/${jobId}`).once("value");
    const notifySupervisor = jobSnap.val()?.notifySupervisor;
    const supervisorSlackId = notifySupervisor ? userConfig.Supervisors[notifySupervisor] : null;
    if (supervisorSlackId && supervisorSlackId !== user.id) {
      displayHome(supervisorSlackId).catch(err => console.error("Failed to refresh supervisor home after reject:", err.message));
    }
  } catch {}
}

module.exports = handleRejectForm;
