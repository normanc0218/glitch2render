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
      // 读取整个 Release 下的所有子分类
      const snapshot = await db.ref("jobs/Release").once("value");
      const allReleaseJobs = snapshot.val() || {};

      // 遍历每个子分类（Regular, Daily, Project）检查 key 是否存在
      for (const category of ["Regular", "Daily", "Project"]) {
        const jobsInCategory = allReleaseJobs[category] || {};
        if (jobId in jobsInCategory) {
          exists = true;
          break; // 一旦发现重复，跳出循环生成新 ID
        }
      }
    } catch (error) {
      console.error("⚠️ Error checking job ID:", error);
      exists = false; // 出错时直接使用
    }
  }

  return jobId;
}

module.exports = generateUniqueJobId;
