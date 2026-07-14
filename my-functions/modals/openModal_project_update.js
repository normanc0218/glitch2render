const { WebClient } = require("@slack/web-api");
const userConfig = require("../services/slackUserService");
const { getPool, sql } = require("../db-sql");
const {
  createInputBlock,
  createInputBlock_pic,
  createInputBlock_date,
  createInputBlock_time,
  createInputBlock_radio,
  createTextSection,
  createDivider,
} = require("../utils/blockBuilder");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

function getNYParts() {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  );
}

function fmtDate(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
}

async function fetchProject(projectId) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.UniqueIdentifier, projectId)
      .query(`
        SELECT p.title, p.status, p.description, p.issue_picture,
               p.machine_location, p.scheduled_start, p.scheduled_end,
               (SELECT TOP 1 pe.equipment_id  FROM ProjectEquipment pe WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_id,
               (SELECT TOP 1 e.area           FROM ProjectEquipment pe JOIN Equipment e ON e.equipment_id = pe.equipment_id WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_area,
               (SELECT TOP 1 e.machine_line   FROM ProjectEquipment pe JOIN Equipment e ON e.equipment_id = pe.equipment_id WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_machine_line,
               (SELECT TOP 1 e.equipment_name FROM ProjectEquipment pe JOIN Equipment e ON e.equipment_id = pe.equipment_id WHERE pe.project_id = p.id AND pe.equipment_id IS NOT NULL) AS equipment_name,
               (SELECT TOP 1 pe.equipment_other FROM ProjectEquipment pe WHERE pe.project_id = p.id AND pe.equipment_other IS NOT NULL) AS equipment_other
        FROM Projects p
        WHERE p.id = @id
      `);
    return result.recordset[0] || null;
  } catch (err) {
    console.error("fetchProject error:", err.message);
    return null;
  }
}

const STATUS_OPTIONS = [
  ["Complete the job", "completed"],
  ["Other situation",  "other_situation"],
];

const OTHER_SITUATION_OPTIONS = [
  ["Waiting for parts", "waiting_for_parts"],
  ["Temporarily fixed", "temporarily_fixed"],
  ["Follow up check",   "follow_up_check"],
];

function buildProjectUpdateModal(metaOrJobId, showOtherOptions = false, selectedStatus = null, selectedOtherStatus = null) {
  let jobId, projectInfo = null;
  try {
    const parsed = JSON.parse(metaOrJobId);
    jobId = parsed.jobId;
    projectInfo = parsed;
  } catch {
    jobId = metaOrJobId;
  }

  const p = getNYParts();
  const initialDate = `${p.year}-${p.month}-${p.day}`;
  const initialTime = `${p.hour.padStart(2, "0")}:${p.minute}`;
  const superOptions = Object.keys(userConfig.Supervisors).map(name => [name, name]);

  const blocks = [];

  if (projectInfo?.title) {
    const equipPath = projectInfo.equipmentArea
      ? [projectInfo.equipmentArea, projectInfo.equipmentLine, projectInfo.equipmentId].filter(Boolean).join(' > ')
      : (projectInfo.equipmentOther || projectInfo.machineLocation || 'N/A');
    const startStr = fmtDate(projectInfo.scheduledStart) || "N/A";
    const dueStr   = fmtDate(projectInfo.scheduledEnd)   || "N/A";
    let headerText = `*${projectInfo.title}*  •  ${projectInfo.status || ""}\n📍 ${equipPath}  •  Start: ${startStr}  •  Due: ${dueStr}`;
    if (projectInfo.description) headerText += `\n${projectInfo.description}`;
    blocks.push(createTextSection(headerText));

    // Show up to 3 issue pictures so the technician knows what to work on
    if (projectInfo.issuePicture) {
      try {
        const urls = JSON.parse(projectInfo.issuePicture);
        if (Array.isArray(urls) && urls.length > 0) {
          urls.slice(0, 3).forEach((url, i) => {
            blocks.push({ type: "image", image_url: url, alt_text: `Issue photo ${i + 1}` });
          });
        }
      } catch { /* not a JSON array — skip */ }
    }

    blocks.push(createDivider());
  }

  blocks.push(createInputBlock_pic("finishPicture", "Picture of Your Job Update", "file_input_action_id_1"));
  blocks.push(createInputBlock("supervisor_message", "Comments", "supervisor_message", "comments"));
  blocks.push(createInputBlock_radio({
    block_id: "supervisor_notify",
    label: "Notify the supervisor",
    action_id: "supervisor_notify",
    options: superOptions,
  }));
  blocks.push(createInputBlock_date("startDate", "Actual Start Date", "datepickeraction", initialDate));
  blocks.push(createInputBlock_time("startTime", "Actual Start Time", "timepickeraction", initialTime));
  blocks.push(createInputBlock_date("endDate", "Actual End Date", "datepickeraction", initialDate));
  blocks.push(createInputBlock_time("endTime", "Actual End Time", "timepickeraction", initialTime));

  const statusInitial = selectedStatus
    ? STATUS_OPTIONS.find(([, v]) => v === selectedStatus) || null
    : null;
  blocks.push(createInputBlock_radio({
    block_id: "project_complete_job",
    label: "Status of Completed Job",
    action_id: "project_complete_job",
    dispatch_action: true,
    options: STATUS_OPTIONS,
    initial_option: statusInitial,
  }));

  if (showOtherOptions) {
    const otherInitial = selectedOtherStatus
      ? OTHER_SITUATION_OPTIONS.find(([, v]) => v === selectedOtherStatus) || null
      : null;
    blocks.push(createInputBlock_radio({
      block_id: "project_other_status",
      label: "Other Situation",
      action_id: "project_other_status",
      options: OTHER_SITUATION_OPTIONS,
      initial_option: otherInitial,
    }));
  }

  return {
    type: "modal",
    callback_id: "update_project",
    private_metadata: metaOrJobId,
    title:  { type: "plain_text", text: "Update Your Job" },
    submit: { type: "plain_text", text: "Submit" },
    close:  { type: "plain_text", text: "Cancel" },
    blocks,
  };
}

const openModal_project_update = async (trigger_id, jobId) => {
  await userConfig.refreshIfStale();
  const project = await fetchProject(jobId);

  const meta = JSON.stringify({
    jobId,
    title:           project?.title                  || null,
    status:          project?.status                 || null,
    description:     project?.description            || null,
    equipmentId:     project?.equipment_id           || null,
    equipmentArea:   project?.equipment_area         || null,
    equipmentLine:   project?.equipment_machine_line || null,
    equipmentName:   project?.equipment_name         || null,
    equipmentOther:  project?.equipment_other        || null,
    machineLocation: project?.machine_location       || null,
    issuePicture:    project?.issue_picture          || null,
    scheduledStart:  project?.scheduled_start        || null,
    scheduledEnd:    project?.scheduled_end          || null,
  });

  await client.views.open({
    trigger_id,
    view: buildProjectUpdateModal(meta),
  });
};

module.exports = openModal_project_update;
module.exports.buildProjectUpdateModal = buildProjectUpdateModal;
