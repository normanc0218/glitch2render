require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 12000;

// Middleware to parse JSON bodies
app.use(express.json());

app.post('/slack/events', (req, res) => {
  // URL Verification - Slack sends a challenge that needs to be returned
  if (req.body.type === 'url_verification') {
    res.send({ challenge: req.body.challenge });
  } else {
    res.sendStatus(200); // Respond with 200 OK for other event types (if any)
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});