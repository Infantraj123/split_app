import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
// @ts-ignore - getReactNativePersistence is exported by the react-native build of firebase/auth
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import { initializeFirestore, Firestore } from 'firebase/firestore';
// @ts-ignore
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fill these in with your own Firebase project's web app config
// (Firebase console -> Project settings -> General -> Your apps -> Web app).
export const firebaseConfig = {
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Session persistence via AsyncStorage; falls back to getAuth on hot reload
let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;

// React Native's fetch lacks streaming support, so force long polling
export const db: Firestore = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export default app;
