/**
 * One-shot FCM push sender, run on a schedule by
 * .github/workflows/send-pending-pushes.yml instead of staying resident.
 * Queries for any notification docs not yet pushed, sends them, exits.
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const { sendPushForNotification } = require('./lib');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

(async () => {
  const snapshot = await db.collection('notifications').where('pushSent', '==', false).get();
  if (snapshot.empty) {
    console.log('No pending notifications.');
    return;
  }
  for (const doc of snapshot.docs) {
    await sendPushForNotification(db, admin, doc);
  }
})()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Fatal error:', e.message);
    process.exit(1);
  });
