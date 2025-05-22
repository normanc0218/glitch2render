
const axios = require('axios');
const qs = require('qs');
const { db } = require('./db'); // Assumes you have a JSON DB module

const apiUrl = 'https://slack.com/api';

const updateView = async (user) => {
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

  let newData = [];
  try {
    const rawData = db.getData(`/${user}/data/`);
    newData = rawData.slice().reverse().slice(0, 50);
  } catch (error) {
    console.log(`No data for user ${user}:`, error.message);
  }

  if (newData.length > 0) {
    for (const o of newData) {
      const color = o.color || 'yellow';
      let note = o.note;
      if (note.length > 3000) {
        note = note.substr(0, 2980) + '... _(truncated)_';
      }

      blocks.push(
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
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: o.timestamp
            }
          ]
        },
        {
          type: "divider"
        }
      );
    }
  }

  return {
    type: 'home',
    title: {
      type: 'plain_text',
      text: 'Keep notes!'
    },
    blocks: blocks
  };
};

const displayHome = async (user, data) => {
  if (data) {
    db.push(`/${user}/data[]`, data, true);
  }

  const view = await updateView(user);

  try {
    const result = await axios.post(`${apiUrl}/views.publish`, qs.stringify({
      token: process.env.SLACK_BOT_TOKEN,
      user_id: user,
      view: JSON.stringify(view)
    }));

    if (result.data.error) {
      console.error('Slack API error:', result.data.error);
    }
  } catch (error) {
    console.error('Axios error:', error.message);
  }
};

const openModal = async (trigger_id) => {
  const modal = {
    type: 'modal',
    title: {
      type: 'plain_text',
      text: 'Create a stickie note'
    },
    submit: {
      type: 'plain_text',
      text: 'Create'
    },
    blocks: [
      {
        type: "input",
        block_id: "note01",
        label: {
          type: "plain_text",
          text: "Note"
        },
        element: {
          action_id: "content",
          type: "plain_text_input",
          placeholder: {
            type: "plain_text",
            text: "Take a note..."
          },
          multiline: true
        }
      },
      {
        type: "input",
        block_id: "note02",
        label: {
          type: "plain_text",
          text: "Color"
        },
        element: {
          type: "static_select",
          action_id: "color",
          options: [
            {
              text: {
                type: "plain_text",
                text: "Yellow"
              },
              value: "yellow"
            },
            {
              text: {
                type: "plain_text",
                text: "Blue"
              },
              value: "blue"
            }
          ]
        }
      }
    ]
  };

  try {
    const result = await axios.post(`${apiUrl}/views.open`, qs.stringify({
      token: process.env.SLACK_BOT_TOKEN,
      trigger_id: trigger_id,
      view: JSON.stringify(modal)
    }));

    if (result.data.error) {
      console.error('Modal open error:', result.data.error);
    }
  } catch (error) {
    console.error('Axios error while opening modal:', error.message);
  }
};

module.exports = {
  displayHome,
  openModal
};
