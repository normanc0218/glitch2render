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
const fallbackFn = async () => {
  return [];
};

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
    console.log(allJobs)
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

    for (const { calendarId, assignedTo } of calendarAssignments) {
      const cacheKey = `calendar:${calendarId}`;
      const jobPrefix = `JOB-${jobDate}-`;

      // Always fetch fresh data from Google Calendar
      const freshEvents = await fetchCalendar(calendarId);

      if (!freshEvents || freshEvents.length === 0) continue;

      // Get cached version of events
      const cachedEvents = await getCachedData("daily", cacheKey, () => []);

      // Create a Map of cached jobIds to quickly check existing cache state
      const cachedJobMap = new Map(
        cachedEvents.map((ev) => [
          `JOB-${jobDate}-${ev.etag?.slice(-7, -1)}`,
          ev.etag,
        ])
      );

//       let updatedEventsForCache = [...cachedEvents]; // Will update if any changes

//       for (const ev of freshEvents) {
//         const etagSuffix = ev.etag?.slice(-10, -1);
//         const jobId = `JOB-${jobDate}-${etagSuffix}`;

//         // Check if job exists in jobMap and cache with the same etag
//         const alreadyInDB = jobMap.has(jobId);
//         const sameInCache = cachedJobMap.get(jobId) === ev.etag;

//         if (alreadyInDB && sameInCache) {
//           console.log(`⏭️ Skipping unchanged job: ${jobId}`);
//           continue;
//         }

//         const job = {
//           jobId,
//           assignedTo,
//           mStaff_id: maintenanceStaff[assignedTo],
//           location: ev.location || null,
//           summary: ev.summary || null,
//           description: ev.description || null,
//           orderdate: extractDate(ev.start),
//           ordertime: extractTime(ev.start),
//           endDate: extractDate(ev.end),
//           endTime: extractTime(ev.end),
//           status: "Pending",
//         };

//         if (!alreadyInDB) {
//           console.log(`🆕 Adding job to jobMap: ${jobId}`);
//           jobMap.set(jobId, job);
//         }

//         if (!sameInCache) {
//           console.log(`🔄 Updating cached event: ${jobId}`);
//           // Replace or add to cached events
//           updatedEventsForCache = updatedEventsForCache.filter(
//             (e) => `JOB-${jobDate}-${e.etag?.slice(-10, -1)}` !== jobId
//           );
//           updatedEventsForCache.push(ev);
//         }
//       }

//       // Update the cache if it changed
//       await pushAndInvalidate(
//         "daily",
//         cacheKey,
//         updatedEventsForCache,
//         true
//       );
    }      
    const mergedJobs = Array.from(jobMap.values());

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    const blocks = [
      createHeader("🗓️ Daily Jobs from Multiple Calendars"),
      createDivider(),
    ];
    for (const job of mergedJobs) {
      if (
        job.status.match("Pending") &&
        new Date(job.endDate) < new Date(today)
      )
        continue;
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
