const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: './google_calendar_key.json', // Use your actual JSON key path
  scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
});

const calendar = google.calendar({ version: 'v3', auth });

async function fetchCalendar(cId) {
  const now = new Date();

  // Beginning of today (00:00:00)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // End of today (23:59:59.999)
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const res = await calendar.events.list({
    calendarId: cId,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return res.data.items;
}

module.exports = { fetchCalendar };
