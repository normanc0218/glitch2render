const { JsonDB, Config } = require('node-json-db');

const db3 = new JsonDB(new Config("ProjectJobsDB", true, true, '/')); // DB filename: calendarJobsDB.json

module.exports = db3;
