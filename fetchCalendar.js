const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: 'path/to/service-account.json', // Use your actual JSON key path
  scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
});

const calendar = google.calendar({ version: 'v3', auth });

async function fetchCalendar(cId) {
  try {
    const res = await calendar.events.list({
      calendarId: cId,
      timeMin: new Date().toISOString(), // Fetch upcoming events
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return res.data.items || [];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
}

module.exports = { fetchCalendar };
