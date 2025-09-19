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
    createButton(":dart:Projects:dart:", "long_project", "long_project")];
  if (managerUsers.includes(user)) {
    blocks.push({
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View History"
          },
          "url": "https://docs.google.com/spreadsheets/d/1RNT-dSBH2nC1C369jUwyajtLaNSdHHeMEhL7OK_Yrdg/edit?usp=sharing",
        }
      ]
    },
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
    const snapshot = await db.ref("/jobs/regular").once("value");
    const jobsObj = snapshot.val() || {};

    // Convert object to array, sort by timestamp descending if available
    newData = Object.values(jobsObj)
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 50);
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
  console.log("now you are in DisplayHome")
  const userId = user.id || user;
  const path = `jobs/regular`;

  const ref = db.ref(path);

  if (data) {
    const snapshot = await ref.once('value');
    const jobs = snapshot.val() || {};

    let existingKey = null;

    for (const [key, job] of Object.entries(jobs)) {
      if (job.jobId === data.jobId) {
        existingKey = key;
        break;
      }
    }

    if (existingKey) {
      console.log(`Updating JobId: ${data.jobId}`);
      await ref.child(existingKey).update(data);
    } else {
      console.log(`Creating new job with JobId: ${data.jobId}`);
      await ref.push(data);
    }
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
