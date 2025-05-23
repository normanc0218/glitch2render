require('dotenv').config();
const express = require('express');
const app = express();
const { displayHome } = require('./appHome'); 
const port = process.env.PORT || 12000;

// Middleware to parse JSON bodies
app.use(express.json());

app.post('/slack/events', async(req, res) => {
  switch (req.body.type) {
    case 'url_verification': {
      // verify Events API endpoint by returning challenge if present
      res.send({ challenge: req.body.challenge });
      break;
    }
    case 'event_callback': {
      // Verify the signing secret
      if (!signature.isVerified(req)) {
        res.sendStatus(404);
        return;
      } 
          // Request is verified --
      else {
        const {type, user, channel, tab, text, subtype} = req.body.event;
        // Triggered when the App Home is opened by a user
        if(type === 'app_home_opened') {
          // Display App Home
          displayHome(user);
        }
      }
    }
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});