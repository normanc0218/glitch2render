// All user data comes from the SlackUsers table in Azure SQL via slackUserService.
// This file exists only for backward compatibility with modules that require('../userConfig').
const svc = require("./services/slackUserService");

module.exports = {
  get maintenanceStaff() { return svc.maintenanceStaff; },
  get Supervisors()      { return svc.Supervisors; },
  get managerUsers()     { return svc.managerUsers; },
  get trainUsers()       { return svc.trainUsers; },
  refreshIfStale:        () => svc.refreshIfStale(),
};
