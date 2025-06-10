const axios = require("axios");
const { fetchCalendar } = require("./fetchCalendar");
const { maintenanceStaff, managerUsers } = require("./userConfig");
const db = require(`./db`);
const {
  createTextSection,
  createDivider,
  createButton,
} = require("./blockBuilder");

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

    const ref = db.ref("jobs/daily");
    const snapshot = await ref.once("value");
    let allJobs = snapshot.val() ? Object.values(snapshot.val()) : [];

    for (const { calendarId, assignedTo } of calendarAssignments) {
      const events = await fetchCalendar(calendarId);
      if (!events || events.length === 0) continue;

      for (const job of events) {
        const jobId = `JOB-${jobDate}-${job.etag?.slice(-7, -1)}-D`;
        const exists = allJobs.some(j => j.jobId === jobId);
        if (!exists) {
          const newJob = {
            jobId,
            assignedTo,
            mStaff_id: maintenanceStaff[assignedTo],
            machineLocation: job.location || null,
            summary: job.summary || null,
            description: job.description || null,
            orderdate: extractDate(job.start),
            ordertime: extractTime(job.start),
            orderEndDate: extractDate(job.end),
            OrderEndTime: extractTime(job.end),
            status: "Pending",
          };
          await ref.push(newJob); // ✅ push individually
          allJobs.push(newJob);   // ✅ keep local list updated for display
        }
      }
    let blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🗓️ Daily Jobs from Multiple Calendars",
          emoji: true,
        },
      },
      { type: "divider" },
    ];

    for (const job of allJobs) {
      blocks.push(
        createTextSection(
          `*Job ID:* ${job.jobId}\n` +
            `*Assigned To:* ${job.assignedTo}\n` +
            `*Location:* ${job.machineLocation || "(N/A)"}\n` +
            `*Summary:* ${job.summary || "(N/A)"}\n` +
            `*Order Start:* ${job.orderdate} ${job.ordertime}\n` +
            `*Order End:* ${job.orderEndDate} ${job.OrderEndTime}\n` +            
            (job.startDate?`*Actual Start:* ${job.startDate} ${job.startTime}\n`:"") +
            (job.endDate?`*Actual End:* ${job.endDate} ${job.endTime}\n`:"")+
            (job.checkDate?`*Actual Start:* ${job.checkDate} ${job.checkTime}\n`:"") +
            (job.remarks?`*Remarks from Maintenance:* ${job.remarks}\n`:"")+
            (job.supervisorUser?`*Supervisor in charge:* ${job.supervisorUser}\n`:"")+
            (job.supervisorMessage?`*Message to supervisor:* ${job.supervisorMessage}\n`:"")+
            (job.supervisorcomment?`*Supervisor Comments:* ${job.supervisorcomment}\n`:"")+
            (job.toolsChecked?`*Tools check?:* ${job.toolsChecked}\n`:"") +
            (job.extrahelp?`*Cleaning help:* ${job.extrahelp}\n`:"") +
            `*Status:* ${job.status}`
        )
      );

      if (
        job.supervisorUserID === userId &&
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
  }} catch (error) {
    console.error(
      "Error fetching calendars or opening modal:",
      error.response?.data || error.message
    );
  }
}

module.exports = { openModal_daily_job };
