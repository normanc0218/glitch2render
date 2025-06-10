// // cache/utils.js
// const cache = require("./cache");
// const db = require("../db");

// // Generate a unique cache key using type + path
// function makeKey(type, path) {
//   return `${type}:${path}`;
// }

// async function getCachedData(type = "regular", path = "/data", fallbackFn) {
//   const key = makeKey(type, path);

//   // Try cache first
//   if (cache.has(key)) {
//     console.log("⚡ cache hit:", key);
//     return cache.get(key);
//   }

//   // Try DB next
//   try {
//     const data = await db.get(type, path);
//     cache.set(key, data);
//     return data;
//   } catch (error) {
//     console.warn(`⚠️ DB fetch failed for ${type} ${path}:`, error.message);

//     // Only call fallback if DB also fails
//     if (fallbackFn && typeof fallbackFn === "function") {
//       console.log("↪️ Falling back to fallbackFn...");
//       const fallbackData = await fallbackFn();
//       cache.set(key, fallbackData);
//       return fallbackData;
//     } else {
//       throw new Error(`No fallback available for cache miss: ${key}`);
//     }
//   }
// }


// // Push data to DB and invalidate the corresponding cache entry
// async function pushAndInvalidate(type, path, data, override = true) {
//   const result = db.push(type, path, data, override); // now sync
//   cache.delete(makeKey(type, path));
//   return result; // if needed for confirmation
// }


// module.exports = {
//   getCachedData,
//   pushAndInvalidate,
// };
