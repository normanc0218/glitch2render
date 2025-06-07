const axios = require("axios");

const BASE_URL = "http://localhost:12000/slack/events"; // 或你的线上地址
const NUM_USERS = 20; // 模拟20个用户
const userIds = Array.from({ length: NUM_USERS }, (_, i) => `U${1000 + i}`);

async function sendEvent(userId) {
  const payload = {
    type: "event_callback",
    event: {
      type: "app_home_opened",
      user: userId
    }
  };

  try {
    await axios.post(BASE_URL, payload);
    console.log(`✅ Event sent for ${userId}`);
  } catch (err) {
    console.error(`❌ Failed for ${userId}`, err.message);
  }
}

(async () => {
  console.time("⚡ Bulk Home Load");
  await Promise.all(userIds.map(id => sendEvent(id)));
  console.timeEnd("⚡ Bulk Home Load");
})();
