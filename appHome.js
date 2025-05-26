const axios = require('axios');
const qs = require('qs');
const { JsonDB, Config } = require('node-json-db');  // Ensure this is your database module
const apiUrl = 'https://slack.com/api';  // Define Slack API URL

const db = new JsonDB(new Config("myDatabase", true, false, '/')); // Adjust name and config as needed

const updateView = async(user) => {
  // Intro message - 
  let blocks = [ 
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Hello! Make a note of things you don't want to forget."
      },
      accessory: {
        type: "button",
        action_id: "add_note", 
        text: {
          type: "plain_text",
          text: "Add sticky note",
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
    const rawData = db.getData(`/${user}/data/`);
    newData = rawData.slice().reverse(); // Reverse to make the latest first
    newData = newData.slice(0, 50); // Just display 20. Block Kit display has some limit.
  } catch(error) {
    //console.error(error); 
  };
  if(newData) {
    let noteBlocks = [];
    for (const o of newData) {
      const color = (o.color) ? o.color : 'yellow';
      let note = o.note;
      if (note.length > 3000) {
        note = note.slice(0, 2980) + '... _(truncated)_'
        console.log(note.length);
      }
      noteBlocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: note
          },
          accessory: {
            type: "image",
            image_url: `https://cdn.glitch.com/0d5619da-dfb3-451b-9255-5560cd0da50b%2Fstickie_${color}.png`,
            alt_text: "stickie note"
          }
        },
        {
          "type": "context",
          "elements": [
            {
              "type": "mrkdwn",
              "text": o.timestamp
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
  if (data) {
    db.push(`/${user}/data[]`, data, true);
  }

  const view = await updateView(user); // Should be a string

  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    user_id: user,
    view: view,
  };

  try {
    console.log('Sending request to Slack API:', args); // Debugging the payload
    const result = await axios.post(`${apiUrl}/views.publish`, qs.stringify(args), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 5000
    });

    console.log("Slack API response:", result.data); // Debugging the response

    if (result.data.error) {
      console.error("Slack API error:", result.data.error);
    } else {
      console.log("✅ App home published successfully.");
    }
  } catch (e) {
    console.error("❌ Failed to update view:", e.message);
  }
};


module.exports = { displayHome };

