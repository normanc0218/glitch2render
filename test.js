require('dotenv').config();
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');

const app = express();
const PORT = 4000;

// OAuth2 setup
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'https://ambiguous-ionized-traffic.glitch.me/oauth2callback';

const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Required scopes
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

app.get('/', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  res.send(`<a href="${authUrl}" target="_blank">🔐 Authenticate with Google</a>`);
});

app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing auth code.');

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    console.log('✅ Authenticated!');

    // Fetch events from calendar
    const accessToken = (await oAuth2Client.getAccessToken()).token;

    const calendarRes = await axios.get(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          timeMin: new Date().toISOString(),
          maxResults: 5,
          singleEvents: true,
          orderBy: 'startTime',
        },
      }
    );

    const events = calendarRes.data.items || [];

    let html = `<h2>✅ Auth successful</h2>`;
    html += `<p>Access token: <code>${tokens.access_token}</code></p>`;
    html += `<h3>📅 Upcoming Events</h3><ul>`;
    if (events.length === 0) {
      html += `<li>No upcoming events</li>`;
    } else {
      events.forEach((event) => {
        const start = event.start.dateTime || event.start.date;
        html += `<li><strong>${start}</strong>: ${event.summary}</li>`;
      });
    }
    html += `</ul>`;

    res.send(html);
  } catch (err) {
    console.error('OAuth2 error:', err);
    res.status(500).send('OAuth2 failed');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
