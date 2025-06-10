const axios = require("axios");
const {
  createHeader,
  createTextSection,
  createDivider,
  createButton,
} = require("./blockBuilder");
const { fetchCalendar } = require("./fetchCalendar");
const { maintenanceStaff, managerUsers } = require("./userConfig");
const db = require("./project")
function extractTime(eventTime) {
  if (!eventTime) return "N/A";
  if (eventTime.dateTime) return eventTime.dateTime.split("T")[1].slice(0, 5);
  return "N/A";
}

function extractDate(eventTime) {
  if (!eventTime) return "N/A";
  if (eventTime.dateTime) return eventTime.dateTime.split("T")[0];
}

async function openModal_projects(trigger_id, userId) {
  const now = new Date();
  const jobDate = now.toISOString().split("T")[0].replace(/-/g, "");
  try {
    const allJobs = await db.getData("project").catch([]);
    const jobMap = new Map(allJobs.map((job) => [job.jobId, job]));
    const calendarAssignments = [
      {
        calendarId:
          "a64b20da82c7d63ea57fc681543f7a1e7503c291b8ff97b001705f7e19497e50@group.calendar.google.com",
        assignedTo: "Fai",
      },
      {
        calendarId:
          "359a1cd46746ffea41ebc4c0fdb45b611450509d5d4253d80042766eb816e3ba@group.calendar.google.com",
        assignedTo: "Sam",
      },
      {
        calendarId:
          "9e933bf19337956260c8ab0f8d07b448879cc87c9826656ffb79c89f4c95d7ee@group.calendar.google.com",
        assignedTo: "Steven",
      },
    ];

    for (const { calendarId, assignedTo } of calendarAssignments) {
      const cacheKey = `calendar:${calendarId}`;
      const events = await getCachedData("calendar", cacheKey, () =>
        fetchCalendar(calendarId)
      );

      if (!events || events.length === 0) continue;

      for (const ev of events) {
        const jobId = `JOB-${ev.etag?.slice(-10, -1)}`;

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
      await pushAndInvalidate("project", "/data", mergedJobs, true);
      console.log(
        `✅ DB updated with ${mergedJobs.length - allJobs.length} new job(s)`
      );
    }
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/New_York",
    });
    const blocks = [createHeader("Maitenance Projects"), createDivider()];

    for (const job of mergedJobs) {
      if (job.status.match("Pending") && new Date(job.endDate) < new Date(today)) continue;
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
          createButton("Approve the Job?", job.jobId, "approve_project")
        );
      }
      if (job.mStaff_id === userId && job.status === "Pending") {
        blocks.push(createButton("Update Job", job.jobId, "update_project"));
      }
      blocks.push(createDivider());
    }

    const modal = {
      type: "modal",
      callback_id: "job_modal",
      title: {
        type: "plain_text",
        text: "Maintenance Project",
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

module.exports = { openModal_projects };
