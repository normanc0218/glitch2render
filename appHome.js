const axios = require("axios");
const qs = require("qs");
const { JsonDB, Config } = require("node-json-db"); // Ensure this is your database module
const apiUrl = "https://slack.com/api"; // Define Slack API URL

const db = new JsonDB(new Config("myDatabase", true, false, "/")); // Adjust name and config as needed

const managerUsers = [
  "U01", // Slack user ID
];
// generateUUID
async function generateUniqueJobId()  {
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
  let blocks;
  if (managerUsers.includes(user)) {
  blocks.push({
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
  });
} else {
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: "Welcome! Here you can view your assigned maintenance tasks.",
    },
  });
}

  let newData = [];
  try {
    const rawData = await db.getData(`/data/`);
    newData = rawData.slice().reverse().slice(0, 50); // latest 50
  } catch (error) {
    console.error("Error fetching data:", error);
  }

  if (newData.length > 0) {
    for (const o of newData) {
      let des = o.Description || "(No description provided)";
      if (des.length > 3000) des = des.substr(0, 2980) + "... _(truncated)_";
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
            text: `*Job ID:* ${o.JobId}\n*Ordered by:* ${o.Orderedby}\n*Description:* ${des}\n*Assign To:* ${o.maintenanceStaff}\n*Order date:* ${o.orderdate}\n*Order time:* ${o.ordertime}\n*Status:* ${o.status}`,
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
                text: { type: "plain_text", text: `Reject`, emoji: true },
                style: "danger",
                action_id: "reject_task",
                value: o.JobId,
              },
            ],
          });
        } else if (o.status.match("Accepted")) {
          noteBlocks.push({
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Update Progress", emoji: true },
                style: "primary",
                action_id: "update_progress",
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
              action_id: "view_detail",
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
  // if (data) {
  //   // Store in a local DB
  //   const JobId = await generateUniqueJobId();
  //   data.JobId = JobId;
  //   db.push(`/${user.id}/data[]`, data, true);
  // }
  if (data) {
      const userId = user.id || user; // handle if user is string
      const path = `/data`;

      let jobs = [];

      try {
        jobs = await db.getData(path);
      } catch (err) {
        // No existing data
        jobs = [];
      }

      // Check if we're updating an existing job or creating a new one
      const jobIndex = jobs.findIndex((job) => job.JobId === data.JobId);

      if (jobIndex > -1) {
        console.log(`Updating JobId: ${data.JobId}`);
        jobs[jobIndex] = { ...jobs[jobIndex], ...data };
      } else {
        data.JobId = await generateUniqueJobId();        
        console.log(`Creating new job with JobId: ${data.JobId}`);

        jobs.push(data);
      }

      await db.push(path, jobs, true);
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

module.exports = { db,displayHome };
