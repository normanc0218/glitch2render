const { displayHome } = require("./appHome");

(async () => {
  const testUserId = "U06DSKC32E4"; // Replace with a real user ID
  await displayHome(testUserId);
})();
