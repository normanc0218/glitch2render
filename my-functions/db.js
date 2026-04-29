require('dotenv').config();
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    databaseURL: process.env.DATABASE_URL || "https://maintenance-form-602d9-default-rtdb.firebaseio.com"
  });
}

const db = admin.database();
module.exports = db;