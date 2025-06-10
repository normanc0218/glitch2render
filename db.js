const { JsonDB, Config } = require("node-json-db");
const db = new JsonDB(new Config("jobsDB", true, true, "/"));
module.exports = db;
