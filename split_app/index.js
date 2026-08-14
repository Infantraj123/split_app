/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// FCM messages carry a `notification` payload, so Android displays them
// automatically when the app is backgrounded/killed; the handler just has
// to exist so messaging doesn't warn.
setBackgroundMessageHandler(getMessaging(getApp()), async () => {});

AppRegistry.registerComponent(appName, () => App);
