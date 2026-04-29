const axios = require('axios');
const qs = require('qs');
const db = require(`../db`);
const {createTextSection, 
       createInputBlock,               //block_id, label, action_id, placeholder
       createMultiInputBlock,
       createButton,
       createInputBlock_multistatic,   //block_id, label, action_id, placeholder, options
       createInputBlock_pic,           //block_id, label, action_id
       createInputBlock_date,          //block_id, label, action_id, initial_date
       createInputBlock_time,          //block_id, label, action_id, initial_time
       createInputBlock_select,        //block_id, label, action_id, options 
       createDivider } = require("../utils/blockBuilder");

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
}
const initialTime = getNYTimeString();
const { maintenanceStaff, managerUsers } = require('../userConfig');
//Options
const staffOptions = Object.entries(maintenanceStaff).map(([name, value]) => ({
  text: {
    type: "plain_text",
    text: name,
    emoji: true
  },
  value: value
}));
const machineOptions = [
  "#7 Machine", "#8 Machine", "#9 Machine", "#10 Machine", "#11 Machine",
  "Packaging", "Warehouse", "Loading dock", "Washroom", "Die Washroom",
  "Office", "Boiler room", "Compressor", "Others"
];
const repeatOptions = ["daily", "weekly", "monthly"];

//functions
function addDaysToDate(dateStr, daysToAdd = 1) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + daysToAdd);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const openModal_manage_schedule = async(trigger_id) => {

  const scheduleSnap = await db.ref("jobs/Schedule").once("value");
  const schedule = scheduleSnap.val() || {};
  const scheduleList = Object.entries(schedule).map(([id, details]) => ({
    id,
    ...details
  }));
  console.log(scheduleList);
  const blocks=[]
  for (const job of scheduleList) {
        // console.log(job);
blocks.push(
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${job.id}* — *${job.description || " "}* 
      📍 ${job.machineLocation || "N/A"}
      👤 Assigned To: ${job.assignedTo || "N/A"}
      🕒 Start Time: ${job.orderTime || "N/A"}
      🔁 Repeat: ${job.repeat || "Unknown"}`
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Modify" },
              value: job.id,
              action_id: "openModal_modify_schedule",
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Delete" },
              style: "danger",
              value: job.id,
              action_id: "delete_schedule",
              confirm: {
                title: { type: "plain_text", text: "Confirm delete" },
                text: { type: "mrkdwn", text: "Are you sure you want to delete this schedule?" },
                confirm: { type: "plain_text", text: "Yes, delete" },
                deny: { type: "plain_text", text: "Cancel" },
              },
            },
          ],
        }
      );
        blocks.push({ type: "divider" });
      };
  blocks.push(
    createButton("Add Schedule Job", "no value", "openModal_add_schedule"));

  const modal = {
	"type": "modal",
  "callback_id":"managescheduleWork",
	"title": {
		"type": "plain_text",
		"text": "Manage Schedule Job",
		"emoji": true
	},
	"close": {
		"type": "plain_text",
		"text": "Cancel",
		"emoji": true
	},
	blocks
};

  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: trigger_id,
    view: JSON.stringify(modal)
  };
  
  const result = await axios.post('https://slack.com/api/views.open', qs.stringify(args));
};
module.exports = openModal_manage_schedule;
