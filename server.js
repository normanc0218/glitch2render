const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json()); // Very important!

app.post('/slack/events', (req, res) => {
  const { type, challenge } = req.body;

  if (type === 'url_verification') {
    console.log('✅ Challenge received');
    return res.status(200).json({ challenge });
  }

  res.sendStatus(200);
});

app.get('/', (req, res) => {
  res.send('Slack app is live!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`App is listening on port ${PORT}`));
