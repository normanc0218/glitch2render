const axios = require('axios');
const qs = require('qs');

const {createTextSection, 
       createInputBlock,               //block_id, label, action_id, placeholder
       createMultiInputBlock,
       createInputBlock_radio,
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
const { maintenanceStaff, Supervisors} = require('../userConfig');
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
const repeatOptions = ["daily", "onFriday"];

//functions
function addDaysToDate(dateStr, daysToAdd = 1) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + daysToAdd);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const openModal_add_schedule = async(viewId) => {
  const blocks=[]
  blocks.push(createInputBlock_select({
    block_id: "machineLocation",
    label: "Machine and Location",
    action_id: "machineLocation",
    options: machineOptions, // <-- make sure this is passed in like this
  }));
  blocks.push(createMultiInputBlock(`description`,`Description of the Job`,`issue`,`Job Description`));
  blocks.push(createInputBlock_multistatic(`assignedTo`,`Assign the job to`,`pickedGuy`,`Select the person`,staffOptions));
  blocks.push(createInputBlock_select({
  block_id: "repeat",
  label: "Repeat Option",
  action_id: "repeat_option",
  options: repeatOptions}));
  blocks.push(createInputBlock_radio({
    block_id: "supervisor_notify",
    label: "Notify the supervisor",
    action_id: "supervisor_notify",
    options: superOption
  }));
  // blocks.push(createInputBlock_pic(`picture`,`Picture of the defect`,`file_input_action_id_1`));
  blocks.push(createInputBlock_date(`startDate`,`Start Date`,`datepickeraction`,initialDate));  
  blocks.push(createInputBlock_time(`startTime`,`Start Time`,`timepickeraction`,initialTime));



  const modal = {
	"type": "modal",
  "callback_id":"createSchedule",
	"title": {
		"type": "plain_text",
		"text": "Add Schedule Job",
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
module.exports = openModal_add_schedule;
