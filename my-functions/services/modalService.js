const userConfig = require("./slackUserService");
const { invalidateReleaseCache } = require("./homeQueries");
const { buildSupervisorHome } = require("./supervisorHome");
const { buildMaintenanceHome } = require("./maintenanceHome");
const { buildOtherHome } = require("./otherHome");

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
  const startTime = Date.now();
  try {
    const poolStart = Date.now();
    await userConfig.refreshIfStale();
    console.log(`🔌 Pool/cache ready: ${Date.now() - poolStart}ms`);

    const roles = getUserRoles(userId);
    console.log(`Rendering Home for ${userId}, roles: ${roles.join(", ")}`);

    if (roles.includes("supervisor")) {
      const supervisorName = Object.keys(userConfig.Supervisors).find(n => userConfig.Supervisors[n] === userId) || null;
      await buildSupervisorHome(userId, supervisorName, startTime);
    } else if (roles.includes("maintenance")) {
      const techNames = Object.entries(userConfig.maintenanceStaff).filter(([, id]) => id === userId).map(([name]) => name);
      await buildMaintenanceHome(userId, techNames, startTime);
    } else {
      await buildOtherHome(userId, roles, startTime);
    }
  } catch (error) {
    console.error("❌ Error publishing Home Tab for", userId, error.message, error.stack);
    if (error.data?.response_metadata?.messages) {
      console.error("Slack validation errors:", JSON.stringify(error.data.response_metadata.messages, null, 2));
    }
  }
}

module.exports = { displayHome, invalidateReleaseCache };
