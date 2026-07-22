// services/handlers/handleNewJobForm.js
const generateUniqueJobId = require("../../utils/generateUniqueJobId");
const { saveJob } = require("../firebaseService");
const { getPool, sql } = require("../../db-sql");
const resolveDisplayName = require("../../utils/resolveDisplayName");
const { invalidateDispatchCache } = require("../dispatchService");
const { findDynBlock } = require("../../utils/blockReader");

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
async function handleNewDispatchForm(payload) {
  const { user, view } = payload;
  const ts = new Date();
  let jobId = await generateUniqueJobId(user?.id === "U_E2E" || process.env.FORCE_TEST_JOB_IDS === "true");
  jobId = `DSP${jobId.slice(3)}`;

  const orderedBy = await resolveDisplayName(user?.id, user?.username);
  const selectedEquipmentId = findDynBlock(view.state.values, 'equipmentId')?.value || null;
  const selectedArea        = view.state.values?.area?.area?.selected_option?.value || null;
  const isOther             = selectedArea === "__other__";
  const otherLocation       = view.state.values?.otherLocation?.otherLocation?.value || null;
  const otherEquipment      = view.state.values?.otherEquipment?.otherEquipment?.value || null;

  const resolvedEquipmentId   = selectedEquipmentId || (isOther ? "other" : null);
  const resolvedEquipmentName = selectedEquipmentId
    ? await resolveEquipmentName(selectedEquipmentId)
    : (otherEquipment || "N/A");
  const resolvedArea          = isOther ? (otherLocation || null) : selectedArea;
  const resolvedMachineLine   = isOther ? null : (findDynBlock(view.state.values, 'machineLine')?.value || null);

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
    dispatchDatetime: `${view.state.values?.dispatchDate?.datepickeraction?.selected_date || ts.toISOString().slice(0, 10)}T${(view.state.values?.dispatchTime?.timepickeraction?.selected_time || ts.toTimeString().slice(0, 5)).slice(0, 5)}`,
    status: "Dispatched",
  };

  // 保存任务
  await saveJob(`jobs/Dispatch`,data);
  invalidateDispatchCache();
  // // 通知频道
  // await notifyNewOrder(data, jobId);
}

module.exports = handleNewDispatchForm ;
