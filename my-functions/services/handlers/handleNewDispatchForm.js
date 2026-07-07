// services/handlers/handleNewJobForm.js
const generateUniqueJobId = require("../../utils/generateUniqueJobId");
const { saveJob } = require("../firebaseService");
const { getPool, sql } = require("../../db-sql");

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
  let jobId = await generateUniqueJobId();
  jobId = `DSP${jobId.slice(3)}`;

  const selectedEquipmentId = view.state.values?.equipmentId?.equipmentId?.selected_option?.value || null;
  const otherEquipment = view.state.values?.otherEquipment?.otherEquipment?.value || null;
  const machineLocation = selectedEquipmentId
    ? await resolveEquipmentName(selectedEquipmentId)
    : (otherEquipment || "N/A");

  const data = {
    jobId,
    timestamp: ts.toLocaleString("en-US", { timeZone: "America/New_York" }),
    orderedBy: user?.username || "Unknown",
    area:            view.state.values?.area?.area?.selected_option?.value || null,
    machineLine:     view.state.values?.machineLine?.machineLine?.selected_option?.value || null,
    machineLocation,
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
