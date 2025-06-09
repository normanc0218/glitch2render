const axios = require("axios");
const { getCachedData } = require("./cache/utils"); // Assume this is the correct method for getting data from the cache or DB
const { managerUsers } = require("./userConfig");
const { createTextSection, createDivider, createButton } = require("./blockBuilder");

async function openModal_daily_job(trigger_id, userId) {
  const now = new Date();
  const jobDate = now.toISOString().split("T")[0].replace(/-/g, "");  // Format as YYYYMMDD

  try {
    // 1. Read daily jobs from the cache, and fallback to empty array if not found
    const allJobs = await getCachedData("daily", "/data", async () => []);
    console.log("its from openModal_daily_job")
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });

    const blocks = [
      {
        type: "section",
        block_id: "header",
        text: {
          type: "mrkdwn",
          text: "*🗓️ Daily Jobs from Multiple Calendars*",
        },
      },
      {
        type: "divider",
      },
    ];

    allJobs.forEach((job) => {
      // Skip jobs with end date in the past
      if (new Date(job.endDate) < new Date(today)) {
        return;
      }

      // Add job details to modal blocks
      blocks.push(createTextSection(
        `*Job ID:* ${job.jobId}\n` +
        `*Assigned To:* ${job.assignedTo}\n` +
        `*Location:* ${job.location || "(N/A)"}\n` +
        `*Summary:* ${job.summary || "(N/A)"}\n` +
        `*Start:* ${job.orderdate} ${job.ordertime}\n` +
        `*End:* ${job.endDate} ${job.endTime}\n` +
        `*Status:* ${job.status}`
      ));

      // Conditional buttons for managers and staff
      if (managerUsers.includes(userId) && job.status === "Waiting for Supervisor approval") {
        blocks.push(createButton("Approve the Job?", job.jobId, "approve_daily"));
      }

      if (job.mStaff_id === userId && job.status === "Pending") {
        blocks.push(createButton("Update Job", job.jobId, "update_daily"));
      }

      blocks.push(createDivider());
    });

    // Prepare the modal for Slack API
    const modal = {
      type: "modal",
      callback_id: "daily_job_modal",
      title: {
        type: "plain_text",
        text: "Daily Job",
        emoji: true,
      },
      close: {
        type: "plain_text",
        text: "Close",
        emoji: true,
      },
      blocks,
    };

    // Open the modal via Slack API
    const result = await axios.post(
      "https://slack.com/api/views.open",
      {
        trigger_id,
        view: modal,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
      }
    );

    if (result.data.ok) {
      console.log("Modal opened successfully!");
    } else {
      console.error("Error opening modal:", result.data.error);
    }

  } catch (error) {
    console.error("Error fetching jobs or opening modal:", error.message);
  }
}

module.exports = { openModal_daily_job };
