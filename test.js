const { google } = require('googleapis');
const { auth } = require('google-auth-library');
const keys = require('./google_calendar_key.json'); // Your service account key

async function fetchEvents() {
  try {
    const authClient = await auth.fromJSON(keys);
    authClient.scopes = ['https://www.googleapis.com/auth/calendar.readonly'];

    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const res = await calendar.events.list({
      calendarId: 'rizopiamaintenance@gmail.com', // calendar owner's email
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = res.data.items;
    if (events.length) {
      events.forEach(e =>
        console.log(`${e.start.dateTime || e.start.date}: ${e.summary}`)
      );
    } else {
      console.log('No upcoming events.');
    }
  } catch (err) {
    console.error('Failed to fetch events:', err.message);
  }
}
