const axios = require('axios');
const db = require("../db");
const { displayHome } = require("../services/modalService");
const { WebClient } = require("@slack/web-api");
const token = process.env.SLACK_BOT_TOKEN;
const client = new WebClient(token);
const { maintenanceStaff, managerUsers } = require('../userConfig');
const {
  createInputBlock,
  createInputBlock_select,
  createTextSection,
  createInputBlock_date,
  createInputBlock_time,
} = require('../utils/blockBuilder');
const nyDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date()); // e.g. "2025-05-28"
const [month, day, year] = nyDate.split('/');
const initialDate = `${year}-${month}-${day}`;

function getNYTimeString() {
  const d = new Date();
  const ny = new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const hh = ny.getHours().toString().padStart(2, '0');
  const mm = ny.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}
const initialTime = getNYTimeString();
const mStaffName = Object.keys(maintenanceStaff);
const openModal_accept_message = async (trigger_id, userId, jobId) => {
  // 并行读三条精准路径，找 jobId 在哪个子类
    const [rSnap, dSnap, pSnap] = await Promise.all([
      db.ref(`jobs/Release/Regular/${jobId}`).once("value"),
      db.ref(`jobs/Release/Daily/${jobId}`).once("value"),
      db.ref(`jobs/Release/Project/${jobId}`).once("value"),
    ]);

    const found = [
      { snap: rSnap, category: "Regular" },
      { snap: dSnap, category: "Daily" },
      { snap: pSnap, category: "Project" },
    ].find(({ snap }) => snap.exists());

    if (!found) {
      console.error(`❌ Job ${jobId} not found in any branch.`);
      return;
    }

    console.log(`✅ Found job ${jobId} in branch ${found.category}`);
    const jobRef = db.ref(`jobs/Release/${found.category}/${jobId}`);
    await jobRef.update({
      status: "Accepted",
      acceptDate: new Date().toISOString().slice(0, 10),
      acceptTime: new Date().toISOString().slice(11, 19),
    });
  const blocks=[]
  blocks.push(createTextSection(`✅ Job *${jobId}* has been accepted.`));
  await client.views.publish({
    user_id: userId,
    view: {
      type: "home",
      blocks: displayHome(userId) // 你自己生成 Home Tab block 的函数
    }
  });
  const modal = {
    type: "modal",
    callback_id: "accept_message",
    title:{
      type:"plain_text",
      text:"You have Accept the Job~"
    },
    private_metadata: jobId,
    blocks
  };

  try {
    const response = await axios.post(
      'https://slack.com/api/views.open',
      {
        trigger_id: trigger_id,
        view: modal
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`
        }
      }
    );

    if (!response.data.ok) {
      console.error("Slack API error:", response.data);
    }

  } catch (err) {
    console.error("Modal open error:", err.response?.data || err.message);
  }
};

module.exports =  openModal_accept_message ;
