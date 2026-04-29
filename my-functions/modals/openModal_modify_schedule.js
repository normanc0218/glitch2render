const axios = require('axios');
const qs = require('qs');
const db = require("../db");
const {createMultiInputBlock,
       createHeader,
       createDivider,
       createInputBlock_radio,
       createInputBlock_multistatic,   //block_id, label, action_id, placeholder, options
       createInputBlock_date,          //block_id, label, action_id, initial_date
       createInputBlock_time,          //block_id, label, action_id, initial_time
       createInputBlock_select,        //block_id, label, action_id, options 
       } = require("../utils/blockBuilder");

const { maintenanceStaff, Supervisors } = require('../userConfig');
//Options
const staffOptions = Object.entries(maintenanceStaff).map(([name, value]) => ({
  text: {
    type: "plain_text",
    text: name,
    emoji: true
  },
  value: value
}));
const superOption=Object.entries(Supervisors)
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

const openModal_modify_schedule = async(viewId,jobId) => {
  const snapshot = await db.ref(`jobs/Schedule/${jobId}`).once("value");
  const job = snapshot.val();
  if (!job) throw new Error("Job not found");
   const blocks = [
    createHeader("Modify Schedule Task"),
    createInputBlock_select({
        block_id: "machineLocation",
        label: "Machine and Location",
        action_id: "machineLocation",
        options: machineOptions, // <-- make sure this is passed in like this
        initial_option: job.machineLocation || []
      }),
      createDivider(),
      createMultiInputBlock(
        `description`,
        `Description of the Job`,
        `issue`,
        `Job Description`,
        false,
        job.description || ""
      ),
    createInputBlock_multistatic(`assignedTo`,`Assign the job to`,`pickedGuy`,`Select the person`,staffOptions),
    createInputBlock_select({
      block_id: "repeat",
      label: "Repeat",
      action_id: "repeat_option",
      options: repeatOptions,
      initial_option: job.repeat || []
    }),
    createInputBlock_radio({
        block_id: "supervisor_notify",
        label: "Notify the supervisor",
        action_id: "supervisor_notify",
        options: superOption
      }),
    createInputBlock_date(
      "startDate",
      "Start Date",
      "start_date_action",
      job.ModifyDate || ""
    ),
    createInputBlock_time(
      "startTime",
      "Start Time",
      "start_time_action",
      job.orderTime || ""
    )
  ];


  const modal = {
	"type": "modal",
  "callback_id":"modifySchedule",
  "private_metadata":jobId,
	"title": {
		"type": "plain_text",
		"text": "Modify Schedule Job",
		"emoji": true
	},
	"submit": {
		"type": "plain_text",
		"text": "Submit",
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
    token: process.env.SLACK_BOT_TOKEN,  // Ensure correct bot token
    view_id: viewId,  // The trigger ID that comes from the button press
    view: JSON.stringify(modal)  // Pass the modal structure as JSON
  };
  
  const result = await axios.post('https://slack.com/api/views.update', qs.stringify(args));
};
module.exports = openModal_modify_schedule;
