const axios = require('axios');
const { fetchCalendar } = require('./fetchCalendar');

function extractTimeFromISO(isoString) {
  return isoString.split('T')[1].slice(0, 5);
}

async function openModal_daily_job(trigger_id) {
  const now = new Date();
  const events = await fetchCalendar('3c900c9ad4cfa608582d351a1cffae1c54c08ad48cab7be68eb3921305a88352@group.calendar.google.com');

  const jobDate = now.toISOString().split('T')[0].replace(/-/g, '');

  if (!events || events.length === 0) {
    console.log("No events found.");
    return;
  }

  const job = events[0]; // Take the first event for testing

  const jobs = {
    JobId: `JOB-${jobDate}-${job.etag.slice(1, 7)}`,
    Assigned_to: "Fai",
    Description: job.summary || "(No summary)",
    Start: extractTimeFromISO(job.start.dateTime),
    End: extractTimeFromISO(job.end.dateTime)
  };

  const modalView = {
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
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Job ID:* ${jobs.JobId}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Assigned to:* ${jobs.Assigned_to}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Description:* ${jobs.Description}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Start Time:* ${jobs.Start}\n*End Time:* ${jobs.End}`
        }
      }
    ]
  };

  try {
    const response = await axios.post(
      'https://slack.com/api/views.open',
      {
        trigger_id: trigger_id,
        view: modalView
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
        }
      }
    );

    if (!response.data.ok) {
      console.error("Slack API error:", response.data);
    }
  } catch (err) {
    console.error("Modal open error:", err.response?.data || err.message);
  }
}

module.exports = { openModal_daily_job };
