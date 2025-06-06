const JSONdb1 = require("./db");
const JSONdb2 = require("./db2");
const JSONdb3 = require("./db3");

const sourceMap = {
  regular: JSONdb1,
  daily: JSONdb2,
  project: JSONdb3,
};

function getSource(type = "regular") {
  return sourceMap[type] || sourceMap.regular;
}

module.exports = {
  get: async (type, path) => {
    const db = getSource(type);
    return db.getData(path);
  },
  push: async (type, path, data, override = true) => {
    const db = getSource(type);
    return db.push(path, data, override);
  },
  delete: async (type, path) => {
    const db = getSource(type);
    return db.delete(path);
  }
};
