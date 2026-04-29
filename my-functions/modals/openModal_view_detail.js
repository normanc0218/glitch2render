const axios = require("axios");
const qs = require("qs");
const db = require("../db");

const {
  createTextSection,
  createDivider,
  createHeader,
  createImage,
} = require("../utils/blockBuilder");

const openModal_view_detail = async (viewId, jobId) => {
  const ref = db.ref("/jobs");
  let job = null;

    try {
      // 1️⃣ 获取整个 jobs 数据
      const snapshot = await ref.once("value");
      const jobsData = snapshot.val() || {};

      const allJobs = [];

      // 2️⃣ 遍历每个顶层分类
      for (const [category, subData] of Object.entries(jobsData)) {
        if (!subData || typeof subData !== "object") continue;

        // 第二层循环
        for (const [key, value] of Object.entries(subData)) {
          // 🧩 如果 value 是对象，继续判断它是不是 job 列表还是 job 本身
          if (value && typeof value === "object" && !value.description) {
            // 📦 三层结构: jobs/Release/daily/{jobId}
            for (const [innerJobId, jobData] of Object.entries(value)) {
              allJobs.push({
                id: innerJobId,
                category, // 第一层
                subType: key, // 第二层
                ...jobData,
              });
            }
          } else {
            // 📁 两层结构: jobs/Schedule/{jobId}
            allJobs.push({
              id: key,
              category, // 第一层
              subType: null,
              ...value,
            });
          }
        }
      }

      // 3️⃣ 查找对应 job
      job = allJobs.find((j) => j.id === jobId);

      if (!job) {
        console.error(`⚠️ Job ${jobId} not found in any category.`);
        return;
      }

      console.log(`✅ Found job in /jobs/${job.category}${job.subType ? "/" + job.subType : ""}`);
    } catch (error) {
      console.error("❌ Error fetching job:", error.message);
    };

  const blocks = [
    createTextSection(`*Job ID:* ${job.id}`),
    createTextSection(
      `*Category:* ${job.category || "N/A"}\n*Ordered By:* ${job.orderedBy || "N/A"}\n*Machine Location:* ${
        job.machineLocation||"N/A"
      }\n*Finder:* ${job.reporter || "N/A"}`
    ),
    createTextSection(`*Description:* ${job.description||"N/A"}`),
    createTextSection(
      `*Assigned Staff:* ${job.assignedTo||"N/A"}\n*Order Date:* ${job.orderDate||"N/A"}\n*Order Time:* ${
        job.orderTime||"N/A"
      }\n*Status:* ${job.status||"N/A"}`
    ),
    createDivider(),
  ];
  if (job.status === "Accepted") {
    blocks.push(
      createTextSection(
        `*Accept Date:* ${job.acceptDate || "N/A"}\n*Accept Time:* ${
          job.acceptTime || "N/A"
        }\n*Remarks:* ${job.remarks || "None"}`
      ),
      createDivider()
    );
  }
  else if (job.status === "Rejected") {
    blocks.push(
      createTextSection(
        `*Reject Date:* ${job.rejectDate || "N/A"}\n*Reject Time:* ${
          job.rejectTime || "N/A"
        }\n*Reject by:* ${job.assignedTo || "None"}\n*Reject reason:* ${
          job.rejectReason
        }`
      ),
      createDivider()
    );
  }
  else if (job.status !== "Pending"){
    blocks.push(
      createTextSection(
        `*Accept Date:* ${job.acceptDate || "N/A"}\n*Accept Time:* ${
          job.acceptTime || "N/A"
        }\n*Remarks:* ${job.remarks || "None"}`
      ),
      createDivider()
    );
    blocks.push(
      createTextSection(
        `*Done By:* ${job.doneBy || "N/A"}\n*Cause of issue:* ${
          job.reasonDefect || "N/A"
        }\n*Other reasons?:* ${job.otherReason || "N/A"}\n*Tools collected:* ${
          job.toolCleanUp || "None"
        }\n*Machine Reset confirmed:* ${
          job.machineReset||"N/A"
        }\n*Notify to Supervisor:* ${
          job.notifySupervisor||"N/A"
        }\n*Message to Supervisor:* ${
          job.messageToSupervisor|| "None"
        }\n*Other Status:* ${
          job.statusOther|| "None"
        }\n*Specify other Status:* ${job.otherSpecify || "None"}\n*End Date:* ${
          job.endDate || "None"
        }\n*End Time:* ${job.endTime || "None"}`
      ),
      createHeader("Picture for Finished Job")
    );

    if (Array.isArray(job.finishPicture)) {
      blocks.push(
        ...job.finishPicture
          .slice(0, 5)
          .map((url, i) => createImage(url, `Job image ${i + 1}`))
      );
    }

    blocks.push(createDivider());
  }
  blocks.push(createHeader("Picture for Job Order"));
  if (Array.isArray(job.issuePicture)) {
    blocks.push(
      ...job.issuePicture
        .slice(0, 5)
        .map((url, i) => createImage(url, `Job image ${i + 1}`))
    );
  }

  const modal = {
    type: "modal",
    callback_id: "viewDetail",
    title: {
      type: "plain_text",
      text: "Job Details",
      emoji: true,
    },
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true,
    },
    blocks,
  };

const args = {
    token: process.env.SLACK_BOT_TOKEN,  // Ensure correct bot token
    view_id: viewId,  // The trigger ID that comes from the button press
    view: JSON.stringify(modal)  // Pass the modal structure as JSON
  };

  try {
    const result = await axios.post('https://slack.com/api/views.update', qs.stringify(args));
    
    if (result.data.ok) {
      console.log('Modal opened successfully!');
    } else {
      console.error('Error opening modal:', result.data.error);  // Log any error response
    }
  } catch (error) {
    console.error('Error during modal open request:', error.message);  // Handle network or other errors
  }
};
module.exports = openModal_view_detail;
