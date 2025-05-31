const crypto = require('crypto');
const qs = require("qs");

// Fetch this from environment variables
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

let signVerification = (req, res, next) => {
   let slackSignature = req.headers['x-slack-signature'];
   
   let requestBody = qs.stringify(req.body, {format : 'RFC1738'});
   let timestamp = req.headers['x-slack-request-timestamp'];
   let time = Math.floor(new Date().getTime()/1000);
   if (Math.abs(time - timestamp) > 300) {
      return res.status(400).send('Ignore this request.');
   }
   if (!slackSigningSecret) {
      return res.status(400).send('Slack signing secret is empty.');
   }

   let sigBasestring = 'v0:' + timestamp + ':' + requestBody;
   let mySignature = 'v0=' + 
                  crypto.createHmac('sha256', slackSigningSecret)
                        .update(sigBasestring, 'utf8')
                        .digest('hex');
  console.log(mySignature);
  console.log(slackSignature);

   if (crypto.timingSafeEqual(
              Buffer.from(mySignature, 'utf8'),
              Buffer.from(slackSignature, 'utf8'))
      ) {
     
          next();
   } else {
          return res.status(400).send('Verification failed');
   }
}
module.exports = signVerification;

//   // Slack's signature and timestamp
//   let slackSignature = req.headers['x-slack-signature'];
//   let timestamp = req.headers['x-slack-request-timestamp'];
//   // Generate the current time
//   let time = Math.floor(new Date().getTime() / 1000);
//   // Allow a 5-minute window (300 seconds) to avoid replay attacks
//   if (Math.abs(time - timestamp) > 300) {
//     return res.status(400).send('Ignore this request.');
//   }

//   // If Slack signing secret is not found, return error
//   if (!slackSigningSecret) {
//     return res.status(400).send('Slack signing secret is empty.');
//   }

//   let bodyString = req.body.toString()
//     // Parse the string into a JSON object
//   let jsonData = JSON.parse(bodyString);

//   // Convert the JSON object into a query string
//   const requestBody = convertToQueryString(jsonData);
//   // Create the signature base string
//   let sigBasestring = 'v0:' + timestamp + ':' + requestBody;
//   console.log(requestBody)

//   // Create your own signature from the base string and compare it with Slack's signature
//   let mySignature = 'v0=' + 
//                     crypto.createHmac('sha256', slackSigningSecret)
//                           .update(sigBasestring, 'utf8')
//                           .digest('hex');

//   // Compare the signatures in constant time to prevent timing attacks
//   if (crypto.timingSafeEqual(
//       Buffer.from(mySignature, 'utf8'),
//       Buffer.from(slackSignature, 'utf8')
//     )) {
//       // If signatures match, pass the request to the next middleware
//       return next();
//   } else {
//     // If the signatures don't match, respond with a verification error
//     return res.status(400).send('Verification failed');
//   }
// };

module.exports = signVerification;
