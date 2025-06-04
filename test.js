const { fetchCalendar } = require('./fetchCalendar');

const calendarEvents = await fetchCalendar('3c900c9ad4cfa608582d351a1cffae1c54c08ad48cab7be68eb3921305a88352@group.calendar.google.com');

// const { google } = require('googleapis');
// const { auth } = require('google-auth-library');
// const keys = require('./google_calendar_key.json'); // Your service account key

// async function fetchEvents() {
//   try {
//     console.log('🔧 Setting up auth...');
//     const authClient = await auth.fromJSON(keys);

//     console.log('🔑 Scopes assigned...');
//     authClient.scopes = ['https://www.googleapis.com/auth/calendar.readonly'];

//     console.log('📅 Initializing calendar...');
//     const calendar = google.calendar({ version: 'v3', auth: authClient });

//     console.log('📥 Fetching events...');
//     console.log('⏳ TimeMin:', new Date().toISOString());
//     const res = await calendar.events.list({
//       calendarId: '8f1e07292ce07989c47cbacd57096717820a1eeeeb2426be8b58232fd7d01bc8@group.calendar.google.com', // Not 'primary'
//       timeMin: new Date().toISOString(),
//       maxResults: 10,
//       singleEvents: true,
//       orderBy: 'startTime',
//     });

//     console.log('✅ Response received');

//     const events = res.data.items || [];
//     console.log(`📌 ${events.length} events fetched`);
//     if (events.length) {
//       events.forEach(e =>
//         console.log(`${e.start.dateTime || e.start.date}: ${e.summary}`)
//       );
//     } else {
//       console.log('No upcoming events.');
//     }
//   } catch (err) {
//     console.error('Failed to fetch events:', err.message);
//   }
// }
// fetchEvents()