const { google } = require('googleapis');
const { DateTime } = require('luxon');
const keyPath =require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

// 🔹 初始化 Google Auth（使用 keyFile）
const auth = new google.auth.GoogleAuth({
  keyFile: keyPath,
  scopes: ['https://www.googleapis.com/auth/calendar.readonly'], // 只读，可换成 full access
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
