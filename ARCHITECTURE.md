# Split App - Complete Architecture

## Overview

A production-ready, cross-platform mobile expense split application built with React Native, Firebase, and optimized for Firebase Free Tier.

## Tech Stack

### Frontend
- **Framework**: React Native with TypeScript
- **Navigation**: React Navigation (Bottom Tabs + Native Stack)
- **State Management**: Zustand (lightweight, performant)
- **Data Fetching**: React Query / TanStack Query (with offline support)
- **Forms**: React Hook Form (minimal re-renders)
- **UI Components**: React Native built-in + custom components
- **Styling**: StyleSheet with CSS-in-JS

### Backend
- **Authentication**: Firebase Authentication
- **Database**: Cloud Firestore (optimized for free tier)
- **Functions**: Firebase Cloud Functions
- **Storage**: Firebase Cloud Storage (for exports)
- **Messaging**: Firebase Cloud Messaging (FCM)

### Deployment
- **Mobile**: EAS Build & EAS Submit
- **Backend**: Firebase CLI

## Project Structure

```
split_app/
├── src/
│   ├── navigation/          # Navigation setup
│   │   ├── types.ts
│   │   ├── RootNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── AppNavigator.tsx
│   ├── screens/             # Screen components
│   │   ├── auth/
│   │   ├── admin/
│   │   └── user/
│   ├── components/          # Reusable UI components
│   │   ├── common/
│   │   ├── forms/
│   │   └── lists/
│   ├── services/            # Business logic
│   │   ├── firestore.service.ts
│   │   ├── auth.service.ts
│   │   ├── balance.engine.ts
│   │   └── export.service.ts
│   ├── store/               # Zustand stores
│   │   ├── auth.store.ts
│   │   ├── app.store.ts
│   │   └── data.store.ts
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.ts
│   │   └── useGroupData.ts
│   ├── types/               # TypeScript interfaces
│   │   └── index.ts
│   ├── utils/               # Utility functions
│   │   ├── formatting.ts
│   │   └── validation.ts
│   ├── constants/           # App constants
│   │   └── app.ts
│   ├── config/              # Configuration
│   │   └── firebase.ts
│   └── App.tsx
├── android/                 # Android native code
├── ios/                     # iOS native code
├── firebase/                # Firebase backend
│   ├── firestore.rules      # Security rules
│   ├── storage.rules        # Storage rules
│   └── functions/           # Cloud Functions
│       ├── src/index.ts
│       └── package.json
├── __tests__/               # Tests
│   ├── services/
│   ├── utils/
│   └── components/
├── package.json
├── tsconfig.json
└── README.md
```

## Database Schema (Firestore)

### Collections

#### users
```typescript
{
  id: string;               // Firebase UID
  name: string;
  email: string;
  phone?: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'DISABLED';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

#### groups
```typescript
{
  id: string;
  name: string;
  description?: string;
  createdBy: string;        // userId
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}
```

#### groupMembers
```typescript
{
  id: string;
  groupId: string;
  userId: string;
  joinedAt: Timestamp;
  role: 'ADMIN' | 'MEMBER';
}
```

#### expenses
```typescript
{
  id: string;
  groupId: string;
  title: string;
  amount: number;
  paidByUserId: string;
  splitType: 'EQUAL' | 'UNEQUAL';
  createdAt: Timestamp;
  createdBy: string;
  category?: string;
  updatedAt?: Timestamp;
}
```

#### expenseShares
```typescript
{
  id: string;
  expenseId: string;
  memberId: string;
  shareAmount: number;
}
```

#### settlements
```typescript
{
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: Timestamp;
  approvedAt?: Timestamp;
}
```

#### balances
```typescript
{
  id: string;
  groupId: string;
  debtorUserId: string;
  creditorUserId: string;
  amount: number;
  updatedAt: Timestamp;
}
```

#### notifications
```typescript
{
  id: string;
  userId: string;
  type: 'EXPENSE' | 'SETTLEMENT' | 'GROUP_MEMBER' | 'SETTLEMENT_APPROVAL';
  title: string;
  body: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Timestamp;
}
```

#### auditLogs
```typescript
{
  id: string;
  action: string;
  groupId: string;
  userId: string;
  details?: Record<string, any>;
  timestamp: Timestamp;
}
```

## Firebase Free Tier Optimization

### Read/Write Limits
- **Daily Reads**: 50,000 (enough for ~150 active users)
- **Daily Writes**: 20,000 (with efficient batch operations)
- **Daily Deletes**: 20,000

### Optimization Strategies

1. **Batch Operations**
   - Use writeBatch() for multiple writes
   - Reduce from 5 writes to 1 operation

2. **Caching**
   - React Query for client-side caching
   - Zustand for app state
   - Firestore offline persistence

3. **Efficient Queries**
   - Composite indexes on frequently queried fields
   - Pagination with cursor-based approach
   - Field projection (select only needed fields)

4. **Collection Design**
   - Denormalize when beneficial
   - Store aggregates (totalExpenses, memberCount)
   - Clear old data regularly

5. **Cloud Functions**
   - Batch balance recalculations
   - Only trigger on necessary events
   - Use Firestore local writes when possible

### Free Tier Limits
- Firestore Storage: 1 GB
- Cloud Functions: 125,000 invocations/month
- Cloud Storage: 5 GB
- Cloud Messaging: Unlimited

## Security Rules (Firestore)

```javascript
// Users: Admin can manage, users read own profile
// Groups: Group members can read, admins can write
// Expenses: Group members can create/read, payer can update
// Settlements: Only sender/receiver involved can access
// Balances: Cloud Functions only (write protection)
// Notifications: User can read own
```

## Cloud Functions

### Triggers

1. **onExpenseCreated**
   - Recalculate group balances
   - Create audit log
   - Send notifications

2. **onExpenseDeleted**
   - Delete expense shares
   - Recalculate balances
   - Audit log

3. **onSettlementApproved**
   - Update balances
   - Send notifications
   - Audit log

4. **onGroupMemberAdded**
   - Send welcome notification
   - Audit log

### Optimization
- Batch firestore writes
- Cache frequently accessed data
- Monitor function execution time (free tier allows 128MB memory)

## Balance Calculation Engine

### Algorithm

```
1. Calculate raw balances from all expenses
   - For each expense, determine who owes what
   - Track debtor → creditor relationships

