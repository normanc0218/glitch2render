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
const openModal_manage_dispatch = require('./openModal_manage_dispatch');
const openModal_view_dispatch = require('./openModal_view_dispatch');
const openModal_dispatch = require('./openModal_dispatch');
const openModal_submit_training = require('./openModal_submit_training');
const { openModal_unfinished, updateUnfinishedPage } = require('./openModal_unfinished');
const { openModal_finished, updateFinishedPage } = require('./openModal_finished');
const openModal_sql_task_view = require('./openModal_sql_task_view');
const { pushModal_sql_task_view } = require('./openModal_sql_task_view');
const openModal_sql_project_view = require('./openModal_sql_project_view');
const { pushModal_sql_project_view } = require('./openModal_sql_project_view');
const { openJobList, updateJobList } = require('./openModal_jobList');

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
  openModal_manage_dispatch,
  openModal_dispatch,
  openModal_submit_training,
  openModal_unfinished,
  updateUnfinishedPage,
  openModal_finished,
  updateFinishedPage,
  openModal_sql_task_view,
  pushModal_sql_task_view,
  openModal_sql_project_view,
  pushModal_sql_project_view,
  openJobList,
  updateJobList,
};
