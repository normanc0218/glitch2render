// services/handlers/handleNewJobForm.js
const { WebClient } = require("@slack/web-api");
const generateUniqueJobId = require("../../utils/generateUniqueJobId");
const { saveJob } = require("../firebaseService");
const { notifyNewOrder } = require("../../utils/notifyChannel");
const { displayHome } = require("../modalService");
const { getPool, sql } = require("../../db-sql");
const resolveDisplayName = require("../../utils/resolveDisplayName");
const { RegularJobCreateSchema } = require("../../schemas/regularJob");
const userConfig = require("../slackUserService");

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

/**
 * ✅ 处理新任务表单提交
 */
async function handleNewJobForm(payload) {
  const { user, view } = payload;
  const ts = new Date();
  const jobId = await generateUniqueJobId(user?.id === "U_E2E" || process.env.FORCE_TEST_JOB_IDS === "true");

  const orderedBy = await resolveDisplayName(user?.id, user?.username);
  const selectedEquipmentId = view.state.values?.equipmentId?.equipmentId?.selected_option?.value || null;
  const selectedArea        = view.state.values?.area?.area?.selected_option?.value || null;
  const isOther             = selectedArea === "__other__";
  const otherLocation       = view.state.values?.otherLocation?.otherLocation?.value || null;
  const otherEquipment      = view.state.values?.otherEquipment?.otherEquipment?.value || null;

  const resolvedEquipmentId   = selectedEquipmentId || (isOther ? "other" : null);
  const resolvedEquipmentName = selectedEquipmentId
    ? await resolveEquipmentName(selectedEquipmentId)
    : (otherEquipment || "N/A");
  const resolvedArea          = isOther ? (otherLocation || null) : selectedArea;
  const resolvedMachineLine   = isOther ? null : (view.state.values?.machineLine?.machineLine?.selected_option?.value || null);

  const assignedOpt      = view.state.values?.assignedTo?.pickedGuy?.selected_option || null;
  const isOfflineTech    = assignedOpt?.value?.startsWith("offline:") ?? false;
  const assignedName     = assignedOpt
    ? (isOfflineTech ? assignedOpt.value.slice(8) : assignedOpt.text.text)
    : null;
  const offlineTechNames = isOfflineTech && assignedName ? [assignedName] : [];

  // When assigned to an offline tech, record which supervisor submitted the order
  // so the supervisor home can show this job in the "needs record fill-in" section.
  const supervisorName = isOfflineTech
    ? (Object.keys(userConfig.Supervisors).find(n => userConfig.Supervisors[n] === user.id) || null)
    : null;

  const data = {
    jobId,
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    orderedBy,
    area:          resolvedArea,
    machineLine:   resolvedMachineLine,
    equipmentId:   resolvedEquipmentId,
    equipmentName: resolvedEquipmentName,
    reporter: view.state.values?.reporter?.reporter?.value || "N/A",
    description: view.state.values?.description?.issue?.value,
    assignedTo: assignedName ? [assignedName] : [],
    ...(supervisorName ? { notifySupervisor: supervisorName } : {}),
    issuePicture:
      view.state.values?.issuePicture?.file_input_action_id_1?.files?.map(
        (file) => file.url_private
      ) || [],
    scheduledStart: `${view.state.values?.orderDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10)}T${(view.state.values?.orderTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5)).slice(0, 5)}`,
    status: "Pending",
    priority: view.state.values?.priority?.priority?.selected_option?.value || "medium",
  };
  // 通知频道
  const messageTs = await notifyNewOrder(data, jobId);
  data.messageTs = messageTs;

  // Validate shape before writing — catches field-name drift between bot and schema
  try {
    RegularJobCreateSchema.parse(data);
  } catch (err) {
    console.error("[handleNewJobForm] schema validation failed — job NOT saved:", err.issues ?? err.message);
    throw new Error("Your job submission could not be saved due to a validation error. Please contact admin.");
  }

  // 保存任务
  await saveJob(`jobs/Release/Regular`,data);
  const t0 = Date.now();
  await displayHome(user.id);
  console.log(`[submitOrder] displayHome done: ${Date.now() - t0}ms`);

  // Refresh the assigned technician's Home tab so the new job shows up immediately.
  for (const name of data.assignedTo || []) {
    const techSlackId = userConfig.maintenanceStaff[name];
    if (techSlackId && techSlackId !== user.id) {
      displayHome(techSlackId).catch(err =>
        console.error("Failed to refresh assigned technician's home:", err.message)
      );
    }
  }

  // DM the supervisor to fill in the record for any offline techs they assigned.
  if (offlineTechNames.length > 0) {
    const nameList = offlineTechNames.join(", ");
    const plural = offlineTechNames.length > 1;
    try {
      await slackClient.chat.postMessage({
        channel: user.id,
        text: `Job ${jobId} created. ${nameList} ${plural ? "don't" : "doesn't"} have Slack — please fill in their completion record.`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `✅ Job *${jobId}* has been created.\n⚠️ You need to fill in the job details for *${nameList}* since ${plural ? "they don't" : `${nameList} doesn't`} have access to Slack.`,
            },
          },
          {
            type: "actions",
            elements: offlineTechNames.map(name => ({
              type: "button",
              text: { type: "plain_text", text: `Fill Record for ${name}`, emoji: true },
              style: "primary",
              action_id: "fill_offline_record",
              value: JSON.stringify({ jobId, techName: name }),
            })),
          },
        ],
      });
    } catch (err) {
      console.error("[handleNewJobForm] failed to send offline-tech DM:", err.message);
    }
  }
}

module.exports = handleNewJobForm ;
