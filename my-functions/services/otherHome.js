const { WebClient } = require("@slack/web-api");
const { getRelease, getUpcomingTasks, getSlackUserRow } = require("./homeQueries");
const { DIV, greetingHeader, browseButtonBlocks, calendarBlocks } = require("./homeBlocks");

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function buildOtherHome(userId, roles, startTime) {
  const dbStart = Date.now();
  const [release, upcomingTasks, slackUserRow] = await Promise.all([
    getRelease(),
    getUpcomingTasks(),
    getSlackUserRow(userId),
  ]);
  console.log(`📊 DB queries: ${Date.now() - dbStart}ms`);

  const buildStart = Date.now();
  const blocks = [
    greetingHeader(slackUserRow),
    DIV,
  ];

  if (roles.includes("trainer")) {
    blocks.push({ type: "header", text: { type: "plain_text", text: "👨‍🔧 Maintenance Trainer Dashboard" } });
    blocks.push({ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "🛠️ Submit Training Record" }, style: "primary", action_id: "openModal_submit_training" }] });
    blocks.push(DIV);
  }

  if (!roles.includes("guest")) {
    blocks.push(...browseButtonBlocks());
  } else {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "_Welcome! Please contact admin to assign your role._" } });
  }

  blocks.push(...calendarBlocks(release, upcomingTasks));

  console.log(`🏗️ View built: ${Date.now() - buildStart}ms`);
  await client.views.publish({ user_id: userId, view: { type: "home", callback_id: "home_view", blocks } });
  console.log(`✅ Home published for ${userId} | Total: ${Date.now() - startTime}ms`);
}

module.exports = { buildOtherHome };
