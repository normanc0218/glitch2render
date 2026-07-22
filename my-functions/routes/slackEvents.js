// my-functions/routes/slackEvents.js
const { displayHome } = require("../services/modalService");

const recentHomeOpens = new Map(); // userId → timestamp, debounce duplicate app_home_opened

const slackEvents = async (req, res) => {
  console.log("🔥 /slack/events reached");
  const { type, challenge, event } = req.body;

  // ✅ Step 1: Slack URL Verification
  if (type === "url_verification") {
    console.log("✅ Responding to Slack challenge");
    return res.status(200).json({ challenge });
  }

  // ✅ Step 2: Slack Event Callback
  if (type === "event_callback") {
    console.log("✅ Slack event callback received:", event?.type);

    // ⚡️ Slack 要求必须在 3 秒内响应
    res.sendStatus(200);

    // 🔹 异步处理事件（避免超时）
    try {
      if (event?.type === "app_home_opened") {
        const now = Date.now();
        const last = recentHomeOpens.get(event.user) || 0;
        if (now - last < 2000) {
          console.log(`⏭️ Skipping duplicate app_home_opened for ${event.user} (${now - last}ms since last)`);
          return;
        }
        recentHomeOpens.set(event.user, now);
        console.log(`👤 App home opened by user: ${event.user}`);
        await displayHome(event.user);
      } else {
        console.log("ℹ️ Unhandled Slack event type:", event.type);
      }
    } catch (error) {
      console.error("❌ Error handling Slack event:", error);
    }

    return; // 确保函数结束
  }

  // ❌ 未识别的请求
  console.warn("⚠️ Unknown Slack event type:", type);
  return res.sendStatus(400);
};

module.exports = slackEvents;
