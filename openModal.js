const axios = require('axios');
const qs = require('qs');
const {createTextSection, 
       createInputBlock,               //block_id,label,action_id,placeholder
       createInputBlock_multistatic,   //block_id,label,action_id,placeholder,options
       createInputBlock_pic,           //block_id,label,action_id
       createDivider } = require("./blockBuilder");

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

const { maintenanceStaff, managerUsers } = require('./userConfig');
const staffOptions = Object.entries(maintenanceStaff).map(([name, value]) => ({
  text: {
    type: "plain_text",
    text: name,
    emoji: true
  },
  value: value
}));
const openModal = async(trigger_id) => {
  const blocks=[]
  blocks.push(createInputBlock(`reporter_block`,`Who found the issue?`,`reporter`,`Name of the Finder`));
  blocks.push(createInputBlock(`Description`,`Description of the issue`,`issue`,`What is the issue?`));
  blocks.push(createInputBlock_multistatic(`maintenanceStaff`,`Assign the job to`,`pickedGuy`,`Select the person`,staffOptions));
  blocks.push(createInputBlock_pic(`picture`,`Picture of the defect`,`file_input_action_id_1`));

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
	"blocks": [
		{
			"type": "input",
			"block_id": "machineLocation",
      "label": {
				"type": "plain_text",
				"text": "Machine and Location"
			},
			"element": {
				"type": "static_select",
				"placeholder": {
					"type": "plain_text",
					"text": "Select the Machine or Location",
					"emoji": true
				},
				"options": [
    {
      "text": {
        "type": "plain_text",
        "text": "#7 Machine",
        "emoji": true
      },
      "value": "#7 Machine"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "#8 Machine",
        "emoji": true
      },
      "value": "#8 Machine"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "#9 Machine",
        "emoji": true
      },
      "value": "#9 Machine"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "#10 Machine",
        "emoji": true
      },
      "value": "#10 Machine"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "#11 Machine",
        "emoji": true
      },
      "value": "#11 Machine"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "Packaging",
        "emoji": true
      },
      "value": "Packaging"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "Warehouse",
        "emoji": true
      },
      "value": "Warehouse"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "Loading dock",
        "emoji": true
      },
      "value": "Loading dock"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "Washroom",
        "emoji": true
      },
      "value": "Washroom"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "Die Washroom",
        "emoji": true
      },
      "value": "Die Washroom"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "Office",
        "emoji": true
      },
      "value": "Office"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "Boiler room",
        "emoji": true
      },
      "value": "Boiler room"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "Compressor",
        "emoji": true
      },
      "value": "Compressor"
    },
    {
      "text": {
        "type": "plain_text",
        "text": "Others",
        "emoji": true
      },
      "value": "Others"
    }
				],
				"action_id": "machineLocation"
			}
		},{
			"type": "input",
			"block_id": "reporter_block",
			"label": {
				"type": "plain_text",
				"text": "Who found the issue?"
			},
			"element": {
				"type": "plain_text_input",
				"action_id": "reporter",
				"placeholder": {
					"type": "plain_text",
					"text": "Name of the finder"
				}
			}
		},
		{
			"type": "input",
			"block_id": "Description",
			"label": {
				"type": "plain_text",
				"text": "Description of the issue"
			},
			"element": {
				"type": "plain_text_input",
				"action_id": "issue",
				"placeholder": {
					"type": "plain_text",
					"text": "What is the issue?"
				},
				"multiline": true
			}
		},
		{
			"type": "input",
			"block_id": "maintenanceStaff",
			"label": {
				"type": "plain_text",
				"text": "Assign the job to"
			},
			"element": {
				"type": "multi_static_select",
				"placeholder": {
					"type": "plain_text",
					"text": "Select the person",
					"emoji": true
				},
				"options": staffOptions,
				"action_id": "pickedGuy"
			}
		},
		{
			"type": "input",
			"block_id": "picture",
			"label": {
				"type": "plain_text",
				"text": "Picture of the defect"
			},
			"element": {
				"type": "file_input",
				"action_id": "file_input_action_id_1",
				"filetypes": [
					"jpg",
					"png"
				],
				"max_files": 5
			}
		},
		{
			"type": "input",
      "block_id":"date",
			"element": {
				"type": "datepicker",
				"initial_date": initialDate,
				"placeholder": {
					"type": "plain_text",
					"text": "Select a date",
					"emoji": true
				},
				"action_id": "datepickeraction"
			},
			"label": {
				"type": "plain_text",
				"text": "Start date",
				"emoji": true
			}
		},
		{
			"type": "input",
      "block_id":"time",
			"element": {
				"type": "timepicker",
				"initial_time": initialTime,
				"placeholder": {
					"type": "plain_text",
					"text": "Select time",
					"emoji": true
				},
				"action_id": "timepickeraction"
			},
			"label": {
				"type": "plain_text",
				"text": "Start time",
				"emoji": true
			}
		}
	]
};

  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    trigger_id: trigger_id,
    view: JSON.stringify(modal)
  };
  
  const result = await axios.post('https://slack.com/api/views.open', qs.stringify(args));
};
module.exports = { openModal};