const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// 解析 JSON body
app.use(bodyParser.json());

// Slack Events API Endpoint
app.post('/slack/events', async (req, res) => {
  const { type } = req.body;

  switch (type) {
    case 'url_verification': {
      // Step 1: 验证 Slack Events API 的 URL
      return res.send({ challenge: req.body.challenge });
    }

    // 你可以在这里继续扩展其他事件类型，如 'event_callback'
    
    default:
      return res.sendStatus(200);
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`⚡️ Server is running on port ${PORT}`);
});
