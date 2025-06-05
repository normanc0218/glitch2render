const axios = require('axios');
const { fetchCalendar } = require('./fetchCalendar');

// Extracts time from ISO or returns "(All day)" for date-only entries
function extractTime(eventTime) {
  if (!eventTime) return "N/A";
  if (eventTime.dateTime) return eventTime.dateTime.split("T")[1].slice(0, 5);
  if (eventTime.date) return "(All day)";
  return "N/A";
}

async function openModal_projects(trigger_id) {
  const now = new Date();

  try {
    const calendarAssignments = [
      {
        calendarId: 'a64b20da82c7d63ea57fc681543f7a1e7503c291b8ff97b001705f7e19497e50@group.calendar.google.com',
        assignedTo: 'Fai'
      },
      {
        calendarId: '359a1cd46746ffea41ebc4c0fdb45b611450509d5d4253d80042766eb816e3ba@group.calendar.google.com',
        assignedTo: 'Sam'
      },
      {
        calendarId: '9e933bf19337956260c8ab0f8d07b448879cc87c9826656ffb79c89f4c95d7ee@group.calendar.google.com',
        assignedTo: 'Steven'
      }
    ];

    const jobDate = now.toISOString().split('T')[0].replace(/-/g, '');

    let blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Maintenance Projects",
          emoji: true
        }
      },
      { type: "divider" }
    ];

    for (const { calendarId, assignedTo } of calendarAssignments) {
      const events = await fetchCalendar(calendarId);
      console.log(`Fetched ${events.length} events for ${assignedTo}`);
      console.log(events)
      if (!events || events.length === 0) continue;

      for (const job of events) {
        const jobId = `JOB-${jobDate}-${job.etag?.slice(-7, -1)}`;
        const startTime = extractTime(job.start);
        const endTime = extractTime(job.end);

        blocks.push(
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Job ID:* ${jobId}\n*Assigned To:* ${assignedTo}\n*Job Summary:* ${job.summary || "(No summary)"}\n*Job Description:* ${job.description || "(N/A)"}\n*Start:* ${startTime}\n*End:* ${endTime}`
            }
          },
          { type: "divider" }
        );
      }
    }

    const modal = {
      type: "modal",
      callback_id: "job_modal",
      title: {
        type: "plain_text",
        text: "Maitenance Project",
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

module.exports = { openModal_projects };
