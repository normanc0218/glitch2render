require("dotenv").config();
const db = require("../db");
const {
  maintenanceStaff,
  managerUsers,
  Supervisors,
  trainUsers,
} = require("../userConfig");

/**
 * 🔍 根据 userConfig.js 生成标准用户结构
 */
function buildUserData() {
  const users = {};

  // Maintenance
  for (const [name, id] of Object.entries(maintenanceStaff)) {
    users[id] = users[id] || { name, roles: [] };
    if (!users[id].roles.includes("maintenance")) users[id].roles.push("maintenance");
  }

  // Supervisors
  for (const [name, id] of Object.entries(Supervisors)) {
    users[id] = users[id] || { name, roles: [] };
    if (!users[id].roles.includes("supervisor")) users[id].roles.push("supervisor");
  }

  // Managers (部分和 supervisor 重叠)
  for (const id of managerUsers) {
    const name = Object.keys(Supervisors).find((key) => Supervisors[key] === id) || "Manager";
    users[id] = users[id] || { name, roles: [] };
    if (!users[id].roles.includes("supervisor")) users[id].roles.push("supervisor");
  }

  // Trainers
  for (const id of trainUsers) {
    const name = Object.keys(Supervisors).find((key) => Supervisors[key] === id) || "Trainer";
    users[id] = users[id] || { name, roles: [] };
    if (!users[id].roles.includes("trainer")) users[id].roles.push("trainer");
  }

  return users;
}

/**
 * 🚀 同步用户数据到 Firebase
 */
async function syncUsers() {
  try {
    const users = buildUserData();

    console.log("🧭 Ready to sync users to Firebase:");
    console.table(
      Object.entries(users).map(([id, u]) => ({
        id,
        name: u.name,
        roles: u.roles.join(", "),
      }))
    );

    await db.ref("users").set(users);

    console.log("\n✅ Successfully synced all users to Firebase Realtime Database!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to sync users:", error);
    process.exit(1);
  }
}

syncUsers();
