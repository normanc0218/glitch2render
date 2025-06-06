const axios = require("axios");
const qs = require("qs");
const { JsonDB, Config } = require("node-json-db"); // Ensure this is your database module
const apiUrl = "https://slack.com/api"; // Define Slack API URL
const {
  createInputBlock,
  createInputBlock_select,
  createTextSection,
  createInputBlock_date,
  createInputBlock_time,
} = require('./blockBuilder');
const db = new JsonDB(new Config("regularJobsDB", true, false, "/")); // Adjust name and config as needed
 // Slack supervisor user ID
const { maintenanceStaff, managerUsers } = require('./userConfig');

//Update the view
const updateView = async (user) => {
  const blocks=[];
  blocks.push({
  type: "actions",
  elements: [
    {
      type: "button",
      text: {
        type: "plain_text",
        text: "📅 Daily Job",
        emoji: true
      },
      action_id: "open_daily_job", // You'll handle this in your listener
      value: "daily_job"
    }
  ]
},{
  type: "actions",
  elements: [
    {
      type: "button",
      text: {
        type: "plain_text",
        text: ` :dart:Projects:dart:`,
        emoji: true
      },
      action_id: "long_project", // You'll handle this in your listener
      value: "long_project"
    }
  ]
});
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
      text: `*Instruction:* Please find below the list of orders assigned to you by your supervisors. We kindly ask that you accept each task.\n If you have other engagements—just update your planned time and date as needed. Rejections should only be made under special or exceptional circumstances.`,
    },
  },{
          type: "divider",
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
            text: `*Machine Location:* ${o.machineLocation || "N/A"}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Job ID:* ${o.JobId}\n*Ordered by:* ${o.Orderedby}\n*Description:* ${des}\n*Assign To:* ${o.maintenanceStaff || "N/A"}\n*Order date:* ${o.orderdate}\n*Order time:* ${o.ordertime}\n*Status:* ${o.status}`,
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
      // the work is done and ask Supervisor for approal
      if (!o.checkTime && user.includes(o.supervisorUserId) && o.endTime) {
        noteBlocks.push({
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Supervisor Approve?",
                emoji: true,
              },
              style: "primary",
              action_id: "review_progress",
              value: o.JobId,
            }
          ]
        });
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
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
/* Display App Home */
const displayHome = async (user, data) => {
  console.log(`Displaying app home...`);
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



      const jobIndex = jobs.findIndex((job) => job.JobId === data.JobId);

      if (jobIndex > -1) {
        console.log(`Updating JobId: ${data.JobId}`);
        jobs[jobIndex] = { ...jobs[jobIndex], ...data };
      } else {
        console.log(`Creating new job with JobId: ${data.JobId}`);
        jobs.push(data);
      }

      await db.push(path, jobs, true);
    }
  const userId = user.id || user;
  const args = {
    token: process.env.SLACK_BOT_TOKEN,
    user_id: userId,
    view: await updateView(userId),
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
