const { JsonDB, Config } = require('node-json-db');

const db2 = new JsonDB(new Config("calendarJobsDB", true, true, '/')); // DB filename: calendarJobsDB.json

module.exports = db2;
