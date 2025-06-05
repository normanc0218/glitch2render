const axios = require('axios');
const { fetchCalendar } = require('./fetchCalendar');
const { maintenanceStaff, managerUsers } = require('./userConfig');
const db2 = require(`./db2`)
// Extracts time from ISO or returns "(All day)" for date-only entries
function extractTime(eventTime) {
  if (!eventTime) return "N/A";
  if (eventTime.dateTime) return eventTime.dateTime.split("T")[1].slice(0, 5);
  return "N/A";
}
function extractDate(eventTime) {
  if (!eventTime) return "N/A";
  if (eventTime.dateTime) return eventTime.dateTime.split("T")[0].slice(0, 11);
}

async function openModal_daily_job(trigger_id,userId) {
  const now = new Date();

  try {
    const calendarAssignments = [
      {
        calendarId: '3c900c9ad4cfa608582d351a1cffae1c54c08ad48cab7be68eb3921305a88352@group.calendar.google.com',
        assignedTo: 'Fai'
      },
      {
        calendarId: '8f1e07292ce07989c47cbacd57096717820a1eeeeb2426be8b58232fd7d01bc8@group.calendar.google.com',
        assignedTo: 'Sam'
      },
      {
        calendarId: '0d9e2d5f6cd5d2523b7df5b9f147d8738681fb7d7c3a7832747c41682bc24c20@group.calendar.google.com',
        assignedTo: 'Steven'
      }
    ];

    const jobDate = now.toISOString().split('T')[0].replace(/-/g, '');

    let blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🗓️ Daily Jobs from Multiple Calendars",
          emoji: true
        }
      },
      { type: "divider" }
    ];
    for (const { calendarId, assignedTo } of calendarAssignments) {
      const events = await fetchCalendar(calendarId);
      if (!events || events.length === 0) continue;

      for (const job of events) {
        const jobId = `JOB-${jobDate}-${job.etag?.slice(-7, -1)}`;
        const existingJob = await db2.getData(`/jobs/${jobId}`).catch(() => null);

        if (!existingJob) {
          const ordertime = extractTime(job.start);
          const endTime = extractTime(job.end);
          const orderdate = extractDate(job.start);
          const endDate = extractDate(job.end);

          await db2.push(`/jobs/${jobId}`, {
            jobId,
            assignedTo,
            slackUserId: maintenanceStaff[assignedTo],
            location: job.location || null,
            summary: job.summary || null,
            description: job.description || null,
            orderdate,
            ordertime,
            endDate,
            endTime,
            status: "Pending"
          });
        }
      }
    }

    for (const { calendarId, assignedTo } of calendarAssignments) {
      const events = await fetchCalendar(calendarId);

      console.log(`Fetched ${events.length} events for ${assignedTo}`);

      if (!events || events.length === 0) continue;

      for (const job of events) {
        const jobId = `JOB-${jobDate}-${job.etag?.slice(-7, -1)}`;
        const ordertime = extractTime(job.start);
        const endTime = extractTime(job.end);
        const orderdate = extractDate(job.start);
        const endDate = extractDate(job.end);

//I wan to make the modal read the db entries here
        const existingJob = await db2.getData(`/jobs/${jobId}`).catch(() => null);
        if (!existingJob) {
          await db2.push(`/jobs/${jobId}`, {
            jobId,
            assignedTo,
            slackUserId: maintenanceStaff[assignedTo],
            location: job.location || null,
            summary: job.summary || null,
            description: job.description || null,
            orderdate: orderdate,
            ordertime: ordertime,
            endDate: endDate,
            endTime: endTime,
            status: "Pending"
          });
        
        blocks.push(
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Job ID:* ${jobId}\n*Assigned To:* ${assignedTo}\n*Machine Location:* ${job.location || " "}\n*Job Summary:* ${job.summary || "(No summary)"}
              \n*Job Description:* ${job.description || "(N/A)"}\n*Start Date:* ${orderdate} *Start Time:* ${ordertime}\n*End Date:* ${endDate} *End Time:* ${endTime}`
            }
          }
        );
        // Conditionally add Update Job button for the assigned person
        const assignedSlackId = maintenanceStaff[assignedTo]; // make sure this is imported

        if (assignedSlackId === userId) { // <-- Pass this from trigger context
          blocks.push({
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Update Job"
                },
                value: jobId,
                style: "primary",
                action_id: "update_general"
              }
            ]
          });
        }
        blocks.push(
          { type: "divider" })};}

    const modal = {
      type: "modal",
      callback_id: "daily_job_modal",
      title: {
        type: "plain_text",
        text: "Daily Job",
        emoji: true
      },
      close: {
        type: "plain_text",
        text: "Close",
        emoji: true
      },
      blocks
    };

    await axios.post(
      'https://slack.com/api/views.open',
      {
        trigger_id,
        view: modal
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
        }
      }
    );
  } catch (error) {
    console.error("Error fetching calendars or opening modal:", error.response?.data || error.message);
  }
}

module.exports = { openModal_daily_job };
