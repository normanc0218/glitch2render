const admin = require('firebase-admin');
const fs = require('fs');

// Load Firebase credentials
const serviceAccount = require('/etc/secrets/firebase_service.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://maintenance-form-602d9-default-rtdb.firebaseio.com"
});

const db = admin.database();
module.exports = db;
