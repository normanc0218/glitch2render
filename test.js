const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const open = require('open');

const app = express();
const PORT = 3000;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Define required scopes
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

app.get('/', async (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  await open(authUrl);
  res.send('Redirecting to Google OAuth2...');
});

app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('Missing auth code.');
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // ✅ You can now use oAuth2Client to make authenticated API calls
    console.log('Access Token:', tokens.access_token);
    console.log('Refresh Token:', tokens.refresh_token);

    res.send(`<h2>✅ Auth successful</h2><p>Access token:</p><pre>${tokens.access_token}</pre>`);
  } catch (err) {
    console.error('OAuth2 error:', err);
    res.status(500).send('OAuth2 failed');
  }
});

app.listen(PORT, () => {
  console.log(`OAuth2 test running at http://localhost:${PORT}`);
});
