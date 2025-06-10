const axios = require("axios");
const qs = require("qs");
const db = require("./db");
const apiUrl = "https://slack.com/api"; // Define Slack API URL
const {
  createButton,
  createDivider,
  createTextSection,
  createD4Button,
} = require("./blockBuilder");
// Slack supervisor user ID
const { maintenanceStaff, managerUsers } = require("./userConfig");
//Update the view
const updateView = async (user) => {
  let blocks = [
    createButton("📅 Daily Job", "daily_job", "open_daily_job"),
    createButton(":dart:Projects:dart:", "long_project", "long_project"),
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View Google Sheet"
          },
          "url": "https://docs.google.com/spreadsheets/d/1RNT-dSBH2nC1C369jUwyajtLaNSdHHeMEhL7OK_Yrdg/edit?usp=sharing",
        }
      ]
    }
  ]
}

  ];
  if (managerUsers.includes(user)) {
    blocks.push(
      createTextSection(
        "This is the Form for Manager and Supervisors to assign Maintenance jobs to Maintenance people."
      ),
      createD4Button("Submit an order", "order", "add_note")
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
    newData = await db.getData(`/regular`).catch(() => []);
    if (!Array.isArray(newData)) newData = [];
    newData = newData.slice().reverse().slice(0, 50); // latest 50
  } catch (error) {
    newData = [];
    console.error("Error fetching data:", error);
  }

  if (newData.length > 0) {
    for (const o of newData) {
      let des = o.Description || "(No description provided)";
      if (des.length > 3000) des = des.substr(0, 2980) + "... _(truncated)_";
      const isAssignedToUser = o.mStaff_id && o.mStaff_id.includes(user);

      const noteBlocks = [
        createTextSection(`*Machine Location:* ${o.machineLocation || "N/A"}`),
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Job ID:* ${o.jobId}\n*Ordered by:* ${
              o.Orderedby
            }\n*Description:* ${des}\n*Assign To:* ${
              o.assignedTo || "N/A"
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
            createButton("Accept", o.jobId, "accept_task"),
            createButton("Reject", o.jobId, "reject_task", "danger")
          );
        } else if (o.status && o.status.match("Accepted")) {
          noteBlocks.push(
            createButton("Update Progress", o.jobId, "update_progress")
          );
        }
      }
      // the work is done and ask Supervisor for approval
      if (!o.checkTime && user.includes(o.supervisorUserId) && o.endTime) {
        noteBlocks.push(createButton("Supervisor Approve?", o.jobId, "review_progress"))
      }
      noteBlocks.push(createD4Button("View Details", o.jobId, "view_detail"),
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

/* Display App Home */
const displayHome = async (user, data) => {
  const userId = user.id || user;
  const path = `/regular`;

  let jobs = [];
  try {
    jobs = await db.getData(path);
    if (!Array.isArray(jobs)) jobs = [];
  } catch (err) {
    jobs = [];
  }

  if (data) {
    const jobIndex = jobs.findIndex((job) => job.jobId === data.jobId);

    if (jobIndex > -1) {
      console.log(`Updating JobId: ${data.jobId}`);
      jobs[jobIndex] = { ...jobs[jobIndex], ...data };
    } else {
      console.log(`Creating new job with JobId: ${data.jobId}`);
      jobs.push(data);
    }

    await db.push(path, jobs, true);
  }

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
  }
};

module.exports = { displayHome };
