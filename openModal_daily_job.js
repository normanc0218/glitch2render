const axios = require('axios');
const { fetchCalendar } = require('./fetchCalendar');

// Extracts time from ISO or returns "(All day)" for date-only entries
function extractTime(eventTime) {
  if (!eventTime) return "N/A";
  if (eventTime.dateTime) return eventTime.dateTime.split("T")[1].slice(0, 5);
  if (eventTime.date) return "(All day)";
  return "N/A";
}

async function openModal_daily_job(trigger_id) {
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
      console.log(`Fetched ${events.length} events for ${assignedTo}`);

      if (!events || events.length === 0) continue;

      for (const job of events) {
        const jobId = `JOB-${jobDate}-${job.etag?.slice(-5, -1) || Math.random().toString(36).substring(2, 6)}`;
        const startTime = extractTime(job.start);
        const endTime = extractTime(job.end);

        blocks.push(
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Job ID:* ${jobId}\n*Assigned To:* ${assignedTo}\n*Summary:* ${job.summary || "(No summary)"}\n*Start:* ${startTime}\n*End:* ${endTime}`
            }
          },
          { type: "divider" }
        );
      }
    }

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
