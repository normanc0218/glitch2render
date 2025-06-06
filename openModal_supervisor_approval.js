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
} = require('./blockBuilder');
const nyDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date()); // e.g. "2025-05-28"
const [month, day, year] = nyDate.split('/');
const initialDate = `${year}-${month}-${day}`;

const initialTime =  new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/New_York"
}).format(new Date()); // e.g. "14:37"

// list of managerUser IDs
const {Supervisors} = require('./userConfig');
const superOption=Object.entries(Supervisors)


const openModal_supervisor_approval = async (trigger_id, jobId) => {
  const blocks=[]
  blocks.push(createInputBlock_select({
    block_id: "tool_id",
    label: "Assigned Maintenance has/have collected their tools and materials",
    action_id: "Maitenance_tool",
    options: ["Yes","No"], // <-- make sure this is passed in like this
  }));
  blocks.push(createInputBlock_select({
    block_id: "clean_id",
    label: "Working area needs extra helps for cleaning?",
    action_id: "working_area",
    options: ["Yes","No"], // <-- make sure this is passed in like this
  }));
  blocks.push(createInputBlock("clean_input", "Assign who to help cleaning?", "name_clean", "e.g. Somebody",true));
  blocks.push(createInputBlock("other_input", "*Specify other details related to this job", "detailOfJob", "e.g. Something",true));

  blocks.push(createInputBlock_date("date", "Check Date", "datepickeraction", initialDate));
  blocks.push(createInputBlock_time("time", "Check Time", "timepickeraction", initialTime));
  const modal ={
	type: "modal",
	callback_id: "review_progress",
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
;

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

module.exports = { openModal_supervisor_approval };
