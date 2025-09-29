const { google } = require('googleapis');
const { DateTime } = require('luxon');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  projectId: process.env.GOOGLE_PROJECT_ID,
  scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
});

const TIME_ZONE = 'America/New_York'; // GMT-4 during DST

async function fetchCalendar(cId) {
  const authClient = await auth.getClient();
  const calendar = google.calendar({ version: 'v3', auth: authClient });

  const now = DateTime.now().setZone(TIME_ZONE);

  const startOfDay = now.minus({ weeks: 2 }).startOf('day').toISO();
  const endOfDay = now.plus({ weeks: 2 }).endOf('day').toISO();

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
//Dont delete this is for render
// const { google } = require('googleapis');
// const { DateTime } = require('luxon');
// const path = require('path');
// let keyFilePath = '/etc/secrets/google_calendar_key.json';
// if (!require('fs').existsSync(keyFilePath)) {
//   keyFilePath = path.join(__dirname, 'google_calendar_key.json'); // fallback for local dev
// }
// const auth = new google.auth.GoogleAuth({
//   keyFile: keyFilePath,
//   scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
// });

// // const auth = new google.auth.GoogleAuth({
// //   keyFile: '/etc/secrets/google_calendar_key.json',
// //   scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
// // });

// const TIME_ZONE = 'America/New_York'; // GMT-4 during DST

// async function fetchCalendar(cId) {
//   const authClient = await auth.getClient();
//   const calendar = google.calendar({ version: 'v3', auth: authClient });

//   const now = DateTime.now().setZone(TIME_ZONE);

//   const startOfDay = now.startOf('day').toISO(); // e.g., 2025-06-09T00:00:00.000-04:00
//   const endOfDay = now.endOf('day').toISO();     // e.g., 2025-06-09T23:59:59.999-04:00

//   const res = await calendar.events.list({
//     calendarId: cId,
//     timeMin: startOfDay,
//     timeMax: endOfDay,
//     singleEvents: true,
//     orderBy: 'startTime',
//     timeZone: TIME_ZONE,
//   });

//   return res.data.items;
// }

// module.exports = { fetchCalendar };
