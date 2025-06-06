const axios = require('axios');
const qs = require('qs');
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



const openModal_general_approval = async (viewId, jobId) => {
   const blocks=[]
  blocks.push(createInputBlock_select({
    block_id: "tool_id",
    label: "Assigned Maintenance has/have collected their tools and materials",
    action_id: "Maitenance_tool",
    options: ["Yes","No"], // <-- make sure this is passed in like this
  }));
  blocks.push(createInputBlock_pic("picture", "How is the job?", "file_general_input"))

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

// API call to open the modal
  const args = {
    token: process.env.SLACK_BOT_TOKEN,  // Ensure correct bot token
    view_id: viewId,  // The trigger ID that comes from the button press
    view: JSON.stringify(modal)  // Pass the modal structure as JSON
  };

  try {
    const result = await axios.post('https://slack.com/api/views.update', qs.stringify(args));
    
    if (result.data.ok) {
      console.log('Modal opened successfully!');
    } else {
      console.error('Error opening modal:', result.data.error);  // Log any error response
    }
  } catch (error) {
    console.error('Error during modal open request:', error.message);  // Handle network or other errors
  }
};

module.exports = { openModal_general_approval };
