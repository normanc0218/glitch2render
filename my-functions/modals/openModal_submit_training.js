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
const nyDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date()); // e.g. "2025-05-28"
const [month, day, year] = nyDate.split('/');
const initialDate = `${year}-${month}-${day}`;
function getNYTimeString() {
  const d = new Date();
  const ny = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hh = ny.getHours().toString().padStart(2, '0');
  const mm = ny.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
};
const machineOptions = [
  "#7 Machine", "#8 Machine", "#9 Machine", "#10 Machine", "#11 Machine",
  "Packaging", "Warehouse", "Loading dock", "Washroom", "Die Washroom",
  "Office", "Boiler room", "Compressor", "Others"
];
const initialTime = getNYTimeString();

// 🕒 打开 Training Modal
const openModal_submit_training = async (trigger_id) => {
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
