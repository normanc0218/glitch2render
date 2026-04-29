const crypto = require('crypto');
const qs = require("qs");

// Fetch this from environment variables
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

function verifySlackSignature(req, res, next) {
  // ✅ 允许 Slack 的 URL 验证请求绕过签名验证
  if (req.body && req.body.type === "url_verification") {
    console.log("🪪 Slack URL verification request — skipping signature check");
    return next();
  }

  // ✅ 可选：在开发环境跳过验证
  if (process.env.NODE_ENV === "development") {
    console.log("⚠️ Slack signature check bypassed in development mode");
    return next();
  }

  const slackSignature = req.headers['x-slack-signature'];
  const timestamp = req.headers['x-slack-request-timestamp'];

  if (!slackSignature || !timestamp || !req.rawBody) {
    return res.status(400).send('Missing headers or body');
  }

  // 防重放攻击
  const time = Math.floor(Date.now() / 1000);
  if (Math.abs(time - timestamp) > 300) {
    return res.status(400).send('Request too old');
  }

  const sigBaseString = `v0:${timestamp}:${req.rawBody}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', slackSigningSecret)
    .update(sigBaseString, 'utf8')
    .digest('hex');

  try {
    const valid = crypto.timingSafeEqual(
      Buffer.from(mySignature, 'utf8'),
      Buffer.from(slackSignature, 'utf8')
    );

    if (valid) {
      console.log("✅ Slack signature verified");
      return next();
    } else {
      console.warn("❌ Invalid Slack signature");
      return res.status(400).send('Invalid signature');
    }
  } catch (err) {
    console.error("❌ Signature verification error:", err);
    return res.status(400).send('Signature verification error');
  }
}


module.exports = verifySlackSignature;

