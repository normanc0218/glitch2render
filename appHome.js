const axios = require("axios");
const qs = require("qs");
const { JsonDB, Config } = require("node-json-db"); // Ensure this is your database module
const apiUrl = "https://slack.com/api"; // Define Slack API URL

const db = new JsonDB(new Config("myDatabase", true, false, "/")); // Adjust name and config as needed

// generateUUID
function generateUniqueJobId() {
  let jobId;
  let exists = true;

  while (exists) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    jobId = `JOB-${dateStr}-${randomStr}`;
    exists = false;
    try {
      const allUsers = db.getData("/"); // root object: { user1: { data: [...] }, user2: { data: [...] }, ... }

      for (const user in allUsers) {
        const userJobs = allUsers[user]?.data || [];
        if (userJobs.some((job) => job.JobId === jobId)) {
          exists = true;
          break;
        }
      }
    } catch (error) {
      // If /jobs doesn't exist yet, that's fine — it means no data yet
      exists = false;
    }
  }

  return jobId;
}
//Update the view
const updateView = async (user) => {
  let blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "This is the Form for Manager and Supervisors to assign Maintenance jobs to Maintenance people.",
      },
      accessory: {
        type: "button",
        action_id: "add_note",
        text: {
          type: "plain_text",
          text: "Submit an order",
          emoji: true,
        },
      },
    },
    {
      type: "divider",
    },
  ];

  let newData = [];
  try {
    const rawData = await db.getData(`/${user}/data/`);
    newData = rawData.slice().reverse().slice(0, 50); // latest 50
  } catch (error) {
    console.error("Error fetching data:", error);
  }

  if (newData.length > 0) {
    for (const o of newData) {
      let des = o.Description || "(No description provided)";
      if (des.length > 3000) des = des.substr(0, 2980) + "... _(truncated)_";
      console.log(o)
      console.log(user)
      const isAssignedToUser = o.mStaff_id.includes(user);

      const noteBlocks = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Machine:* ${o.machineLocation || "N/A"}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Job ID:* ${o.JobId}\n*Description:* ${des}\n*Assign To:* ${o.maintenanceStaff}\n*Start date:* ${o.date}\n*Start time:* ${o.time}\n*Status:* ${o.status}`,
          },
          accessory: {
            type: "image",
            image_url: o.picture[0],
            alt_text: "picture",
          },
        },
      ];

      if (isAssignedToUser) {
        if (o.status === "Pending") {
          noteBlocks.push({
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Accept", emoji: true },
                style: "primary",
                action_id: "accept_task",
                value: o.JobId,
              },
              {
                type: "button",
                text: { type: "plain_text", text: "Reject", emoji: true },
                style: "danger",
                action_id: "decline_task",
                value: o.JobId,
              },
            ],
          });
        } else if (o.status === "Accepted") {
          noteBlocks.push({
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Job Done", emoji: true },
                style: "primary",
                action_id: "job_done",
                value: o.JobId,
              },
            ],
          });
        }
      };

      noteBlocks.push(
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "View Details",
                emoji: true,
              },
              value: o.JobId,
            },
          ],
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `🕒 ${o.timestamp || "No timestamp"}`,
            },
          ],
        },
        {
          type: "divider",
        }
      );

      blocks = blocks.concat(noteBlocks);
    }
  }

  const view = {
    type: "home",
    title: {
      type: "plain_text",
      text: "Keep notes!",
    },
    blocks: blocks,
  };

  return JSON.stringify(view);
};

/* Display App Home */
const displayHome = async (user, data) => {
  console.log(`Displaying app home...`);
  if (data) {
    // Store in a local DB
    const JobId = await generateUniqueJobId();
    data.JobId = JobId;
    db.push(`/${user.id}/data[]`, data, true);
  }
  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    user_id: user.id,
    view: await updateView(user.id),
  };
  const result = await axios.post(
    `${apiUrl}/views.publish`,
    qs.stringify(args)
  );

  try {
    if (result.data.error) {
      console.log(result.data.error);
    }
  } catch (e) {
    console.log(e);
  }
};

module.exports = { displayHome };
