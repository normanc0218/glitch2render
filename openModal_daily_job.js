const axios = require("axios");
const { getCachedData, pushAndInvalidate } = require("./cache/utils");
const { managerUsers } = require("./userConfig");
const {
  createTextSection,
  createDivider,
  createButton,
} = require("./blockBuilder");
const { fetchCalendar } = require("./fetchCalendar");
const { maintenanceStaff } = require("./userConfig");

async function openModal_daily_job(trigger_id, userId) {
  const now = new Date();
  const jobDate = now.toISOString().split("T")[0].replace(/-/g, "");

  try {
    // 1. Read job list from cache or DB
    let jobList = await getCachedData("daily", "/data");
    const jobMap = new Map(jobList.map((job) => [job.jobId, job]));
    const calendarAssignments = [
      {
        calendarId:
          "3c900c9ad4cfa608582d351a1cffae1c54c08ad48cab7be68eb3921305a88352@group.calendar.google.com",
        assignedTo: "Fai",
      },
      {
        calendarId:
          "8f1e07292ce07989c47cbacd57096717820a1eeeeb2426be8b58232fd7d01bc8@group.calendar.google.com",
        assignedTo: "Sam",
      },
      {
        calendarId:
          "0d9e2d5f6cd5d2523b7df5b9f147d8738681fb7d7c3a7832747c41682bc24c20@group.calendar.google.com",
        assignedTo: "Steven",
      },
    ];
    let newJobAdded = false;

    for (const { calendarId, assignedTo } of calendarAssignments) {
      const cacheKey = `calendar:${calendarId}`;
      // Fetch from cache, or if cache miss, from Google Calendar API
      const events = await getCachedData("calendar", cacheKey, () =>
        fetchCalendar(calendarId)
      );
      if (!events || events.length === 0) continue;

      for (const ev of events) {
        const jobId = `JOB-${jobDate}-${ev.etag?.slice(-7, -1)}`;
        if (!jobMap.has(jobId)) {
          // New job found, add to map
          const newJob = {
            jobId,
            assignedTo,
            mStaff_id: maintenanceStaff[assignedTo],
            location: ev.location || null,
            summary: ev.summary || null,
            description: ev.description || null,
            orderdate: ev.start?.dateTime?.split("T")[0],
            ordertime: ev.start?.dateTime?.split("T")[1]?.slice(0, 5),
            endDate: ev.end?.dateTime?.split("T")[0],
            endTime: ev.end?.dateTime?.split("T")[1]?.slice(0, 5),
            status: "Pending",
          };
          jobMap.set(jobId, newJob);
          newJobAdded = true;
        }
      }
    }

    // 3. Only update DB/cache if there's a new job added
    if (newJobAdded) {
      const mergedJobs = Array.from(jobMap.values());
      await pushAndInvalidate("daily", "/data", mergedJobs, true);
    }
    
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

    mergedJobs.forEach((job) => {
      // Skip jobs with end date in the past
      if (new Date(job.endDate) < new Date(today)) {
        return;
      }

      // Add job details to modal blocks
      blocks.push(
        createTextSection(
          `*Job ID:* ${job.jobId}\n` +
            `*Assigned To:* ${job.assignedTo}\n` +
            `*Location:* ${job.location || "(N/A)"}\n` +
            `*Summary:* ${job.summary || "(N/A)"}\n` +
            `*Start:* ${job.orderdate} ${job.ordertime}\n` +
            `*End:* ${job.endDate} ${job.endTime}\n` +
            `*Status:* ${job.status}`
        )
      );

      // Conditional buttons for managers and staff
      if (
        managerUsers.includes(userId) &&
        job.status === "Waiting for Supervisor approval"
      ) {
        blocks.push(
          createButton("Approve the Job?", job.jobId, "approve_daily")
        );
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
