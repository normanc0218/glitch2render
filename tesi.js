// testNotify.js
require("dotenv").config(); // Loads your .env variables
const { notifyChannel } = require("./notifyChannel");

notifyChannel("Testing Slack notification from Node.js");
