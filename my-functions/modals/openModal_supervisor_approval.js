const axios = require('axios');
const {
  createInputBlock,
  createInputBlock_select,
  createTextSection,
  createInputBlock_date,
  createInputBlock_time,
  createInputBlock_checkboxes,
  createInputBlock_radio,
  createInputBlock_pic
} = require('../utils/blockBuilder');
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

// list of managerUser IDs
const {Supervisors} = require('../userConfig');
const superOption=Object.entries(Supervisors)


const openModal_supervisor_approval = async (trigger_id, jobId) => {
  const blocks=[]
  blocks.push(createInputBlock_select({
    block_id: "tool_check",
    label: "Assigned Maintenance has/have collected their tools and materials",
    action_id: "tool_check",
    options: ["Yes","No"], // <-- make sure this is passed in like this
  }));
  blocks.push(createInputBlock_select({
    block_id: "working_area",
    label: "Working area needs extra helps for cleaning?",
    action_id: "working_area",
    options: ["Yes","No"], // <-- make sure this is passed in like this
  }));
  blocks.push(createInputBlock("clean_input", "Assign who to help cleaning?", "clean_input", "e.g. Somebody",true));
  blocks.push(createInputBlock("detailOfJob", "*Specify other details related to this job", "detailOfJob", "e.g. Something",true));

  blocks.push(createInputBlock_date("checkDate", "Check Date", "datepickeraction", initialDate));
  blocks.push(createInputBlock_time("checkTime", "Check Time", "timepickeraction", initialTime));
  const modal ={
	type: "modal",
	callback_id: "review",
	private_metadata: jobId,
	title: {
		type: "plain_text",
		text: "Review progress"
	},
	submit: {
		type: "plain_text",
		text: "Approved"
	},
	close: {
		type: "plain_text",
		text: "Cancel"
	},
	blocks
}


  try {
    const response = await axios.post(
      'https://slack.com/api/views.open',
      {
        trigger_id: trigger_id,
        view: modal
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
        }
      }
    );

    if (!response.data.ok) {
      console.error("Slack API error:", response.data);
    }

  } catch (err) {
    console.error("Modal open error:", err.response?.data || err.message);
  }
};

module.exports = openModal_supervisor_approval;
