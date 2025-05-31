const crypto = require('crypto');
const qs = require("qs");

// Fetch this from environment variables
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
function signVerification(req, res, next) {
  const slackSignature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];

  if (!slackSignature || !timestamp || !req.rawBody) {
    return res.status(400).send('Missing headers or body');
  }

  // Protect against replay attacks
  const time = Math.floor(Date.now() / 1000);
  if (Math.abs(time - timestamp) > 300) {
    return res.status(400).send('Request too old');
  }

  const sigBaseString = `v0:${timestamp}:${req.rawBody}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', slackSigningSecret)
    .update(sigBaseString, 'utf8')
    .digest('hex');
  // console.log(mySignature)
  // console.log(slackSignature)
  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(slackSignature, 'utf8')
    );
    
    if (valid) {
      console.log("signature passed")
      return next();
    } else {
      return res.status(400).send('Invalid signature');
    }
  } catch (err) {
    return res.status(400).send('Signature verification error');
  }
}

module.exports = signVerification;

