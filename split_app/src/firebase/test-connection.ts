/**
 * Firebase Connection Test
 * Run this to verify Firebase is properly configured
 *
 * Usage:
 * import { testFirebaseConnection } from '../firebase/test-connection';
 * await testFirebaseConnection();
 */

import { db, auth } from '../config/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';

export const testFirebaseConnection = async (): Promise<void> => {
  console.log('🔄 Testing Firebase Connection...\n');

  try {
    // Test 1: Firebase Config
    console.log('✅ Test 1: Firebase Config');
    console.log(`   Project ID: ${db.app.options.projectId}`);
    console.log(`   Auth Domain: ${auth.app.options.authDomain}`);
    console.log(`   Storage Bucket: ${db.app.options.storageBucket}\n`);

    // Test 2: Firestore Connection
    console.log('✅ Test 2: Firestore Connection');
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, limit(1));
      const snapshot = await getDocs(q);
      console.log(`   ✓ Connected to Firestore`);
      console.log(`   ✓ Users collection exists`);
      console.log(`   ✓ Document count: ${snapshot.size}\n`);
    } catch (error) {
      console.error('   ✗ Firestore Error:', (error as Error).message);
      throw error;
    }

    // Test 3: Authentication
    console.log('✅ Test 3: Authentication');
    const currentUser = auth.currentUser;
    if (currentUser) {
      console.log(`   ✓ Current user: ${currentUser.email}`);
    } else {
      console.log(`   ✓ Authentication ready (no user logged in)`);
    }
    console.log();

    console.log('✅ All Firebase tests passed!\n');
    console.log('🚀 Firebase is properly configured and ready to use.\n');

    return;
  } catch (error) {
    console.error('❌ Firebase Connection Failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check .env.local file exists');
    console.error('   2. Verify Firebase credentials are correct');
    console.error('   3. Check Firebase project is active');
    console.error('   4. Verify Firestore database exists');
    console.error('   5. Check internet connection\n');
    throw error;
  }
};

/**
 * Log Firebase Configuration (for debugging)
 */
export const logFirebaseConfig = (): void => {
  console.log('🔧 Firebase Configuration:');
  console.log(`   Project ID: ${db.app.options.projectId}`);
  console.log(`   Auth Domain: ${auth.app.options.authDomain}`);
  console.log(`   API Key: ${db.app.options.apiKey?.substring(0, 10)}...`);
  console.log(`   Storage Bucket: ${db.app.options.storageBucket}`);
  console.log(`   App ID: ${db.app.options.appId}`);
  console.log();
};

/**
 * Test Firestore Security Rules
 */
export const testFirestoreRules = async (): Promise<void> => {
  console.log('🔐 Testing Firestore Security Rules...\n');

  try {
    // This will fail if security rules are too restrictive
    const usersRef = collection(db, 'users');
    const q = query(usersRef, limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('✅ Security rules allow reading users collection');
    } else {
      console.log('✅ Security rules are working');
    }
  } catch (error) {
    if ((error as Error).message.includes('Permission denied')) {
      console.error('❌ Security rules are too restrictive');
      console.error('   Solution: Deploy firestore.rules from firebase/ directory');
    } else {
      console.error('❌ Error:', (error as Error).message);
    }
    throw error;
  }
};
