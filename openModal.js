const axios = require('axios');
const qs = require('qs');
const {createTextSection, 
       createInputBlock,               //block_id, label, action_id, placeholder
	   createMultiInputBlock,
       createInputBlock_multistatic,   //block_id, label, action_id, placeholder, options
       createInputBlock_pic,           //block_id, label, action_id
       createInputBlock_date,          //block_id, label, action_id, initial_date
       createInputBlock_time,          //block_id, label, action_id, initial_time
       createInputBlock_select,        //block_id, label, action_id, options 
       createDivider } = require("./blockBuilder");

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
const { maintenanceStaff, managerUsers } = require('./userConfig');
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

const openModal = async(trigger_id) => {
  const blocks=[]
  blocks.push(createInputBlock_select({
    block_id: "machineLocation",
    label: "Machine and Location",
    action_id: "machineLocation",
    options: machineOptions, // <-- make sure this is passed in like this
  }));
  blocks.push(createInputBlock(`reporter_block`,`Who found the issue?`,`reporter`,`Name of the Finder`));
  blocks.push(createMultiInputBlock(`Description`,`Description of the issue`,`issue`,`What is the issue?`));
  blocks.push(createInputBlock_multistatic(`maintenanceStaff`,`Assign the job to`,`pickedGuy`,`Select the person`,staffOptions));
  blocks.push(createInputBlock_pic(`picture`,`Picture of the defect`,`file_input_action_id_1`));
  blocks.push(createInputBlock_date(`date`,`Start Date`,`datepickeraction`,initialDate));  
  blocks.push(createInputBlock_time(`time`,`Start Time`,`timepickeraction`,initialTime));


  const modal = {
	"type": "modal",
  "callback_id":"new_job_form",
	"title": {
		"type": "plain_text",
		"text": "Maintenance Order Form",
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
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: trigger_id,
    view: JSON.stringify(modal)
  };
  
  const result = await axios.post('https://slack.com/api/views.open', qs.stringify(args));
};
module.exports = { openModal};
