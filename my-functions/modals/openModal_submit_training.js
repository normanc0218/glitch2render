const axios = require("axios");
const qs = require("qs");
const {
  createInputBlock,
  createMultiInputBlock,
  createInputBlock_date,
  createInputBlock_select,
  createInputBlock_pic,  
  createInputBlock_time,         
  createDivider
} = require("../utils/blockBuilder");

const { maintenanceStaff } = require("../userConfig");

// 🧑‍🔧 技师选项
const staffOptions = Object.entries(maintenanceStaff).map(([name, value]) => ({
  text: { type: "plain_text", text: name, emoji: true },
  value: value
}));

// 🗓 获取纽约日期
function getNYParts() {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  );
}
const machineOptions = [
  "#7 Machine", "#8 Machine", "#9 Machine", "#10 Machine", "#11 Machine",
  "Packaging", "Warehouse", "Loading dock", "Washroom", "Die Washroom",
  "Office", "Boiler room", "Compressor", "Others"
];
// 🕒 打开 Training Modal
const openModal_submit_training = async (trigger_id) => {
  const p = getNYParts();
  const initialDate = `${p.year}-${p.month}-${p.day}`;
  const initialTime = `${p.hour.padStart(2, "0")}:${p.minute}`;
  const blocks = [];
  blocks.push(createInputBlock_select({
    block_id: "machineLocation",
    label: "Machine and Location",
    action_id: "machineLocation",
    options: machineOptions, // <-- make sure this is passed in like this
  }));

  // 🧾 培训内容
  blocks.push(
    createMultiInputBlock("description", "Training Description", "issue", "Describe what was trained")
  );
  // Picture of the job
  blocks.push(createInputBlock_pic(`picture`,`Picture of the Trainee Job`,`file_input_action_id_1`,true));
    // 👨‍🔧 选择受训人员
  blocks.push(createInputBlock(`traineeName`,`Trainee Name`,`trainee`,`Name of the Trainee`));



  // 🗓 培训日期
  blocks.push(createInputBlock_date("orderDate", "Training Date", "datepickeraction", initialDate));
  blocks.push(createInputBlock_time(`orderTime`,`Training Time`,`timepickeraction`,initialTime));
  // 🧾 Comments
  blocks.push(
    createMultiInputBlock("comment", "Trainer Comment", "comment", "Comments?")
  );

  blocks.push(createDivider());

  const modal = {
    type: "modal",
    callback_id: "trainingRecord",
    title: { type: "plain_text", text: "Submit Training Record" },
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks
  };

  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id,
    view: JSON.stringify(modal)
  };

  try {
    const result = await axios.post("https://slack.com/api/views.open", qs.stringify(args));
    if (!result.data.ok) {
      console.error("❌ Slack API Error:", result.data);
    } else {
      console.log("✅ Training Modal opened successfully");
    }
  } catch (err) {
    console.error("❌ Failed to open Training Modal:", err);
  }
};

module.exports = openModal_submit_training;
