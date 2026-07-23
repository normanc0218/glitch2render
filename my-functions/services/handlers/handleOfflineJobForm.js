const { WebClient } = require("@slack/web-api");
const generateUniqueJobId = require("../../utils/generateUniqueJobId");
const { saveJob } = require("../firebaseService");
const { displayHome } = require("../modalService");
const { getPool, sql } = require("../../db-sql");
const resolveDisplayName = require("../../utils/resolveDisplayName");

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

async function resolveEquipmentName(equipmentId) {
  if (!equipmentId) return null;
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input("id", sql.NVarChar, equipmentId)
      .query("SELECT equipment_name FROM Equipment WHERE equipment_id = @id");
    return r.recordset[0]?.equipment_name || equipmentId;
  } catch {
    return equipmentId;
  }
}

async function handleOfflineJobForm(payload) {
  const { user, view } = payload;
  const ts   = new Date();
  const vals = view.state.values;
  let viewMeta = {};
  try { viewMeta = JSON.parse(view.private_metadata); } catch {}
  const { channel, messageTs } = viewMeta;

  const jobId    = await generateUniqueJobId();
  const orderedBy = await resolveDisplayName(user?.id, user?.username);

  // Location
  const selectedArea        = vals?.area?.area?.selected_option?.value || null;
  const isOther             = selectedArea === "__other__";
  const otherLocation       = vals?.otherLocation?.otherLocation?.value || null;
  const otherEquipment      = vals?.otherEquipment?.otherEquipment?.value || null;
  const selectedEquipmentId = vals?.equipmentId?.equipmentId?.selected_option?.value || null;
  const resolvedEquipmentId   = selectedEquipmentId || (isOther ? "other" : null);
  const resolvedEquipmentName = selectedEquipmentId
    ? await resolveEquipmentName(selectedEquipmentId)
    : (otherEquipment || "N/A");
  const resolvedArea        = isOther ? (otherLocation || null) : selectedArea;
  const resolvedMachineLine = isOther ? null : (vals?.machineLine?.machineLine?.selected_option?.value || null);

  // Job fields
  const assignedTechName = vals?.assignedTo?.assignedTo?.selected_option?.value || null;
  const reporter         = vals?.reporter?.reporter?.value || "N/A";
  const description      = vals?.description?.issue?.value || "";
  const orderDate        = vals?.orderDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10);
  const orderTime        = vals?.orderTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5);
  const scheduledStart   = `${orderDate}T${orderTime.slice(0, 5)}`;

  // Completion fields
  const startDate  = vals?.actualStartDate?.datepickeraction?.selected_date || null;
  const startTime  = vals?.actualStartTime?.timepickeraction?.selected_time || null;
  const endDate    = vals?.actualEndDate?.datepickeraction?.selected_date || null;
  const endTime    = vals?.actualEndTime?.timepickeraction?.selected_time || null;
  const actualStart = startDate && startTime ? `${startDate}T${startTime.slice(0, 5)}` : null;
  const actualEnd   = endDate   && endTime   ? `${endDate}T${endTime.slice(0, 5)}`     : null;

  const toolCleanUp      = vals?.toolCleanUp?.toolCleanUp?.selected_option?.value || "Yes";
  const machineReset     = vals?.machineReset?.machineReset?.selected_option?.value || "Yes";
  const completionNotes  = vals?.completionNotes?.completionNotes?.value || null;
  const notifySupervisor = vals?.notifySupervisor?.notifySupervisor?.selected_option?.value || null;
  const finishPicture    = (vals?.finishPicture?.file_input_action_id_1?.files || []).map(f => f.url_private);

  const nowStr = ts.toLocaleString("en-US", { timeZone: "America/New_York" });

  const data = {
    jobId,
    timestamp:   nowStr,
    orderedBy,

    // Location
    area:          resolvedArea,
    machineLine:   resolvedMachineLine,
    equipmentId:   resolvedEquipmentId,
    equipmentName: resolvedEquipmentName,

    // Job details
    reporter,
    description,
    assignedTo:   assignedTechName ? [assignedTechName] : [],
    issuePicture: [],
    scheduledStart,
    priority:     "medium",

    // Completion (filled by supervisor on behalf of technician)
    doneBy:              assignedTechName,
    actualStart,
    actualEnd,
    toolCleanUp,
    machineReset,
    notifySupervisor,
    messageToSupervisor: completionNotes,
    finishPicture,
    statusComplete:      "completed",

    // Review (supervisor who submitted acts as reviewer)
    checkBy:       orderedBy,
    checkDatetime: ts.toISOString().slice(0, 16),
    toolCheck:     toolCleanUp,
    cleanCheck:    machineReset,
    checkDetail:   completionNotes,

    offlineSubmission: true,
    status: "Checked by Supervisor",
  };

  await saveJob("jobs/Release/Regular", data);
  console.log(`[offlineJob] saved ${jobId} for tech=${assignedTechName} by supervisor=${orderedBy}`);

  if (channel && messageTs) {
    try {
      await slackClient.chat.update({
        channel,
        ts: messageTs,
        text: `✅ Fill record for ${assignedTechName} (Job ${jobId}) submitted.`,
        blocks: [{
          type: "section",
          text: { type: "mrkdwn", text: `✅ Fill record for *${assignedTechName}* (Job *${jobId}*) has been submitted.` },
        }],
      });
    } catch (err) {
      console.error('[offlineJob] failed to update original message:', err.message);
    }
  }

  await displayHome(user.id);
}

module.exports = handleOfflineJobForm;
