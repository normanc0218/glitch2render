// modals/index.js
const openModal_accept = require('./openModal_accept');
const openModal_accept_message = require('./openModal_accept_message');
const openModal_assign_dispatch = require('./openModal_assign_dispatch');
const openModal_daily_update = require('./openModal_daily_update');
const openModal_project_update = require('./openModal_project_update');
const openModal_reject = require('./openModal_reject');
const openModal_supervisor_approval = require('./openModal_supervisor_approval');
const openModal_update_progress = require('./openModal_update_progress');
const openModal_view_detail = require('./openModal_view_detail');
const openModal_view_detail_home = require('./openModal_view_detail_home');
const openModal = require('./openModal');
const openModal_create_project = require('./openModal_create_project');
const openModal_manage_schedule = require('./openModal_manage_schedule');
const openModal_modify_schedule = require('./openModal_modify_schedule');
const openModal_add_schedule = require('./openModal_add_schedule');
const openModal_manage_dispatch = require('./openModal_manage_dispatch');
const openModal_view_dispatch = require('./openModal_view_dispatch');
const openModal_dispatch = require('./openModal_dispatch');
const openModal_submit_training = require('./openModal_submit_training');
const openModal_unfinished  = require('./openModal_unfinished');
const { openModal_finished, updateFinishedPage } = require('./openModal_finished');

module.exports = {
  openModal_accept,
  openModal_accept_message,
  openModal_assign_dispatch,
  openModal_daily_update,
  openModal_project_update,
  openModal_reject,
  openModal_supervisor_approval,
  openModal_update_progress,
  openModal_view_detail,
  openModal_view_detail_home,
  openModal_view_dispatch,
  openModal,
  openModal_create_project,
  openModal_manage_schedule,
  openModal_modify_schedule,
  openModal_add_schedule,
  openModal_manage_dispatch,
  openModal_dispatch,
  openModal_submit_training,
  openModal_unfinished,
  openModal_finished,
  updateFinishedPage,
};
