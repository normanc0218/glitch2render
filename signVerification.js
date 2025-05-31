const crypto = require('crypto');
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

const signVerification = (req, res, next) => {
  const slackSignature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];

  if (!slackSignature || !timestamp) {
    return res.status(400).send('Missing headers');
  }

  // Prevent replay attacks
  const time = Math.floor(Date.now() / 1000);
  if (Math.abs(time - timestamp) > 300) {
    return res.status(400).send('Ignore this request.');
  }

  const sigBasestring = `v0:${timestamp}:${req.body.toString()}`;
  const mySignature = 'v0=' +
    crypto
      .createHmac('sha256', slackSigningSecret)
      .update(sigBasestring, 'utf8')
      .digest('hex');

  const valid = crypto.timingSafeEqual(
    Buffer.from(mySignature, 'utf8'),
    Buffer.from(slackSignature, 'utf8')
  );

  if (!valid) {
    return res.status(400).send('Verification failed');
  }

  next();
};

module.exports = signVerification;
