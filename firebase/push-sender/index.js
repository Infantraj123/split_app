/**
 * Standalone FCM push sender for SplitApp — persistent local variant.
 *
 * Same send logic as the (undeployed) `onNotificationCreated` Cloud Function
 * in firebase/functions/src/index.ts, but run as a plain Node process using
 * a service account key instead of being deployed to Firebase — so it needs
 * no Blaze plan / billing account. Must be left running (e.g. under pm2) on
 * a machine that stays on, since it watches Firestore in real time.
 *
 * See send-pending-pushes.js for the one-shot variant used by the
 * GitHub Actions cron job (no machine required to stay on, at the cost of
 * a few minutes' delivery delay instead of real time).
 *
 * Setup: download a service account key (Firebase Console > Project
 * Settings > Service accounts > Generate new private key), save it next to
 * this file as serviceAccountKey.json, then `npm install && npm start`.
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const { sendPushForNotification } = require('./lib');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

db.collection('notifications')
  .where('pushSent', '==', false)
  .onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          sendPushForNotification(db, admin, change.doc);
        }
      });
    },
    (err) => {
      // The Firestore watch stream can wedge itself into a stuck reconnect
      // ("A backoff operation is already in progress") without killing the
      // process, silently stopping delivery while pm2 still reports it as
      // online. Exit and let pm2 restart with a clean connection instead.
      console.error('Firestore listener error, exiting for restart:', err.message);
      process.exit(1);
    }
  );

console.log('SplitApp push sender running — watching for new notifications...');
