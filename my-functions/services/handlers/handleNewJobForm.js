// services/handlers/handleNewJobForm.js
const generateUniqueJobId = require("../../utils/generateUniqueJobId");
const { saveJob } = require("../firebaseService");
const { notifyNewOrder } = require("../../utils/notifyChannel");
const { displayHome } = require("../modalService");
const { getPool, sql } = require("../../db-sql");
const resolveDisplayName = require("../../utils/resolveDisplayName");
const { RegularJobCreateSchema } = require("../../schemas/regularJob");
const userConfig = require("../slackUserService");

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
    assignedTo:
      view.state.values?.assignedTo?.pickedGuy?.selected_options?.map(
        (opt) => opt.text.text 
      ) || [],
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

  // Refresh the assigned technician(s)' Home tab so the new job shows up
  // immediately, instead of waiting for them to navigate away and back.
  for (const name of data.assignedTo || []) {
    const techSlackId = userConfig.maintenanceStaff[name];
    if (techSlackId && techSlackId !== user.id) {
      displayHome(techSlackId).catch(err =>
        console.error("Failed to refresh assigned technician's home:", err.message)
      );
    }
  }
}

module.exports = handleNewJobForm ;
