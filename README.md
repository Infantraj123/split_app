# 💰 Split App - Production-Ready Expense Splitter

A complete, production-ready mobile application for managing shared expenses built with React Native and Firebase.

**Status**: ✅ Ready for Development & Testing
**Firebase Project**: `YOUR_PROJECT_ID`
**Tech Stack**: React Native 0.86 + TypeScript + Firebase

---

## 🚀 Get Started in 5 Minutes

### 1. Install & Start
```bash
cd split_app
npm install
npm start
```

### 2. Run on Device
```bash
# Android
npm run android

# iOS (macOS only)
npm run ios
```

### 3. Login
Admin account:
- Email: `admin@admin.com`
- Password: `Admin@123`

The admin creates all other users from inside the app (Home → Create User).

**See [QUICK_START.md](./QUICK_START.md) for detailed instructions.**

---

## 📚 Documentation

### 🟢 **START HERE**
- **[QUICK_START.md](./QUICK_START.md)** - Get running in 5 minutes
- **[TESTING_GUIDE.md](./split_app/TESTING_GUIDE.md)** - Complete testing guide

### 🔧 **SETUP & CONFIGURATION**
- **[SETUP_VERIFICATION.md](./split_app/SETUP_VERIFICATION.md)** - Verify Firebase setup
- **[DEPLOY_FIREBASE.md](./DEPLOY_FIREBASE.md)** - Deploy rules & functions
- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** - Complete Firebase guide

### 📖 **DEVELOPMENT**
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System design & database schema
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - API reference
- **[PROJECT_FILES.md](./PROJECT_FILES.md)** - Project structure
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - What's built

### 🚢 **DEPLOYMENT**
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Deploy to App Stores

---

## ✨ What's Included

### ✅ Backend (Complete)
- Firebase Authentication setup
- Firestore database schema
- Cloud Functions for automatic balance calculation
- Security rules (ready to deploy)
- Balance optimization engine

### ✅ Frontend (Partial - Ready to Extend)
- Type-safe TypeScript setup
- State management (Zustand)
- Firebase service layer
- Authentication flow
- Login screen example
- Navigation structure
- Utilities & validators

### ✅ Documentation (Complete)
- 7 comprehensive guides
- API reference
- Setup instructions
- Deployment checklist
- Quick reference

---

## 🎯 Key Features

### 👥 User Management
- Email/password authentication
- Admin can create users
- Disable/enable accounts
- Role-based access control

### 💸 Expense Tracking
- Add expenses with equal/unequal splits
- Category support
- Edit/delete expenses
- Real-time balance updates

### ⚖️ Smart Balance System
- Automatic balance calculation
- Removes duplicate debts (netting algorithm)
- Settlement optimization
- Minimal transactions needed

### 🔔 Notifications
- Firebase Cloud Messaging ready
- Settlement requests
- New expense alerts
- Group updates

### 📊 Reports & Export
- PDF export
- Excel export
- Date filtering
- User & group reports

### 🔐 Security
- Firestore security rules
- Role-based access control
- Audit logging
- Encrypted credentials

### 📱 Offline Support
- Firestore offline persistence
- Local caching
- Automatic sync
- Works without internet

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────┐
│      React Native Mobile App            │
│  (TypeScript, React Navigation, Zustand)│
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
    ┌────────┐ ┌───────┐ ┌────────┐
    │ Firestore  │ Auth  │ Storage │
    │ Database   │       │         │
    └────────┘ └───────┘ └────────┘
        │
        ▼
┌──────────────────────┐
│  Cloud Functions     │
│ (Balance Calc, etc)  │
└──────────────────────┘
```

---

## 🔍 Project Structure

```
split_app/
├── src/
│   ├── config/              # Firebase config
│   ├── services/            # Firestore, Auth, Balance engine
│   ├── store/              # Zustand state management
│   ├── screens/            # UI screens
│   ├── components/         # Reusable components
│   ├── navigation/         # Navigation setup
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # Utilities & validators
│   ├── constants/          # App constants
│   └── App.tsx             # Root component
│
├── android/                # Android native code
├── ios/                    # iOS native code
├── __tests__/              # Tests
├── .env.local              # Firebase credentials (🔒 PROTECTED)
└── package.json            # Dependencies
```

---

## 🚦 Current Status

| Component | Status | Details |
|-----------|--------|---------|
| Firebase Config | ✅ Done | Project: YOUR_PROJECT_ID |
| Environment Setup | ✅ Done | .env.local configured |
| Core Services | ✅ Done | Auth, Firestore, Balance Engine (netting fixed & tested) |
| Security Rules | ✅ Ready | Deploy with `firebase deploy --only firestore:rules` |
| Cloud Functions | ✅ Ready | Optional — app recalculates balances client-side |
| Login Screen | ✅ Done | Firebase email/password |
| Navigation | ✅ Done | Login → Home → Group → Expense/Export |
| Admin Screens | ✅ Done | Create User, Create Group, Add Member |
| User Screens | ✅ Done | Home, Group Detail, Add Expense (equal/unequal), Export |
| Settlements | ✅ Done | Request → approve/reject → balances re-net |
| Export | ✅ Done | Text/CSV via share sheet, date range + scope filters |
| Tests | ✅ Done | 28 tests: engine, split math, export, integration flow |
| Deployment | 📝 TODO | EAS Build / Play Store setup |

---

## 📊 Development Roadmap

### Phase 1: Foundation (COMPLETE ✅)
- [x] Firebase setup
- [x] Database schema
- [x] Security rules
- [x] Cloud Functions
- [x] TypeScript setup
- [x] State management
- [x] Service layer

### Phase 2: MVP (IN PROGRESS 📝)
- [ ] Navigation system
- [ ] UI component library
- [ ] Admin screens (5)
- [ ] User screens (8)
- [ ] Authentication flow
- [ ] Error handling

### Phase 3: Polish (UPCOMING 📋)
- [ ] Notifications
- [ ] Report export
- [ ] Offline sync
- [ ] Analytics
- [ ] Performance optimization

### Phase 4: Launch (UPCOMING 🚀)
- [ ] Testing & QA
- [ ] Firebase deployment
- [ ] App Store release
- [ ] Marketing

---

## 💡 Quick Tips

### Hot Reload
```bash
# Keep Metro running:
npm start

