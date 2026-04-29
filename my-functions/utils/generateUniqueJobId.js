const db = require("../db");

async function generateUniqueJobId() {
  let jobId;
  let exists = true;

  while (exists) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    jobId = `JOB-${dateStr}-${randomStr}`;
    exists = false;

    try {
      const [rSnap, dSnap] = await Promise.all([
        db.ref(`jobs/Release/Regular/${jobId}`).once("value"),
        db.ref(`jobs/Release/Daily/${jobId}`).once("value"),
      ]);
      exists = rSnap.exists() || dSnap.exists();
    } catch (error) {
      console.error("⚠️ Error checking job ID:", error);
      exists = false;
    }
  }

  return jobId;
}

module.exports = generateUniqueJobId;
