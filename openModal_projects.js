const axios = require("axios");
const {
  createHeader,
  createTextSection,
  createDivider,
  createButton,
} = require("./blockBuilder");
const { fetchCalendar } = require("./fetchCalendar");
const { maintenanceStaff, managerUsers } = require("./userConfig");
const db = require("./db");

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
  const today = now.toISOString().split("T")[0];
  const jobDate = today.replace(/-/g, "");

  try {
    const ref = db.ref("jobs/project");
    const snapshot = await ref.once("value");
    let allJobs = snapshot.val() ? Object.values(snapshot.val()) : [];
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
      const events = await fetchCalendar(calendarId);
      if (!events || events.length === 0) continue;
      for (const job of events) {
        const jobId = `JOB-${job.etag?.slice(-7, -1)}-P`;
        console.error(jobId，job);
        const exists = allJobs.some((j) => j.jobId === jobId);
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
            orderEndTime: extractTime(job.end),
            status: "Pending",
          };
          await ref.push(newJob); // ✅ push each new job as it's created
          allJobs.push(newJob); // ✅ update local array
        }
      }
    }
    // 3. 渲染 Blocks
    const blocks = [createHeader("Maintenance Projects"), createDivider()];

    for (const job of allJobs) {
      if (  
        job.status === "👍 *Approved and Completed*"
         // 已经完成批准的，直接跳过
        // job.status !== "Pending" &&
        // job.orderEndDate &&
        // new Date(job.orderEndDate) < new Date(today)
      )
      { 
        continue;}
      blocks.push(
        createTextSection(
          `*Job ID:* ${job.jobId}\n` +
            `*Assigned To:* ${job.assignedTo}\n` +
            `*Location:* ${job.machineLocation || "(N/A)"}\n` +
            `*Summary:* ${job.summary || "(N/A)"}\n` +
            `*Order Start:* ${job.orderdate} ${job.ordertime}\n` +
            `*Order End:* ${job.orderEndDate} ${job.orderEndTime}\n` +
            (job.startDate
              ? `*Actual Start:* ${job.startDate} ${job.startTime}\n`
              : "") +
            (job.endDate
              ? `*Actual End:* ${job.endDate} ${job.endTime}\n`
              : "") +
            (job.checkDate
              ? `*Actual Start:* ${job.checkDate} ${job.checkTime}\n`
              : "") +
            (job.remarks
              ? `*Remarks from Maintenance:* ${job.remarks}\n`
              : "") +
            (job.supervisorUser
              ? `*Supervisor in charge:* ${job.supervisorUser}\n`
              : "") +
            (job.supervisorMessage
              ? `*Message to supervisor:* ${job.supervisorMessage}\n`
              : "") +
            (job.supervisorcomment
              ? `*Supervisor Comments:* ${job.supervisorcomment}\n`
              : "") +
            (job.toolsChecked ? `*Tools check?:* ${job.toolsChecked}\n` : "") +
            (job.extrahelp ? `*Cleaning help:* ${job.extrahelp}\n` : "") +
            `*Status:* ${job.status}`
        )
      );
      if (
        job.supervisorUserID === userId &&
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

    // 4. 打开 Modal
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