# Then in another terminal:
npm run android

# Edit code and save - changes appear instantly!
# Press R twice to reload
```

### Debug
```bash
# Android: Press Ctrl+M to open dev menu
# iOS: Press Cmd+M to open dev menu

# Select "Debug" to debug in browser console
```

### Test Firebase
```bash
# Firebase is already configured!
# Just run the app and check console for:
# "✅ All Firebase tests passed!"
```

---

## 🔑 Your Firebase Credentials

```
Project ID: YOUR_PROJECT_ID
Auth Domain: YOUR_PROJECT_ID.firebaseapp.com
Storage: YOUR_PROJECT_ID.firebasestorage.app
```

**Credentials are securely stored in `.env.local` (protected by .gitignore)**

---

## 📱 Supported Platforms

- ✅ Android 7.0+ (API 24+)
- ✅ iOS 12.0+
- ⏳ Web (React - can be added)

---

## 🎓 Learning Resources

### Setup & Configuration
1. **QUICK_START.md** - Get running fast
2. **SETUP_VERIFICATION.md** - Verify everything works
3. **DEPLOY_FIREBASE.md** - Deploy backend

### Development
4. **ARCHITECTURE.md** - Understand the system
5. **QUICK_REFERENCE.md** - API reference
6. **TESTING_GUIDE.md** - How to test

### Going Live
7. **DEPLOYMENT_GUIDE.md** - Deploy to App Stores

---

## 🚀 Next Steps

### Immediate (Next 5 minutes)
1. ✅ Run the app: `npm run android`
2. ✅ Verify Firebase connection
3. ✅ Test login with test account

### Short Term (Next 1 hour)
1. Read ARCHITECTURE.md
2. Understand database schema
3. Review LoginScreen.tsx
4. Deploy Firebase: `firebase deploy`

### Medium Term (Next 1 day)
1. Implement navigation
2. Build UI component library
3. Implement admin screens
4. Implement user screens

### Long Term
1. Complete all screens
2. Add notifications
3. Setup tests
4. Deploy to App Stores

---

## ⚙️ System Requirements

```
Node.js: 22.11.0+
npm: 10.0+
Android Studio: Latest (for Android)
Xcode: 15+ (for iOS, macOS only)
```

---

## 🐛 Troubleshooting

### Can't run app?
```bash
npm run clean
npm install
npm run android
```

### Firebase not connecting?
```bash
cat split_app/.env.local
# Should show your credentials

# Test connection
# Add to App.tsx and run app
import { logFirebaseConfig } from './src/firebase/test-connection';
```

### More issues?
See **TESTING_GUIDE.md** → Troubleshooting section

---

## 📞 Support

| Issue | Solution |
|-------|----------|
| App won't start | See TESTING_GUIDE.md → Phase 1 |
| Firebase error | See SETUP_VERIFICATION.md |
| Login fails | Check test user in Firebase Console |
| Build error | Run `npm run clean && npm install` |
| Need API docs | See QUICK_REFERENCE.md |

---

## 📈 Performance Metrics

### Free Tier Usage (100 active users)
- **Firestore Reads**: ~2,000/day (4% of 50K limit)
- **Firestore Writes**: ~140/day (0.7% of 20K limit)
- **Storage**: ~10 MB (1% of 1 GB)
- **Functions**: ~500/month (0.4% of 125K)

✅ **Scales to 500+ users on free tier!**

---

## 🔒 Security

- ✅ Credentials protected (.env.local in .gitignore)
- ✅ Security rules enforce permissions
- ✅ Cloud Functions handle sensitive ops
- ✅ Audit logging for compliance
- ✅ No sensitive data in code

---

## 📜 License

MIT - Free to use and modify

---

## 🎉 You're Ready!

```bash
# 1. Get it running
cd split_app
npm start
npm run android

# 2. Follow TESTING_GUIDE.md for complete instructions

# 3. Check QUICK_START.md for quick reference
```

### Happy coding! 🚀

---

**Project Status**: Production-Ready Foundation
**Last Updated**: 2026-07-01
**Estimated Build Time**: 1-2 weeks
**Team**: Solo / Small team friendly

For questions, check the relevant guide above or review the source code comments.