2. Net opposite balances
   - If A owes B 100 and B owes A 60
   - Result: A owes B 40 (single record)

3. Apply settlements
   - Reduce balances by approved settlements
   - Remove zero-balance records

4. Final netting pass
   - Remove duplicate opposite debts

5. Persist to Firestore
   - Batch write for efficiency
```

### Free Tier Optimization
- Calculate locally when possible
- Batch all Firestore writes
- Use Cloud Functions for heavy computation
- Cache results for 5-10 minutes

## Export Functionality

### PDF Export
- Use `react-native-pdf-lib` or `pdfkit` (Node.js for Cloud Functions)
- Generate server-side to reduce client load
- Store in Cloud Storage with signed URLs
- Auto-cleanup old exports after 7 days

### Excel Export
- Use `xlsx` library
- Generate client-side for small datasets
- Server-side for large reports
- Stream to user with proper MIME type

## Screens & Navigation

### Authentication Flow
```
Login → Dashboard (based on role)
```

### Admin Flow
```
Dashboard
├── Users
│   ├── List Users
│   ├── Create User
│   └── Edit User
├── Groups
│   ├── List Groups
│   ├── Create Group
│   └── Group Members
└── Settings
```

### User Flow
```
My Groups
├── Group Dashboard
│   ├── Expenses List
│   ├── Add Expense
│   ├── Balances
│   ├── Settlements
│   └── Reports
└── Profile
```

## State Management Pattern

### Zustand Stores
- `useAuthStore`: Current user, auth state
- `useUIStore`: Dark mode, loading states
- `useGroupStore`: Current group, expenses, balances
- `useNotificationStore`: In-app notifications

### React Query
- Caching API responses
- Background updates
- Pagination
- Offline support

## Error Handling

### Error Boundaries
- Wrap screens with error boundary
- Show fallback UI with retry option
- Log errors to Firestore

### Validation
- Form validation (react-hook-form)
- Business logic validation
- API response validation

## Testing Strategy

### Unit Tests
- Utility functions
- Validation functions
- Balance engine logic
- Formatters

### Integration Tests
- User authentication flow
- Expense creation + balance calculation
- Settlement approval flow
- Export functionality

### E2E Tests
- Complete user journey
- Admin workflows
- Error scenarios

## Performance Optimization

### App Startup
- Code splitting
- Lazy loading screens
- Async chunk loading
- Service worker caching

### Runtime
- Memoization for components
- Virtualized lists for large datasets
- Debounced search
- Optimistic updates

### Network
- Compression of responses
- Batch API calls
- Request caching
- Offline queue

## Deployment

### Firebase Setup
```bash
npm install -g firebase-tools
firebase init
firebase deploy
```

### Android
```bash
npm run android
# or via EAS Build for production
```

### iOS
```bash
npm run ios
# or via EAS Build for production
```

## Monitoring

### Key Metrics
- Firestore read/write quotas
- Cloud Function execution time
- Error rates
- User engagement

### Tools
- Firebase Console
- Google Cloud Console
- Sentry (error tracking)
- Mixpanel/Segment (analytics)

## Future Enhancements

1. **Advanced Settlement Optimization**
   - Graph-based algorithm for minimal transactions
   - Consider payment fees and preferences

2. **Recurring Expenses**
   - Automate bill splitting
   - Subscription management

3. **Multiple Currencies**
   - Currency conversion
   - Exchange rates

4. **Social Features**
   - Group chat
   - Activity feed
   - Leaderboards

5. **Analytics Dashboard**
   - Spending patterns
   - User insights
   - Group statistics

## References

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Native Documentation](https://reactnative.dev)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Firebase Free Tier Limits](https://firebase.google.com/pricing)
