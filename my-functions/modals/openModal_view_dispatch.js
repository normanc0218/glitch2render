// modals/openModal_view_dispatch.js
const axios = require("axios");
const qs = require("qs");
const { getDispatchCache, fmtDate, PAGE_SIZE, RECENT_MONTHS } = require("../services/dispatchService");

function projectStatusEmoji(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("checked")) return "✅";
  if (s.includes("completed")) return "🟡";
  return "🏗️";
}

/** One-line summary of a dispatch's current JobReviews status. */
function reviewStatusLine(review) {
  if (!review) return "🆕 Not yet reviewed";
  if (review.decision === "promoted") {
    if (!review.promoted_project_id) return "🧹 Clear";
    const proj = review.project_title ? `*${review.project_title}*` : `Project ${review.promoted_project_id.slice(0, 8)}`;
    const statusTxt = review.project_status ? `${projectStatusEmoji(review.project_status)} ${review.project_status}` : "(project not found)";
    return `🧹 Clear → ${proj} — ${statusTxt}`;
  }
  if (review.decision === "dismissed") {
    return `🚫 Dismissed${review.reason ? `: ${review.reason}` : ""}`;
  }
  if (review.decision === "deferred") {
    return `⏸ Deferred until ${fmtDate(review.deferred_until) || "N/A"}${review.reason ? ` — ${review.reason}` : ""}`;
  }
  return "🆕 Not yet reviewed";
}

/**
 * 📦 Build the "View Dispatch" modal for one page.
 * Recent (last RECENT_MONTHS) jobs come first, then older ones once the
 * recent page(s) are exhausted — a divider marks where "older" begins.
 * Shows every dispatch with its current JobReviews status; nothing is
 * filtered out.
 */
function buildDispatchListView(cache, page) {
  const list = [...cache.recent, ...cache.older];
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  // A delete can shrink the list out from under an already-open page (e.g.
  // deleting the last item on the last page) — clamp instead of showing a
  // page that no longer exists.
  page = Math.min(Math.max(0, page), totalPages - 1);
  const pageItems = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const recentCount = cache.recent.length;

  const blocks = [];

  if (list.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "_No Dispatch Jobs found._" },
    });
  } else {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*📦 Dispatch Job List* — ${list.length} job${list.length !== 1 ? "s" : ""}  •  Page ${page + 1}/${totalPages}` },
    });
    blocks.push({ type: "divider" });

    pageItems.forEach((job, i) => {
      const idx = page * PAGE_SIZE + i;
      if (idx === recentCount && recentCount > 0 && cache.older.length > 0) {
        blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `— _older than ${RECENT_MONTHS} months_ —` }] });
      }

      const emoji =
        job.status?.toLowerCase().includes("complete") ||
        job.status?.toLowerCase().includes("approved")
          ? "✅"
          : "🕓";

      // Cleared dispatches link on to the Project they became; everything
      // else still opens the raw dispatch job detail.
      const detailAccessory = (job.review?.decision === "promoted" && job.review.promoted_project_id)
        ? {
            type: "button",
            text: { type: "plain_text", text: "View Project" },
            style: "primary",
            value: job.review.promoted_project_id,
            action_id: "view_sql_project_detail",
          }
        : {
            type: "button",
            text: { type: "plain_text", text: "View Detail" },
            style: "primary",
            value: job.id,
            action_id: "openModal_viewDetail",
          };

      const sectionBlock = {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *${job.description || "Untitled Job"}*\n📍 ${
            job.equipmentName || "N/A"
          }\n🧑 ${job.assignedTo || "Unassigned"} • 🗓 ${
            job.dispatchDatetime?.slice(0, 10) || "N/A"
          }\n⚙️ Dispatch status: ${job.status || "Pending"}\n${reviewStatusLine(job.review)}`,
        },
        accessory: detailAccessory,
      };
      blocks.push(sectionBlock);

      // Once an admin has acted on a dispatch (cleared/dismissed/deferred),
      // deleting the RTDB record could orphan that review — only offer
      // Delete on dispatches nobody has touched yet.
      if (!job.review) {
        blocks.push({
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Delete" },
              style: "danger",
              value: job.id,
              action_id: "delete_dispatch",
              confirm: {
                title: { type: "plain_text", text: "Confirm delete" },
                text: { type: "mrkdwn", text: "Are you sure you want to delete this dispatch?" },
                confirm: { type: "plain_text", text: "Yes, delete" },
                deny: { type: "plain_text", text: "Cancel" },
              },
            },
          ],
        });
      }

      blocks.push({ type: "divider" });
    });

    const navElements = [];
    if (page > 0) {
      navElements.push({
        type: "button",
        text: { type: "plain_text", text: "◀ Prev" },
        action_id: "view_dispatch_page",
        value: String(page - 1),
      });
    }
    if (page < totalPages - 1) {
      navElements.push({
        type: "button",
        text: { type: "plain_text", text: "Load More ▶" },
        action_id: "view_dispatch_page",
        value: String(page + 1),
      });
    }
    if (navElements.length > 0) blocks.push({ type: "actions", elements: navElements });
  }

  return {
    type: "modal",
    callback_id: "viewDispatch",
    title: { type: "plain_text", text: "📦 View Dispatch Jobs" },
    close: { type: "plain_text", text: "Close" },
    private_metadata: String(page),
    blocks,
  };
}

/**
 * 📦 打开 View Dispatch Modal — opens a loading placeholder immediately
 * (Slack needs a response within 3s of trigger_id), then fills it in once
 * the (cached, fetch-on-open) dispatch list is ready.
 */
const openModal_view_dispatch = async (trigger_id) => {
  try {
    const loadingResult = await axios.post(
      "https://slack.com/api/views.open",
      qs.stringify({
        token: process.env.SLACK_BOT_TOKEN,
        trigger_id,
        view: JSON.stringify({
          type: "modal",
          callback_id: "viewDispatch",
          title: { type: "plain_text", text: "📦 View Dispatch Jobs" },
          close: { type: "plain_text", text: "Close" },
          blocks: [{ type: "section", text: { type: "mrkdwn", text: "⏳ Loading dispatch jobs..." } }],
        }),
      })
    );

    const view_id = loadingResult.data.view?.id;
    if (!view_id) {
      console.error("❌ View Dispatch: no view_id from loading modal", loadingResult.data);
      return;
    }

    const cache = await getDispatchCache();
    const result = await axios.post(
      "https://slack.com/api/views.update",
      qs.stringify({
        token: process.env.SLACK_BOT_TOKEN,
        view_id,
        view: JSON.stringify(buildDispatchListView(cache, 0)),
      })
    );
    if (!result.data.ok) console.error("❌ Slack API Error:", result.data);
    else console.log("✅ View Dispatch modal opened successfully");
  } catch (err) {
    console.error("❌ Failed to open View Dispatch modal:", err);
  }
};

/** Load More / Prev — pages through the already-cached list, no re-fetch. */
async function updateDispatchPage(view_id, page) {
  try {
    const cache = await getDispatchCache();
    await axios.post(
      "https://slack.com/api/views.update",
      qs.stringify({
        token: process.env.SLACK_BOT_TOKEN,
        view_id,
        view: JSON.stringify(buildDispatchListView(cache, page)),
      })
    );
  } catch (err) {
    console.error("❌ Failed to update View Dispatch page:", err);
  }
}

module.exports = { openModal_view_dispatch, updateDispatchPage };
