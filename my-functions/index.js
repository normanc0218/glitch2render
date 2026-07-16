require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const verifySlackSignature  = require("./utils/verifySlackSignature");

// 路由模块
const slackEvents = require("./routes/slackEvents");
const slackActions = require("./routes/slackActions");
const slackOptions = require("./routes/slackOptions");
const { onRequest } = require("firebase-functions/v2/https");
const app = express();

// Slack 需要原始 body 用于签名验证
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// // ✅ Slack 验证中间件
// app.use("/slack/events", verifySlackSignature);
// app.use("/slack/actions", verifySlackSignature);

// ✅ Slack 路由
app.post("/slack/events", verifySlackSignature, slackEvents);
app.post("/slack/actions", verifySlackSignature, slackActions);
app.post("/slack/options", verifySlackSignature, slackOptions);

// --- 本地运行 + Google Cloud Functions 兼容 ---
if (require.main === module) {
  const port = process.env.PORT || 8080;
  app.listen(port, () => console.log(`🚀 Local server running on port ${port}`));
}

exports.slackHandler = onRequest(
  {
    memory: "512MiB",
    timeoutSeconds: 60,
    minInstances: 1,
  },
  app
);