const { google } = require('googleapis');
const { DateTime } = require('luxon');

const auth = new google.auth.GoogleAuth({
  keyFile: './google_calendar_key.json',
  scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
});

const TIME_ZONE = 'America/New_York'; // GMT-4 during DST

async function fetchCalendar(cId) {
  const authClient = await auth.getClient();
  const calendar = google.calendar({ version: 'v3', auth: authClient });

  const now = DateTime.now().setZone(TIME_ZONE);

  const startOfDay = now.startOf('day').toISO(); // e.g., 2025-06-09T00:00:00.000-04:00
  const endOfDay = now.endOf('day').toISO();     // e.g., 2025-06-09T23:59:59.999-04:00

  const res = await calendar.events.list({
    calendarId: cId,
    timeMin: startOfDay,
    timeMax: endOfDay,
    singleEvents: true,
    orderBy: 'startTime',
    timeZone: TIME_ZONE,
  });

  return res.data.items;
}

module.exports = { fetchCalendar };
