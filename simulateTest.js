const axios = require("axios");
const https = require("https");
const BASE_URL = "https://ambiguous-ionized-traffic.glitch.me/slack/events"; // 🔒 HTTPS!
// Simulate 20 fake users
const NUM_USERS = 20;
const userIds = Array.from({ length: NUM_USERS }, (_, i) => `U${1000 + i}`);

// Allow self-signed certs in dev (Glitch HTTPS can be picky sometimes)
const agent = new https.Agent({ rejectUnauthorized: false });

async function sendEvent(userId) {
  const payload = {
    type: "event_callback",
    event: {
      type: "app_home_opened",
      user: userId
    }
  };

  try {
    await axios.post(BASE_URL, payload, {
      httpsAgent: agent,
      headers: {
        "Content-Type": "application/json"
      }
    });
    console.log(`✅ Event sent for ${userId}`);
  } catch (err) {
    console.error(`❌ Failed for ${userId}:`, err.message);
  }
}

(async () => {
  console.time("⚡ Bulk Home Load");
  await Promise.all(userIds.map(sendEvent));
  console.timeEnd("⚡ Bulk Home Load");
})();