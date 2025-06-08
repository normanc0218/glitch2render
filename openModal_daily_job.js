const axios = require("axios");
const { fetchCalendar } = require("./fetchCalendar");
const { maintenanceStaff, managerUsers } = require("./userConfig");
const {
  createTextSection,
  createDivider,
  createHeader,
  createButton,
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
  const jobDate = now.toISOString().split("T")[0].replace(/-/g, "");

  try {
    // 1. Load all local daily jobs (from cache; falls back to DB on cache miss)
    const allJobs = await getCachedData("daily", "/data");
    const jobMap = new Map(allJobs.map((job) => [job.jobId, job]));

    // 2. Define all Google Calendar sources to check for new jobs
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

    // 3. Fetch and cache Google Calendar events for each staff member
    for (const { calendarId, assignedTo } of calendarAssignments) {
      const cacheKey = `calendar:${calendarId}`;
      // NOTE: type="calendar" here is only for API cache, NOT a real local DB type!
      const events = await getCachedData("calendar", cacheKey, () =>
        fetchCalendar(calendarId)
      );

      if (!events || events.length === 0) continue;
      // 4. Only add jobs not already existing in the local jobMap
      for (const ev of events) {
        // Generate jobId from date and event etag
        const jobId = `JOB-${jobDate}-${ev.etag?.slice(-7, -1)}`;
        if (!jobMap.has(jobId)) {
          jobMap.set(jobId, {
            jobId,
            assignedTo,
            mStaff_id: maintenanceStaff[assignedTo],
            location: ev.location || null,
            summary: ev.summary || null,
            description: ev.description || null,
            orderdate: extractDate(ev.start),
            ordertime: extractTime(ev.start),
            endDate: extractDate(ev.end),
            endTime: extractTime(ev.end),
            status: "Pending",
          });
          console.log(`🆕 Added new calendar job: ${jobId}`);
        } else {
          console.log(`🟡 Skip existing job: ${jobId}`);
        }
      }
    }

    const mergedJobs = Array.from(jobMap.values());
    if (mergedJobs.length > allJobs.length) {
      await pushAndInvalidate("daily", "/data", mergedJobs, true);
      console.log(
        `✅ DB updated with ${mergedJobs.length - allJobs.length} new job(s)`
      );
    }
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    const blocks = [
      createHeader("🗓️ Daily Jobs from Multiple Calendars"),
      createDivider(),
    ];
    for (const job of mergedJobs) {
      if (job.status.match("Waiting") && new Date(job.endDate) < new Date(today)) continue;
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
