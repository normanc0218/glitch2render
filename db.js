const admin = require('firebase-admin');
const fs = require('fs');

// Load Firebase credentials
let serviceAccount;
if (fs.existsSync('/etc/secrets/firebase_service.json')) {
  serviceAccount = require('/etc/secrets/firebase_service.json');
} else {
  serviceAccount = require('./firebase_service.json'); // for local dev
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://maintenance-form-602d9-default-rtdb.firebaseio.com"
});

const db = admin.database();
module.exports = db;
