const axios = require('axios');
const qs = require('qs');
const db = require("../db");
const {createMultiInputBlock,
       createHeader,
       createDivider,
       createButton,
       createInputBlock,
       createInputBlock_multistatic,   //block_id, label, action_id, placeholder, options
       createInputBlock_date,          //block_id, label, action_id, initial_date
       createInputBlock_time,          //block_id, label, action_id, initial_time
       createInputBlock_select,        //block_id, label, action_id, options 
       } = require("../utils/blockBuilder");

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

const openModal_assign_dispatch = async(viewId,jobId) => {
  const snapshot = await db.ref(`jobs/Dispatch/${jobId}`).once("value");
  const job = snapshot.val();
  if (!job) throw new Error("Job not found");
   const blocks = [
    ...(job.issuePicture || []).map((url, i) => ({
      type: "image",
      image_url: url,
      alt_text: `picture ${i + 1}`,
      block_id: `issuePicture${i + 1}`
    })),
    createInputBlock_select({
        block_id: "machineLocation",
        label: "Machine and Location",
        action_id: "machineLocation",
        options: machineOptions, // <-- make sure this is passed in like this
        initial_option: job.machineLocation || []
      }),
    createDivider(),
    // createInputBlock(`reporter`,`Who found the issue?`,`reporter`,`Name of the Finder`,job.reporter|| ""),
    createMultiInputBlock(
        `description`,
        `Description of the Job`,
        `issue`,
        `Job Description`,
        false,
        job.description || ""
      ),
    createInputBlock_multistatic(`assignedTo`,`Assign the job to`,`pickedGuy`,`Select the person`,staffOptions),
    createInputBlock_date(`orderDate`,`Order Date`,`datepickeraction`,initialDate),
    createInputBlock_time(`orderTime`,`Order Time`,`timepickeraction`,initialTime),
    createDivider()

  ];


  const modal = {
	"type": "modal",
  "callback_id":"assignDispatch",
  "private_metadata":JSON.stringify({   // <-- 这里改成字符串
    jobId: jobId,
    issuePicture: job.issuePicture || [],
    dispatchDate: job.dispatchDate || "",
    dispatchTime: job.dispatchTime || ""
  }),
	"title": {
		"type": "plain_text",
		"text": "Assign the Dispatch",
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
module.exports = openModal_assign_dispatch;
