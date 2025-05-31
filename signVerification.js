const crypto = require('crypto');

// Fetch this from environment variables
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

let signVerification = (req, res, next) => {
  // Slack's signature and timestamp
  let slackSignature = req.headers['x-slack-signature'];
  let timestamp = req.headers['x-slack-request-timestamp'];
  // Generate the current time
  let time = Math.floor(new Date().getTime() / 1000);
  console.log(slackSignature,timestamp,time)
  // Allow a 5-minute window (300 seconds) to avoid replay attacks
  if (Math.abs(time - timestamp) > 300) {
    return res.status(400).send('Ignore this request.');
  }

  // If Slack signing secret is not found, return error
  if (!slackSigningSecret) {
    return res.status(400).send('Slack signing secret is empty.');
  }

  // The body should be raw, so we must parse the request body as a string
  let requestBody = req.body.toString();
  console.log(requestBody)
  // Create the signature base string
  let sigBasestring = 'v0:' + timestamp + ':' + requestBody;

  // Create your own signature from the base string and compare it with Slack's signature
  let mySignature = 'v0=' + 
                    crypto.createHmac('sha256', slackSigningSecret)
                          .update(sigBasestring, 'utf8')
                          .digest('hex');

  // Compare the signatures in constant time to prevent timing attacks
  if (crypto.timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(slackSignature, 'utf8')
    )) {
      // If signatures match, pass the request to the next middleware
      return next();
  } else {
    // If the signatures don't match, respond with a verification error
    return res.status(400).send('Verification failed');
  }
};

module.exports = signVerification;
