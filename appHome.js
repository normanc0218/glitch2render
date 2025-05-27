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
  if(newData) {
    let noteBlocks = [];
    for (const o of newData) {
      const color = (o.color) ? o.color : 'yellow';
      let note = o.note;
      if (note.length > 3000) {
        note = note.substr(0, 2980) + '... _(truncated)_'
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


// const updateView = async (user) => {
//   // Intro message
//   let blocks = [
//     {
//       type: "section",
//       text: {
//         type: "mrkdwn",
//         text: "Hello! Make a note of things you don't want to forget."
//       },
//       accessory: {
//         type: "button",
//         action_id: "add_note",
//         text: {
//           type: "plain_text",
//           text: "Add sticky note",
//           emoji: true
//         }
//       }
//     },
//     {
//       type: "divider"
//     }
//   ];

//   let newData = [];
//   try {
//     // Await the result of db.getData
//     const rawData = await db.getData(`/${user}/data/`);

//     // Check if rawData is an array
//     if (Array.isArray(rawData)) {
//       newData = rawData.slice().reverse(); // Reverse to make the latest first
//       newData = newData.slice(0, 50); // Just display 50 notes (adjust as needed)
//     } else {
//       console.warn('Data for user is not an array:', rawData);
//     }
//   } catch (error) {
//     console.error('Error fetching data:', error);
//   }

//   if (newData.length > 0) {
//     let noteBlocks = [];
//     for (const o of newData) {
//       const color = (o.color) ? o.color : 'yellow';
//       let note = o.note;
//       if (note.length > 3000) {
//         note = note.slice(0, 2980) + '... _(truncated)_';
//         console.log('Truncated note:', note);
//       }

//       noteBlocks.push({
//         type: "section",
//         text: {
//           type: "mrkdwn",
//           text: note
//         },
//         accessory: {
//           type: "image",
//           image_url: `https://cdn.glitch.com/0d5619da-dfb3-451b-9255-5560cd0da50b%2Fstickie_${color}.png`,
//           alt_text: "stickie note"
//         }
//       });

//       noteBlocks.push({
//         type: "context",
//         elements: [
//           {
//             type: "mrkdwn",
//             text: o.timestamp
//           }
//         ]
//       });

//       noteBlocks.push({
//         type: "divider"
//       });
//     }

//     blocks = blocks.concat(noteBlocks);
//     blocks = blocks.slice(0, 100);
//   } else {
//     console.log('No notes available for user:', user);
//   }

//   // Final view structure
//   const view = {
//     type: 'home',
//     title: {
//       type: 'plain_text',
//       text: 'Keep notes!'
//     },
//     blocks: blocks
//   };

//   return view;
// };



// /* Display App Home */
// const displayHome = async(user, data) => {
//   if (data) {
//     db.push(`/${user}/data[]`, data, true); // Save new data to the DB
//   }

//   const view = await updateView(user); // Get the updated view once

//   try {
//     // Sending updated view to Slack

//     const result = await axios.post(`${apiUrl}/views.publish`, {
//       user_id: user,
//       view: view // Send the view directly
//     }, {
//       headers: {
//         'Content-Type': 'application/json',
//         'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
//       }
//     });


//     if (result.data.error) {
//       console.error("Slack API error:", result.data.error);
//     } else {
//       console.log("✅ App home published successfully.");
//     }
//   } catch (e) {
//     console.error("❌ Failed to update view:", e.message);
//   }
// };

module.exports = { displayHome };
