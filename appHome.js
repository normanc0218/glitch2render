const axios = require('axios');
const qs = require('qs');
const { JsonDB, Config } = require('node-json-db');  // Ensure this is your database module
const apiUrl = 'https://slack.com/api';  // Define Slack API URL

const db = new JsonDB(new Config("myDatabase", true, false, '/')); // Adjust name and config as needed

// generateUUID
function generateUniqueJobId() {
  let jobId;
  let exists = true;

  while (exists) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    jobId = `JOB-${dateStr}-${randomStr}`;

    try {
      const jobs = db.getData('/jobs');
      exists = jobs.some(job => job.jobId === jobId);
    } catch (error) {
      // If /jobs doesn't exist yet, that's fine — it means no data yet
      exists = false;
    }
  }

  return jobId;
}
//Update the view
const updateView = async(user) => {
  // Intro message - 
  let blocks = [ 
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "This is the Form for Manager and Supervisors to assign Maintenance job to Maintenance people."
      },
      accessory: {
        type: "button",
        action_id: "add_note", 
        text: {
          type: "plain_text",
          text: "Submit an order",
          emoji: true
        }
      }
    },
    {
      type: "divider"
    }
  ];
  // Append new data blocks after the intro - 
  let newData = [];
  try {
    const rawData = await db.getData(`/${user}/data/`);
    newData = rawData.slice().reverse(); // Reverse to make the latest first
    newData = newData.slice(0, 50); // Just display 20. Block Kit display has some limit.
  } catch(error) {
    //console.error(error); 
  };
  if (newData && newData.length > 0) {
  for (const o of newData) {
    let des = o.Description || "(No description provided)";
    const JobID = await generateUniqueJobId();
    if (des.length > 3000) {
      des = des.substr(0, 2980) + '... _(truncated)_';
    }
    console.log(o.picture);
    const noteBlocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Machine:* ${o.machineLocation || "N/A"}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Job ID:* ${JobID}\n*Description:* ${des}\n*Assign To:* ${o.maintenanceStaff}\n*Start date:* ${o.date}\n*Start time:* ${o.time}`
        },
        accessory: {
          type: "image",
          image_url: o.picture[0],
          alt_text: "picture"
        }
      },		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Approve",
						"emoji": true
					},
					"style": "primary",
          "action_id": "accept_task",
					"value": "approve"
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Decline",
						"emoji": true
					},
					"style": "danger",
          "action_id": "decline_task",
					"value": "decline"
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "View Details",
						"emoji": true
					},
					"value": "details"
				}
			]
		},
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `🕒 ${o.timestamp || "No timestamp"}`
          }
        ]
      },
      {
        type: "divider"
      }
    ];

    blocks = blocks.concat(noteBlocks);
  }
}
  // The final view -
  let view = {
    type: 'home',
    title: {
      type: 'plain_text',
      text: 'Keep notes!'
    },
    blocks: blocks
  }
  return JSON.stringify(view);
};

/* Display App Home */
const displayHome = async(user, data) => {
  if(data) {     
    // Store in a local DB
    db.push(`/${user}/data[]`, data, true);   
  }
  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    user_id: user,
    view: await updateView(user)
  };
  const result = await axios.post(`${apiUrl}/views.publish`, qs.stringify(args));
  try {
    if(result.data.error) {
      console.log(result.data.error);
    }
  } catch(e) {
    console.log(e);
  }
};

module.exports = { displayHome };
