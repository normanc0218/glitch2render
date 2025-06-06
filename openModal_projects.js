const axios = require("axios");
const {
  createHeader,
  createTextSection,
  createDivider,
  createButton,
} = require("./blockBuilder");
const { fetchCalendar } = require("./fetchCalendar");
const { maintenanceStaff, managerUsers } = require("./userConfig");
// Extracts time from ISO or returns "(All day)" for date-only entries
const db3 = require(`./db3`);
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

  try {
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

    const jobDate = now.toISOString().split("T")[0].replace(/-/g, "");

    let blocks = [
      createHeader("Maintenance Projects"),
      createTextSection(
        "This is the long term project list, you just need to click *Finish* button when finished the job and upload the picture of your job for Chris to approve."
      ),
      createDivider(),
    ];

    for (const { calendarId, assignedTo } of calendarAssignments) {
      const events = await fetchCalendar(calendarId);
      if (!events || events.length === 0) continue;

      for (const job of events) {
        const jobId = `JOB-${jobDate}-${job.etag?.slice(-7, -1)}`;
        const existingJob = await db3
          .getData(`/jobs/${jobId}`)
          .catch(() => null);

        if (!existingJob) {
          const ordertime = extractTime(job.start);
          const endTime = extractTime(job.end);
          const orderdate = extractDate(job.start);
          const endDate = extractDate(job.end);

          await db3.push(`/jobs/${jobId}`, {
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
          });
        }
      }
    }
    const allJobs = await db3.getData("/jobs").catch(() => ({}));

    for (const jobId in allJobs) {
      const job = allJobs[jobId];
      const assignedSlackId = job.mStaff_id;

      blocks.push(
        createTextSection(
          `*Job ID:* ${job.jobId}\n*Assigned To:* ${
            job.assignedTo
          }\n*Machine Location:* ${job.location || " "}\n*Job Summary:* ${
            job.summary || "(No summary)"
          }\n*Job Description:* ${job.description || "(N/A)"}\n*Start Date:* ${
            job.orderdate
          } *Start Time:* ${job.ordertime}\n*End Date:* ${
            job.endDate
          } *End Time:* ${job.endTime}\n*Status:* ${job.status}`
        )
      );

      if (
        managerUsers.includes(userId) &&
        job.status === "Waiting for Supervisor approval"
      ) {
        blocks.push(
          createButton("Approve the Job?", job.jobId, "approve_general")
        );
      }

      if (assignedSlackId === userId && job.status === "Pending") {
        blocks.push(
          createButton("Update Job", job.jobId, "update_finish_project")
        );
      }

      blocks.push(createDivider());
    }

    const modal = {
      type: "modal",
      callback_id: "job_modal",
      title: {
        type: "plain_text",
        text: "Maitenance Project",
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
