/* eslint-env jest */
// In-memory AsyncStorage so firebase auth persistence works in tests
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// react-native-share is a native module not present in the Jest environment
jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { open: jest.fn().mockResolvedValue({ success: true }) },
}));

// Gesture handler ships its own jest shim for the native module
require('react-native-gesture-handler/jestSetup');

// @react-native-firebase (FCM) native modules are not present under Jest
jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({})),
}));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn().mockResolvedValue(null),
  deleteToken: jest.fn().mockResolvedValue(undefined),
  onTokenRefresh: jest.fn(() => () => {}),
  setBackgroundMessageHandler: jest.fn(),
}));
