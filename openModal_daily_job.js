const axios = require("axios");
const { fetchCalendar } = require("./fetchCalendar");
const { maintenanceStaff, managerUsers } = require("./userConfig");
const {
  createTextSection,
  createDivider,
  createHeader,
  createButton
} = require("./blockBuilder");

const { getCachedData, pushAndInvalidate } = require("./cache/utils");

function extractTime(eventTime) {
  if (!eventTime) return "N/A";
  if (eventTime.dateTime) return eventTime.dateTime.split("T")[1].slice(0, 5);
  return "N/A";
}
function extractDate(eventTime) {
  if (!eventTime) return "N/A";
  if (eventTime.dateTime) return eventTime.dateTime.split("T")[0];
}

async function openModal_daily_job(trigger_id, userId) {
  const now = new Date();

  try {
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

    const jobDate = now.toISOString().split("T")[0].replace(/-/g, "");

    let blocks = [
      createHeader("🗓️ Daily Jobs from Multiple Calendars"),
      createDivider(),
    ];

    // [CHANGED] Load existing jobs from /data instead of individual /jobs/jobId paths
    const allJobs = await getCachedData("daily", "/data", () =>
      Promise.resolve([]) // fallback default if no data
    );

    // [CHANGED] Use mutable array to track updates
    const updatedJobs = [...allJobs];

    // 🔁 Fetch and cache calendar events
    for (const { calendarId, assignedTo } of calendarAssignments) {
      const cacheKey = `calendar:${calendarId}`;
      const events = await getCachedData("calendar", cacheKey, () =>
        fetchCalendar(calendarId)
      );

      if (!events || events.length === 0) continue;

      for (const job of events) {
        const jobId = `JOB-${jobDate}-${job.etag?.slice(-7, -1)}`;

        const jobExists = updatedJobs.find(j => j.jobId === jobId); // [CHANGED] Check from flat array

        if (!jobExists) {
          const ordertime = extractTime(job.start);
          const endTime = extractTime(job.end);
          const orderdate = extractDate(job.start);
          const endDate = extractDate(job.end);

          const newJob = {
            jobId,
            assignedTo,
            mStaff_id: maintenanceStaff[assignedTo],
            location: job.location || null,
            summary: job.summary || null,
            description: job.description || null,
            orderdate: orderdate,
            ordertime: ordertime,
            endDate: endDate,
            endTime: endTime,
            status: "Pending",
          };

          updatedJobs.push(newJob); //[CHANGED] Push to local array
        }
      }
    }

    await pushAndInvalidate("daily", "/data", updatedJobs, true);

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });

    for (const job of updatedJobs) {
      if (job.endDate && new Date(job.endDate) < new Date(today)) continue;

      const assignedSlackId = job.mStaff_id;

      blocks.push(
        createTextSection(
          `*Job ID:* ${job.jobId}\n*Assigned To:* ${job.assignedTo}\n*Machine Location:* ${job.location || " "}\n*Job Summary:* ${job.summary || "(No summary)"}\n*Job Description:* ${job.description || "(N/A)"}\n*Start Date:* ${job.orderdate} *Start Time:* ${job.ordertime}\n*End Date:* ${job.endDate} *End Time:* ${job.endTime}\n*Status:* ${job.status}`
        )
      );

      if (managerUsers.includes(userId) && job.status === "Waiting for Supervisor approval") {
        blocks.push(createButton("Approve the Job?", job.jobId, "approve_daily"));
      }

      if (assignedSlackId === userId && job.status === "Pending") {
        blocks.push(createButton("Update Job", job.jobId, "update_daily"));
      }

      blocks.push({ type: "divider" });
    }

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

    await axios.post(
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
  } catch (error) {
    console.error(
      "Error fetching calendars or opening modal:",
      error.response?.data || error.message
    );
  }
}

module.exports = { openModal_daily_job };
