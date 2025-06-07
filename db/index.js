// db/index.js
const { JsonDB, Config } = require("node-json-db");

// Initialize separate JSON databases for different categories
const JSONdb1 = new JsonDB(new Config("regularJobsDB", true, false, "/"));   // For regular maintenance jobs
const JSONdb2 = new JsonDB(new Config("calendarJobsDB", true, true, "/"));   // For calendar/daily jobs
const JSONdb3 = new JsonDB(new Config("ProjectJobsDB", true, true, "/"));    // For long-term project jobs

// Map each logical type to its corresponding DB instance
const sourceMap = {
  regular: JSONdb1,
  daily: JSONdb2,
  project: JSONdb3,
};

// Retrieve the correct database based on type; fallback to 'regular' if unknown
function getSource(type = "regular") {
  if (!sourceMap[type]) {
    console.warn(`⚠️ Unknown DB type "${type}", fallback to "regular"`);
  }
  return sourceMap[type] || sourceMap.regular;
}

// Export unified API for all DB operations
module.exports = {
  get: async (type, path) => {
    const db = getSource(type);
    console.log(`📥 DB GET [${type}] ${path}`);
    return db.getData(path);
  },

  push: async (type, path, data, override = true) => {
    const db = getSource(type);
    console.log(`📤 DB PUSH [${type}] ${path}`);
    return db.push(path, data, override);
  },

  delete: async (type, path) => {
    const db = getSource(type);
    console.log(`🗑️ DB DELETE [${type}] ${path}`);
    return db.delete(path);
  },

  exists: async (type, path) => {
    const db = getSource(type);
    console.log(`🔍 DB EXISTS? [${type}] ${path}`);
    return db.exists(path);
  }
};
