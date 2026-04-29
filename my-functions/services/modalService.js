const { WebClient } = require("@slack/web-api");
const db = require("../db");
const { maintenanceStaff, managerUsers, Supervisors, trainUsers } = require("../userConfig");
const token = process.env.SLACK_BOT_TOKEN;
const client = new WebClient(token);
const { createButton } = require("../utils/blockBuilder");

/**
 * 🔍 根据 userConfig 判断用户的所有角色
 */
function getUserRoles(userId) {
  const roles = [];
  const isIn = (obj) => Object.values(obj || {}).includes(userId);

  if (isIn(managerUsers)) roles.push("manager");
  if (isIn(Supervisors)) roles.push("supervisor");
  if (isIn(maintenanceStaff)) roles.push("maintenance");
  if (isIn(trainUsers)) roles.push("trainer");

  return roles.length > 0 ? roles : ["guest"];
}

/**
 * 🏠 渲染 App Home 页面 - 优化版本
 */
async function displayHome(userId) {
  try {
    const startTime = Date.now();
    const roles = getUserRoles(userId);
    console.log(`Rendering Home for ${userId}, roles: ${roles.join(", ")}`);

    // ✅ 关键优化：并行查询所有需要的数据
    const dbStart = Date.now();
    const [releaseSnap, usersSnap] = await Promise.all([
      db.ref("jobs/Release").once("value"),
      db.ref("users").once("value")
    ]);
    console.log(`📊 数据库查询耗时: ${Date.now() - dbStart}ms`);

    // 一次性获取数据
    const release = releaseSnap.val() || {};
    const users = usersSnap.val() || {};

    // 构建视图
    const buildStart = Date.now();
    const header = {
      type: "header",
      text: { type: "plain_text", text: "👋 Welcome to Maintenance Assistant", emoji: true },
    };

    const divider = { type: "divider" };
    let blocks = [header, divider];

    //#region Manager
    if (roles.includes("manager")) {
      blocks.push({
        type: "header",
        text: { type: "plain_text", text: "👨‍💼 Manager Dashboard" },
      });

      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: " Submit Order" },
            style: "primary",
            action_id: "openModal",
          },
        ],
      });

      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Create Project" },
            style: "primary",
            action_id: "openModal_create_project",
          },
        ],
      });

      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Manage Schedule Job" },
            style: "primary",
            action_id: "openModal_manage_schedule",
          },
        ],
      });

      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Manage Dispatch" },
            style: "primary",
            action_id: "openModal_manage_dispatch",
          },
        ],
      });

      blocks.push({ type: "divider" });
    }
    //#endregion

    //#region Supervisor Tools
    if (roles.includes("supervisor")) {
      blocks.push({
        type: "header",
        text: { type: "plain_text", text: "👨‍💼 Supervisor Dashboard" },
      });

      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View History" },
            url: "https://docs.google.com/spreadsheets/d/1ly2FufJuZzb5b2VewVK7gOdNKTMGus16gs3QXFj-C00/edit?usp=sharing",
          },
        ],
      });

      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "🚚 Dispatch Job" },
            style: "primary",
            action_id: "openModal_dispatch",
          },
        ],
      });

      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Dispatch" },
            style: "primary",
            action_id: "openModal_view_dispatch",
          },
        ],
      });

      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: " Submit Order" },
            style: "primary",
            action_id: "openModal",
          },
        ],
      });

      blocks.push({ type: "divider" });

      // ✅ 使用已获取的 release 数据
      let finishedJobs = [];
      const completeStatuses = ["waiting", "completed"];
      
      ["Regular", "Project", "Daily"].forEach(branch => {
        const branchJobs = release[branch] || {};
        for (const [id, job] of Object.entries(branchJobs)) {
          const status = (job.status || "").toLowerCase();
          const toApprove = completeStatuses.some(s => status.includes(s));
          if (toApprove) {
            finishedJobs.push({ ...job, id, branch });
          }
        }
      });

      if (finishedJobs.length === 0) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: "_.All jobs are clear from your order._" },
        });
      } else {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📅 Please approve the following job:*`,
          },
        });

        for (const job of finishedJobs) {
          const notifyUserId = Supervisors[job.notifySupervisor];
          const notifyMatch = notifyUserId === userId;

          if (notifyMatch) {
            blocks.push({
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${job.id}* — *${job.description || " "}* — ${job.status || "Pending"}\n📍 ${job.machineLocation || "N/A"}\n Order Date: ${job.orderDate || "N/A"}\n Order Time: ${job.orderTime || "N/A"}\nSupervisor: ${job.orderedBy || "Unknown"}`,
              },
              accessory: {
                type: "button",
                text: { type: "plain_text", text: "View Detail" },
                value: job.id,
                action_id: "openModal_viewDetail_home",
              },
            });
            blocks.push(createButton("Supervisor Approve", job.id, "review_progress"));
          }
        }
        blocks.push({ type: "divider" });
      }
    }
    //#endregion

    //#region Maintenance Tools
    if (roles.includes("maintenance")) {
      blocks.push({
        type: "header",
        text: { type: "plain_text", text: "🧰 Maintenance Technician Dashboard" },
      });

      const today = new Date().toISOString().split("T")[0];
      
      // ✅ 使用已获取的 release 数据
      let todayJobs = [];
      const completeStatuses = ["complete", "completed", "approved", "approved by", "rejected", "checked"];

      ["Regular", "Project"].forEach(branch => {
        const branchJobs = release[branch] || {};
        for (const [id, job] of Object.entries(branchJobs)) {
          const status = (job.status || "").toLowerCase();
          const isIncomplete = !completeStatuses.some(s => status.includes(s));
          if (isIncomplete) {
            todayJobs.push({ ...job, id, branch });
          }
        }
      });

      ["Daily"].forEach(branch => {
        const branchJobs = release[branch] || {};
        for (const [id, job] of Object.entries(branchJobs)) {
          const status = (job.status || "").toLowerCase();
          const isIncomplete = !completeStatuses.some(s => status.includes(s));
          const order = new Date(job.orderDate);
          const todayDate = new Date(today);
          const diffDays = (todayDate - order) / (1000 * 60 * 60 * 24);

          const inLast5Days = diffDays >= 0 && diffDays <= 5;
          if (isIncomplete && inLast5Days) {
            todayJobs.push({ ...job, id, branch });
          }
        }
      });

      if (todayJobs.length === 0) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: "_You have no assigned jobs today._" },
        });
      } else {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📅 Your Jobs for ${today}:*`,
          },
        });

        for (const job of todayJobs) {
          const assignedUserId = maintenanceStaff[job.assignedTo];
          const assignedMatch = assignedUserId === userId;

          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${job.id}* — *${job.description || " "}* — ${job.status || "Pending"}\n📍 ${job.machineLocation || "N/A"}\n Order Date: ${job.orderDate || "N/A"}\n Order Time: ${job.orderTime || "N/A"}\nSupervisor: ${job.orderedBy || "Unknown"}`,
            },
            accessory: {
              type: "button",
              text: { type: "plain_text", text: "View Detail" },
              value: job.id,
              action_id: "openModal_viewDetail_home",
            },
          });

          if (assignedMatch) {
            if (job.branch === "Regular") {
              switch (job.status) {
                case "Pending":
                  blocks.push(
                    createButton("Accept", job.id, "accept_task"),
                    createButton("Plan to Do When?", job.id, "plan_accept"),
                    createButton("Reject", job.id, "reject_task", "danger")
                  );
                  break;
                case "Accepted":
                  blocks.push(createButton("Update Progress", job.id, "update_progress"));
                  break;
              }
            } else if (job.branch === "Project") {
              blocks.push(createButton("Update Project", job.id, "update_project"));
            } else {
              blocks.push(createButton("Update Daily Job", job.id, "update_daily_job"));
            }
          }
          blocks.push({ type: "divider" });
        }
      }
    }
    //#endregion

    //#region Trainer Tools
    if (roles.includes("trainer")) {
      blocks.push({
        type: "header",
        text: { type: "plain_text", text: "👨‍🔧 Maintenance Trainer Dashboard" },
      });

      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "🛠️ Submit Training Record" },
            style: "primary",
            action_id: "openModal_submit_training",
          },
        ],
      });

      blocks.push(divider);
    }
    //#endregion

    //#region Guest
    if (roles.includes("guest")) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: "_Welcome! Please contact admin to assign your role._" },
      });
    }
    //#endregion

    //#region Calendar Overview
    try {
      // ✅ 使用已获取的 release 数据
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      let weeklyJobs = [];

      ["Daily", "Regular", "Project"].forEach(branch => {
        const branchJobs = release[branch] || {};
        for (const [id, job] of Object.entries(branchJobs)) {
          weeklyJobs.push({
            id,
            description: job.description || "Untitled",
            orderDate: job.orderDate || job.orderdate || job.date,
            startDate: job.startDate || null,
            time: job.orderTime || job.ordertime || "",
            assigned: job.assignedTo || job.assigned_to || "Unassigned",
            machineLocation: job.machineLocation || "N/A",
            status: job.status || "Unknown",
          });
        }
      });

      const filtered = weeklyJobs.filter(j => {
        const jobDateStr = j.startDate || j.orderDate;
        if (!jobDateStr) return false;
        const jobDate = new Date(jobDateStr + "T00:00:00");
        const diff = (jobDate - today) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
      });

      filtered.sort(
        (a, b) =>
          new Date(`${a.orderDate || a.startDate}T${a.time || "00:00"}`) -
          new Date(`${b.orderDate || b.startDate}T${b.time || "00:00"}`)
      );

      const calendarView =
        filtered.length > 0
          ? filtered
              .map(
                j =>
                  `📅 *${j.orderDate || j.startDate} ${j.time || ""}* — ${j.description} _(→ ${j.assigned})_\n📍 ${j.machineLocation} • ${j.status}`
              )
              .join("\n\n")
          : "_No scheduled jobs in the next 7 days._";

      // ✅ 使用已获取的 users 数据
      const teamList = Object.entries(users)
        .map(([uid, u]) => `• *${u.name || uid}* — ${u.roles?.join(", ") || "unknown"}`)
        .join("\n");

      blocks.push({ type: "divider" });
      blocks.push({
        type: "header",
        text: { type: "plain_text", text: "📅 Today's Calendar Overview" },
      });
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `🗓 *Upcoming Jobs (7 Days)*:\n${calendarView}` },
      });
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `👥 *Team Members:*\n${teamList}` },
      });
    } catch (err) {
      console.error("Error building calendar view:", err);
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: "_Unable to load calendar data._" },
      });
    }
    //#endregion

    // Unfinished Job and Finished Job buttons
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "🕓 View Unfinished Job" },
          style: "primary",
          action_id: "openModal_unfinished",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "✅ View finished Job" },
          action_id: "openModal_finished",
        },
      ],
    });

    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: "_Click to view recent 30 tasks in a popup._" }],
    });

    console.log(`🏗️ 构建视图耗时: ${Date.now() - buildStart}ms`);

    // 发布 Home 页面
    const slackStart = Date.now();
    await client.views.publish({
      user_id: userId,
      view: { type: "home", callback_id: "home_view", blocks },
    });
    console.log(`📤 Slack API 耗时: ${Date.now() - slackStart}ms`);

    console.log(`✅ Home view published for ${userId} (${roles.join(", ")})`);
    console.log(`⏱️ 总耗时: ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error("❌ Error publishing Home Tab:", error);
  }
}

module.exports = { displayHome };