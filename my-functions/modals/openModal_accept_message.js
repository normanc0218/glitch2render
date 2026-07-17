const axios = require('axios');
const db = require("../db");
const { displayHome, invalidateReleaseCache } = require("../services/modalService");
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
  const t0 = Date.now();
  console.log(`[accept] start jobId=${jobId} user=${userId}`);

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

  const jobRef = db.ref(`jobs/Release/${found.category}/${jobId}`);
  await jobRef.update({ status: "Accepted", acceptDatetime: new Date().toISOString().slice(0, 16) });
  invalidateReleaseCache();
  console.log(`[accept] RTDB write done: ${Date.now() - t0}ms`);

  // Open modal FIRST — trigger_id expires 3s from the button click
  const blocks = [createTextSection(`✅ Job *${jobId}* has been accepted.`)];
  const modal = {
    type: "modal",
    callback_id: "accept_message",
    title: { type: "plain_text", text: "You have Accept the Job~" },
    private_metadata: jobId,
    blocks,
  };

  console.log(`[accept] views.open start: ${Date.now() - t0}ms`);
  try {
    const response = await axios.post(
      'https://slack.com/api/views.open',
      { trigger_id, view: modal },
      { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}` } }
    );
    if (!response.data.ok) {
      console.error(`[accept] views.open failed: ${Date.now() - t0}ms`, response.data);
    } else {
      console.log(`[accept] views.open done: ${Date.now() - t0}ms ✅`);
    }
  } catch (err) {
    console.error(`[accept] views.open error: ${Date.now() - t0}ms`, err.response?.data || err.message);
  }

  // displayHome fire-and-forget — runs in background after modal is already open
  displayHome(userId)
    .then(() => console.log(`[accept] displayHome done: ${Date.now() - t0}ms`))
    .catch(err => console.error(`[accept] displayHome failed: ${Date.now() - t0}ms`, err.message));
};

module.exports =  openModal_accept_message ;
