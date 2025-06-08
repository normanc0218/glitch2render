// db/index.js
const { JsonDB, Config } = require("node-json-db");

// DB initializations
const JSONdb1 = new JsonDB(new Config("regularJobsDB", true, false, "/"));
const JSONdb2 = new JsonDB(new Config("calendarJobsDB", true, false, "/"));
const JSONdb3 = new JsonDB(new Config("ProjectJobsDB", true, false, "/"));

const sourceMap = {
  regular: JSONdb1,
  daily: JSONdb2,
  project: JSONdb3,
};

function getSource(type = "regular") {
  if (!sourceMap[type]) {
    console.warn(`⚠️ Unknown DB type "${type}", fallback to "regular"`);
  }
  return sourceMap[type] || sourceMap.regular;
}

module.exports = {
  get: (type, path) => {
    const db = getSource(type);
    console.log(`📥 DB GET [${type}] ${path}`);
    try {
      return db.getData(path);
    } catch (e) {
      // If path not found, return empty array (for lists)
      if (e.message && e.message.includes("Can't find dataPath")) {
        return [];
      }
      throw e;
    }
  },

  push: (type, path, data, override = true) => {
    const db = getSource(type);
    console.log(`📤 DB PUSH [${type}] ${path}`);
    db.push(path, data, override);
    return true; // Indicate success explicitly
  },

  delete: (type, path) => {
    const db = getSource(type);
    console.log(`🗑️ DB DELETE [${type}] ${path}`);
    db.delete(path);
    return true;
  },

  exists: (type, path) => {
    const db = getSource(type);
    console.log(`🔍 DB EXISTS? [${type}] ${path}`);
    return db.exists(path);
  }
};
