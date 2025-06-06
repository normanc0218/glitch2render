// Core modals
const { openModal_accept } = require("./openModal_accept.js");
const { openModal_reject } = require("./openModal_reject.js");
const { openModal_update_progress } = require("./openModal_update_progress.js");
const { openModal_view_detail } = require("./openModal_view_detail.js");
const { openModal_supervisor_approval } = require("./openModal_supervisor_approval.js");

// Daily modals
const { openModal_daily_job } = require("./openModal_daily_job.js");
const { openModal_daily_update } = require("./openModal_daily_update.js");

// Project & PM modals
const { openModal_projects } = require("./openModal_projects.js");
const { openModal_project_update } = require("./openModal_project_update.js");

// General approval modal
const { openModal_general_approval } = require("./openModal_general_approval.js");

// Build the modal router object
const modalRouter = {
  open_accept_job: openModal_accept,
  open_reject_job: openModal_reject,
  open_update_progress: openModal_update_progress,
  open_view_detail: openModal_view_detail,
  open_supervisor_approval: openModal_supervisor_approval,
  open_daily_job: openModal_daily_job,
  open_daily_update: openModal_daily_update,
  open_projects: openModal_projects,
  open_project_update: openModal_project_update,
  open_general_approval: openModal_general_approval,
};

module.exports = modalRouter;
