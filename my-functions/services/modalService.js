const { WebClient } = require("@slack/web-api");
const userConfig = require("./slackUserService");
const { invalidateReleaseCache } = require("./homeQueries");
const { buildSupervisorHome } = require("./supervisorHome");
const { buildMaintenanceHome } = require("./maintenanceHome");
const { buildOtherHome } = require("./otherHome");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const blocksCache = new Map(); // userId → { json, ts }
const CACHE_TTL = 30 * 1000; // 30 seconds — short enough to retry if client missed the push
const processingHome = new Set(); // userId — prevents concurrent displayHome for same user

function getUserRoles(userId) {
  const roles = [];
  const isIn = (obj) => Object.values(obj || {}).includes(userId);
  if (isIn(userConfig.managerUsers))     roles.push("manager");
  if (isIn(userConfig.Supervisors))      roles.push("supervisor");
  if (isIn(userConfig.maintenanceStaff)) roles.push("maintenance");
  if (isIn(userConfig.trainUsers))       roles.push("trainer");
  return roles.length > 0 ? roles : ["guest"];
}

async function displayHome(userId) {
  if (processingHome.has(userId)) {
    console.log(`⏭️ Skipping displayHome for ${userId} — already in progress`);
    return;
  }
  processingHome.add(userId);
  const startTime = Date.now();
  const safetyTimer = setTimeout(() => {
    console.error(`⏰ displayHome safety timeout — releasing lock for ${userId} after 30s`);
    processingHome.delete(userId);
  }, 30000);
  try {
    const poolStart = Date.now();
    await userConfig.refreshIfStale();
    console.log(`🔌 Pool/cache ready: ${Date.now() - poolStart}ms`);

    const roles = getUserRoles(userId);
    console.log(`Rendering Home for ${userId}, roles: ${roles.join(", ")}`);

    let blocks;
    if (roles.includes("supervisor")) {
      const supervisorName = Object.keys(userConfig.Supervisors).find(n => userConfig.Supervisors[n] === userId) || null;
      blocks = await buildSupervisorHome(userId, supervisorName);
    } else if (roles.includes("maintenance")) {
      const techNames = Object.entries(userConfig.maintenanceStaff).filter(([, id]) => id === userId).map(([name]) => name);
      blocks = await buildMaintenanceHome(userId, techNames);
    } else {
      blocks = await buildOtherHome(userId, roles);
    }
    console.log(`🏗️ Blocks built: ${Date.now() - startTime}ms`);

    const json = JSON.stringify(blocks);
    const cached = blocksCache.get(userId);
    const stale = !cached || (Date.now() - cached.ts > CACHE_TTL);
    if (!stale && json === cached.json) {
      console.log(`⏭️ Blocks unchanged for ${userId}, skipping publish`);
      return;
    }
    await client.views.publish({ user_id: userId, view: { type: "home", callback_id: "home_view", blocks } });
    blocksCache.set(userId, { json, ts: Date.now() });
    console.log(`✅ Home published for ${userId} | Total: ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error("❌ Error publishing Home Tab for", userId, error.message, error.stack);
    if (error.data?.response_metadata?.messages) {
      console.error("Slack validation errors:", JSON.stringify(error.data.response_metadata.messages, null, 2));
    }
  } finally {
    clearTimeout(safetyTimer);
    processingHome.delete(userId);
  }
}

module.exports = { displayHome, invalidateReleaseCache };
