const axios = require('axios');
const { fetchCalendar } = require('./fetchCalendar');

function extractTimeFromISO(isoString) {
  return isoString ? isoString.split('T')[1]?.slice(0, 5) || "N/A" : "N/A";
}

async function openModal_daily_job(trigger_id) {
  const now = new Date();
  
  try {
    // Fetching the calendars
    const faiDaily = await fetchCalendar('3c900c9ad4cfa608582d351a1cffae1c54c08ad48cab7be68eb3921305a88352@group.calendar.google.com');
    const samDaily = await fetchCalendar('8f1e07292ce07989c47cbacd57096717820a1eeeeb2426be8b58232fd7d01bc8@group.calendar.google.com');
    const stevenDaily = await fetchCalendar('0d9e2d5f6cd5d2523b7df5b9f147d8738681fb7d7c3a7832747c41682bc24c20@group.calendar.google.com');
    
    // Combine all events
    const events = [...faiDaily, ...samDaily, ...stevenDaily];
    const jobDate = now.toISOString().split('T')[0].replace(/-/g, '');

    if (!events || events.length === 0) {
      console.log("No events found.");
      return;
    }

    // Prepare blocks for the Slack modal
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🗓️ Daily Jobs from Google Calendar",
          emoji: true
        }
      },
      { type: "divider" }
    ];

    // Loop through each event to build the blocks for Slack modal
    for (const job of events) {
      const jobId = `JOB-${jobDate}-${job.etag.slice(1, 7)}`;
      const startTime = job.start.dateTime ? extractTimeFromISO(job.start.dateTime) : "N/A";
      const endTime = job.end.dateTime ? extractTimeFromISO(job.end.dateTime) : "N/A";

      blocks.push(
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Job ID:* ${jobId}\n*Assigned To:* Fai\n*Summary:* ${job.summary || "(No summary)"}\n*Start:* ${startTime}\n*End:* ${endTime}`
          }
        },
        { type: "divider" }
      );
    }

    // Define the modal structure
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

    // Send the modal to Slack
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
    console.error("Error fetching calendars or opening modal:", error.message);
  }
}

module.exports = { openModal_daily_job };
