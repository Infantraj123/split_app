/**
 * Shared FCM send logic, used by both index.js (persistent local listener)
 * and send-pending-pushes.js (one-shot script for the GitHub Actions cron).
 */
async function sendPushForNotification(db, admin, doc) {
  const notification = doc.data();
  try {
    const userRef = db.collection('users').doc(notification.userId);
    const userDoc = await userRef.get();
    const tokens = userDoc.data()?.fcmTokens || [];

    if (tokens.length > 0) {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: String(notification.type || ''),
          groupId: String(notification.data?.groupId || ''),
          groupName: String(notification.data?.groupName || ''),
        },
        android: { priority: 'high' },
      });

      const invalidTokens = tokens.filter((_, i) => {
        const code = response.responses[i].error?.code;
        return (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument'
        );
      });
      if (invalidTokens.length > 0) {
        await userRef.update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
        });
      }
    }

    await doc.ref.update({ pushSent: true });
    console.log(`[${new Date().toISOString()}] Pushed "${notification.title}" to ${notification.userId} (${tokens.length} device(s))`);
  } catch (e) {
    console.error(`Failed to push notification ${doc.id}:`, e.message);
  }
}

module.exports = { sendPushForNotification };
