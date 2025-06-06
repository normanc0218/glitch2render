const axios = require("axios");
const qs = require("qs");
const { JsonDB, Config } = require("node-json-db"); // Ensure this is your database module
const apiUrl = "https://slack.com/api"; // Define Slack API URL
const {
  createButton,
  createDivider,
  createTextSection,
} = require("./blockBuilder");
const db = new JsonDB(new Config("regularJobsDB", true, false, "/")); // Adjust name and config as needed
// Slack supervisor user ID
const { maintenanceStaff, managerUsers } = require("./userConfig");
//Update the view
const updateView = async (user) => {
  let blocks = [
    createButton("📅 Daily Job", "daily_job", "open_daily_job"),
    createButton(":dart:Projects:dart:", "long_project", "long_project"),
  ];
  if (managerUsers.includes(user)) {
    blocks.push(
      createTextSection(
        "This is the Form for Manager and Supervisors to assign Maintenance jobs to Maintenance people."
      ),
      createButton("Submit an order", "order", "add_note")
    );
  } else {
    blocks.push(
      createTextSection(
        `*Instruction:* Please find below the list of orders assigned to you by your supervisors. We kindly ask that you accept each task.\n If you have other engagements—just update your planned time and date as needed. Rejections should only be made under special or exceptional circumstances.`
      ),
      createDivider()
    );
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
        createTextSection(`*Machine Location:* ${o.machineLocation || "N/A"}`),
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Job ID:* ${o.JobId}\n*Ordered by:* ${
              o.Orderedby
            }\n*Description:* ${des}\n*Assign To:* ${
              o.maintenanceStaff || "N/A"
            }\n*Order date:* ${o.orderdate}\n*Order time:* ${
              o.ordertime
            }\n*Status:* ${o.status}`,
          },
          accessory: {
            type: "image",
            image_url: (o.picture && o.picture[0]) || "https://via.placeholder.com/100",
            alt_text: "picture",
          },
        },
      ];

      if (isAssignedToUser) {
        if (o.status === "Pending") {
          noteBlocks.push(
            createButton("Accept", o.JobId, "accept_task"),
            createButton("Reject", o.JobId, "reject_task", "danger")
          );
        } else if (o.status.match("Accepted")) {
          noteBlocks.push(
            createButton("Update Progress", o.JobId, "update_progress")
          );
        }
      }
      // the work is done and ask Supervisor for approal
      if (!o.checkTime && user.includes(o.supervisorUserId) && o.endTime) {
        noteBlocks.push(createButton("Supervisor Approve?", o.JobId, "review_progress"))
      }
      noteBlocks.push(createButton("View Details", o.JobId, "view_detail"),
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `🕒 ${o.timestamp || "No timestamp"}`,
            },
          ],
        },
        createDivider()
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
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
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
  try {
    const result = await axios.post(`${apiUrl}/views.publish`, qs.stringify(args));
    if (result.data.error) {
      console.error("Slack API error:", result.data.error);
    }
  } catch (err) {
    console.error("Failed to publish Slack view:", err.message);
  }}

module.exports = { db, displayHome };
