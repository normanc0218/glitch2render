// modals/index.js
const handleNewJobForm = require('./handleNewJobForm');
const handleNewProjectForm = require('./handleNewProjectForm');
const handleNewScheduleForm = require('./handleNewScheduleForm');
const handleModifyScheduleForm = require('./handleModifyScheduleForm');
const handleNewDispatchForm = require('./handleNewDispatchForm');
const handleAssignDispatchForm= require('./handleAssignDispatchForm');
const handleUpdateProgress= require('./handleUpdateProgress');
const handlePlanAcceptForm= require('./handlePlanAcceptForm');
const handleRejectForm= require('./handleRejectForm');
const handleReview= require('./handleReview');
const handleNewTrainRecord= require('./handleNewTrainRecord');
module.exports = {
  handleNewJobForm,
  handleNewProjectForm,
  handleNewScheduleForm,
  handleModifyScheduleForm,
  handleNewDispatchForm,
  handleAssignDispatchForm,
  handleUpdateProgress,
  handlePlanAcceptForm,
  handleRejectForm,
  handleReview,
  handleNewTrainRecord
};
