//Dont delete!!! this is for render
// const admin = require('firebase-admin');
// const fs = require('fs');

// // Load Firebase credentials
// let serviceAccount;
// if (fs.existsSync('/etc/secrets/firebase_service.json')) {
//   serviceAccount = require('/etc/secrets/firebase_service.json');
// } else {
//   serviceAccount = require('./firebase_service.json'); // for local dev
// }

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: "https://maintenance-form-602d9-default-rtdb.firebaseio.com"
// });

// const db = admin.database();
// module.exports = db;
const admin = require("firebase-admin");
console.log("DEBUG ENV KEYS:", Object.keys(process.env));
console.log("DEBUG FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID);
console.log("DEBUG FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL);
console.log("DEBUG FIREBASE_DATABASE_URL:", process.env.FIREBASE_DATABASE_URL);
console.log("DEBUG FIREBASE_PRIVATE_KEY type:", typeof process.env.FIREBASE_PRIVATE_KEY);
console.log("DEBUG FIREBASE_PRIVATE_KEY length:", process.env.FIREBASE_PRIVATE_KEY?.length);
// Railway 上直接用环境变量初始化，不需要 JSON 文件
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL, 
  });
}

const db = admin.database();
module.exports = db;
