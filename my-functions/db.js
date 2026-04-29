require('dotenv').config();
const admin = require('firebase-admin');
// const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: process.env.FIREBASE_URL
// });

// const db = admin.database();
// module.exports = db;
// 如果还没初始化，则初始化（本地和部署环境都兼容）
if (!admin.apps.length) {
  admin.initializeApp({
    // 在 Cloud Functions 部署环境中，不需要提供 credential 和 databaseURL
    // 它们会自动从环境中获取
    databaseURL: process.env.DATABASE_URL || "https://maintenance-form-602d9.firebaseio.com"
  });
}

const db = admin.database();

module.exports = db;