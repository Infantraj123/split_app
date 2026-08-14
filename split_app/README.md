# Split App - React Native

A production-ready, cross-platform mobile expense split application built with React Native and Firebase.

## Features

✅ **User Authentication**
- Email/Password login
- Admin creates users
- Disabled account support

✅ **Group Management**
- Create and manage groups
- Add/remove members
- Admin controls

✅ **Expense Tracking**
- Add expenses with equal/unequal splits
- Category support
- Edit/delete expenses

✅ **Balance Calculation**
- Automatic balance computation
- Netting algorithm (removes duplicate debts)
- Real-time updates

✅ **Settlement System**
- Create settlement requests
- Approve/reject settlements
- Settlement history

✅ **Reporting**
- User expense reports
- Group reports
- Export to PDF/Excel

✅ **Notifications**
- Firebase Cloud Messaging
- Real-time updates
- In-app notifications

✅ **Offline Support**
- Firestore offline persistence
- Local caching
- Background sync

## Tech Stack

- **Frontend**: React Native 0.86 + TypeScript
- **Navigation**: React Navigation 7
- **State**: Zustand + React Query
- **Backend**: Firebase (Auth, Firestore, Functions, Storage, Messaging)
- **Forms**: React Hook Form
- **Testing**: Jest + React Native Testing Library

## Quick Start

### Prerequisites

```bash
Node.js 22.11.0+
npm or yarn
Android Studio (for Android) or Xcode (for iOS)
```

### Installation

1. **Install dependencies**
```bash
npm install
```

2. **Configure Firebase**

Follow [FIREBASE_SETUP.md](../FIREBASE_SETUP.md) to:
- Create Firebase project
- Get Firebase credentials
- Configure src/config/firebase.ts

3. **Run on Android**
```bash
npm run android
```

4. **Run on iOS**
```bash
npm run ios
```

## Project Structure

```
split_app/
├── src/
│   ├── navigation/          # Navigation & routing
│   ├── screens/             # Screen components (auth, admin, user)
│   ├── components/          # Reusable UI components
│   ├── services/            # Firebase & business logic
│   ├── store/               # Zustand state management
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript interfaces
│   ├── utils/               # Helper functions
│   ├── constants/           # App constants
│   ├── config/              # Firebase config
│   └── App.tsx              # Root component
├── android/                 # Android native code
├── ios/                     # iOS native code
├── __tests__/               # Tests
└── package.json
```

## Getting Started

### Start Metro (dev server)
```bash
npm start
```

### Run on Android (new terminal)
```bash
npm run android
```

### Run on iOS (new terminal)
```bash
npm run ios
```

### Hot Reload
- **Android**: Press R twice
- **iOS**: Press R

### Reload/Reset
- **Android**: Press Ctrl+M (Windows) or Cmd+M (Mac)
- **iOS**: Press Cmd+Ctrl+Z

## Architecture

For complete architecture details, see [../ARCHITECTURE.md](../ARCHITECTURE.md).

### Key Concepts

**Balance Calculation**
- Calculates debts from expenses
- Nets opposite debts (removes redundancy)
- Applies settlements
- Minimizes transactions needed

**Free Tier Optimization**
- Batch Firestore writes
- Client-side caching
- Pagination for large lists
- Cloud Functions for heavy lifting

## Development

### Adding a Screen

1. Create in `src/screens/<feature>/`
2. Add type to `src/navigation/types.ts`
3. Import in navigator

### Adding a Service

1. Create in `src/services/`
2. Use Firestore service layer
3. Add type safety

### State Management

- **Auth**: `useAuthStore()`
- **UI**: `useUIStore()`
- **Data**: React Query hooks

## Testing

```bash
npm run test
```

Tests are in `__tests__/` directory.

## Build & Deploy

### Android Production
```bash
eas build --platform android --auto-submit
```

### iOS Production
```bash
eas build --platform ios --auto-submit
```

### Firebase Deploy
```bash
firebase deploy --only firestore:rules,functions
```

See [FIREBASE_SETUP.md](../FIREBASE_SETUP.md) for details.

## Common Tasks

### Add User (Admin)
1. Login as admin
2. Go to Users
3. Click Add User
4. Fill form (email, name, phone)
5. System sends credentials

### Create Expense
1. Open group
2. Click Add Expense
3. Enter details
4. Select split type
5. Choose members & shares
6. Submit

### Settle Dues
1. Open group
2. Click Settlements
3. Click Settle next to balance
4. Enter amount
5. Receiver approves

### Export Report
1. Open group
2. Click Export
3. Choose format (PDF/Excel)
4. Select date range
5. Download

## Troubleshooting

### App crashes on start
- Check Firebase config in `src/config/firebase.ts`
- Verify internet connection
- Check console logs: `adb logcat | grep ReactNative`

### Firestore permission denied
- Check security rules in Firebase Console
- Verify user is authenticated
- Check user is in the group

### Build errors
- Clean: `npm run clean` or `./gradlew clean`
- Rebuild: `npm run android`
- Check Node version: `node -v` (should be 22.11.0+)

### Notifications not working
- Enable FCM in Firebase Console
- Check device has internet
- Verify app has notification permission

## References

- [Firebase Setup](../FIREBASE_SETUP.md)
- [Complete Architecture](../ARCHITECTURE.md)
- [React Native Docs](https://reactnative.dev)
- [Firebase Docs](https://firebase.google.com/docs)

## License

MIT
