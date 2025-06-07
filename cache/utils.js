// cache/utils.js
const cache = require("./cache");
const db = require("../db");

// Generate a unique cache key using type + path
function makeKey(type, path) {
  return `${type}:${path}`;
}

async function getCachedData(type = "regular", path = "/data/", fallbackFn) {
  const key = makeKey(type, path);

  if (cache.has(key)) {
    console.log("⚡ cache hit:", key);
    return cache.get(key);
  }

  let data;
  if (fallbackFn && typeof fallbackFn === "function") {
    data = await fallbackFn();
  } else {
    data = await db.get(type, path);
  }

  cache.set(key, data);
  return data;
}

// Push data to DB and invalidate the corresponding cache entry
async function pushAndInvalidate(type, path, data, override = true) {
  const result = db.push(type, path, data, override); // now sync
  cache.delete(makeKey(type, path));
  return result; // if needed for confirmation
}


module.exports = {
  getCachedData,
  pushAndInvalidate,
};
