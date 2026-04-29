const functions = require("firebase-functions/v2");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.database();

exports.processScheduledJobs = functions.scheduler.onSchedule("0 3 * * *", async (event) => {
  console.log("⏰ Running scheduled job processor...");

  const holidays = {
    "2025-01-01": true,
    "2025-02-17": true,
    "2025-04-18": true,
    "2025-05-19": true,
    "2025-07-01": true,
    "2025-09-01": true,
    "2025-10-13": true,
    "2025-12-25": true,
    "2025-12-26": true,
    "2026-01-01": true,
    "2026-01-02": true,
    "2026-02-16": true,
    "2026-04-03": true,
    "2026-05-18": true,
    "2026-07-01": true,
    "2026-09-07": true,
    "2026-10-12": true,
    "2026-12-25": true,
    "2027-01-01": true,
    "2027-01-01": true,
    "2027-02-15": true,
    "2027-03-26": true,
    "2027-05-24": true,
    "2027-07-01": true,
    "2027-07-02": true,
    "2027-09-06": true,
    "2027-10-11": true,
    "2027-12-25": true
  };

  try {
    const today = new Date().toISOString().slice(0, 10);
    const weekday = new Date().getDay(); // 1–5 = Mon–Fri

    // ❌ 不运行在 holidays
    if (holidays[today]) {
      console.log("📛 Holiday detected. No PM tasks generated.");
      return;
    }

    // 加载 schedule entries
    const scheduleSnap = await db.ref("jobs/Schedule").once("value");
    const scheduleData = scheduleSnap.val() || {};

    for (const [jobId, job] of Object.entries(scheduleData)) {
      if (!job.repeat) continue;
      //only monday to S
      const isWeekday = weekday >= 1 && weekday <= 4;

      // DAILY—只在 weekday 运行
      if (job.repeat === "daily") {
        if (!isWeekday) {
          console.log(`⏭ Skipping daily job ${jobId}, weekend.`);
          continue;
        }

        await generateJobInstance(job, jobId, today, "daily");
        continue;
      }


      // WEEKLY—每周指定 weekday
      if (job.repeat === "onFriday") {
        // example: job.weekday="2" (Tuesday)
        if (weekday === 5) {
          await generateJobInstance(job, jobId, today, "onFriday");
        }
      }

    }

    console.log("🎉 Schedule processing complete.");
  } catch (e) {
    console.error("🔥 Error during schedule processing:", e);
  }
});

// Helper
async function generateJobInstance(original, jobId, today, type) {
  const newJobId = "JOB-" + today.replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

  const newJob = {
    ...original,
    status: "Pending",
    orderDate: today,
    timestamp: new Date().toISOString(),
    originScheduleId: jobId
  };

  await db.ref(`jobs/Release/Daily/${newJobId}`).set(newJob);

  console.log(`📌 Created new PM job: ${newJobId} (from ${jobId})`);
}
