// @ts-ignore
import { PermissionsAndroid, Platform } from 'react-native';
// @ts-ignore
import { getApp } from '@react-native-firebase/app';
// @ts-ignore
import {
  getMessaging,
  getToken,
  deleteToken,
  onTokenRefresh,
} from '@react-native-firebase/messaging';
// @ts-ignore
import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * FCM device-token registration. Tokens are stored on `users/{uid}.fcmTokens`;
 * the Cloud Function `onNotificationCreated` (firebase/functions) reads them to
 * send OS push for every in-app notification doc. Uses the native
 * @react-native-firebase/messaging module, separate from the Firebase JS SDK
 * used for auth/Firestore.
 */

const messaging = () => getMessaging(getApp());

/**
 * Ask for notification permission (Android 13+), fetch the FCM token and
 * attach it to the user profile. Returns an unsubscribe fn for the
 * token-refresh listener. Never throws.
 */
export async function registerPushToken(userId: string): Promise<() => void> {
  try {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    const token = await getToken(messaging());
    if (token) {
      await updateDoc(doc(db, 'users', userId), { fcmTokens: arrayUnion(token) });
    }
    return onTokenRefresh(messaging(), async (newToken: string) => {
      try {
        await updateDoc(doc(db, 'users', userId), { fcmTokens: arrayUnion(newToken) });
      } catch (e) {
        console.warn('Failed to store refreshed FCM token:', (e as Error).message);
      }
    });
  } catch (e) {
    console.warn('Push registration failed:', (e as Error).message);
    return () => {};
  }
}

/** Detach this device's token on logout so a signed-out phone gets no push. */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    const token = await getToken(messaging());
    if (token) {
      await updateDoc(doc(db, 'users', userId), { fcmTokens: arrayRemove(token) });
    }
    await deleteToken(messaging());
  } catch (e) {
    console.warn('Push unregistration failed:', (e as Error).message);
  }
}
