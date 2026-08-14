import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

// ============= EXPENSE TRIGGERS =============

/**
 * Recalculate balances when an expense is added
 * This is optimized for Firebase free tier by batching calculations
 */
export const onExpenseCreated = functions.firestore
  .document('expenses/{expenseId}')
  .onCreate(async (snap, context) => {
    const expense = snap.data();
    const groupId = expense.groupId;

    try {
      await recalculateGroupBalances(groupId);

      // Create audit log
      await createAuditLog({
        action: 'EXPENSE_CREATED',
        groupId,
        userId: expense.createdBy,
        details: { expenseId: context.params.expenseId, amount: expense.amount },
      });
    } catch (error) {
      console.error('Error recalculating balances:', error);
      throw error;
    }
  });

export const onExpenseDeleted = functions.firestore
  .document('expenses/{expenseId}')
  .onDelete(async (snap, context) => {
    const expense = snap.data();
    const groupId = expense.groupId;

    try {
      // Delete related expense shares
      const shares = await db.collection('expenseShares').where('expenseId', '==', context.params.expenseId).get();
      const batch = db.batch();
      shares.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Recalculate balances
      await recalculateGroupBalances(groupId);

      // Create audit log
      await createAuditLog({
        action: 'EXPENSE_DELETED',
        groupId,
        userId: expense.createdBy,
        details: { expenseId: context.params.expenseId },
      });
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  });

// ============= SETTLEMENT TRIGGERS =============

/**
 * Handle settlement approval
 * Updates balances and sends notifications
 */
export const onSettlementApproved = functions.firestore
  .document('settlements/{settlementId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Only trigger if status changed to APPROVED
    if (before.status !== 'PENDING' || after.status !== 'APPROVED') {
      return;
    }

    const settlementId = context.params.settlementId;

    try {
      // Full recalculation keeps balances consistent with the netting engine
      await recalculateGroupBalances(after.groupId);

      // Send notification to payer
      await createNotification({
        userId: after.fromUserId,
        type: 'SETTLEMENT_APPROVAL',
        title: 'Settlement Approved',
        body: `Your settlement of ₹${after.amount} has been approved`,
        data: { settlementId, groupId: after.groupId },
      });

      // Create audit log
      await createAuditLog({
        action: 'SETTLEMENT_APPROVED',
        groupId: after.groupId,
        userId: after.toUserId,
        details: { settlementId, amount: after.amount },
      });
    } catch (error) {
      console.error('Error approving settlement:', error);
      throw error;
    }
  });

// ============= GROUP MEMBER TRIGGERS =============

/**
 * When a user is added to a group, create a notification
 */
export const onGroupMemberAdded = functions.firestore
  .document('groupMembers/{memberId}')
  .onCreate(async (snap, context) => {
    const member = snap.data();
    const group = await db.collection('groups').doc(member.groupId).get();

    if (!group.exists) return;

    try {
      await createNotification({
        userId: member.userId,
        type: 'GROUP_MEMBER',
        title: `Added to Group: ${group.data()!.name}`,
        body: 'You have been added to a new group',
        data: { groupId: member.groupId },
      });

      // Create audit log
      await createAuditLog({
        action: 'MEMBER_ADDED',
        groupId: member.groupId,
        userId: member.userId,
        details: { memberId: context.params.memberId },
      });
    } catch (error) {
      console.error('Error creating notification for group member:', error);
      throw error;
    }
  });

// ============= UTILITY FUNCTIONS =============

/**
 * Recalculate all balances for a group
 * This is the core balance calculation engine
 */
async function recalculateGroupBalances(groupId: string): Promise<void> {
  const batch = db.batch();

  // Get all expenses for the group
  const expensesSnapshot = await db.collection('expenses').where('groupId', '==', groupId).get();
  const expenses = expensesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Get all settlements for the group
  const settlementsSnapshot = await db.collection('settlements').where('groupId', '==', groupId).get();
  const settlements = settlementsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Shares live in the expenseShares collection, one query per expense
  const sharesByExpense = new Map<string, any[]>();
  await Promise.all(
    expenses.map(async (expense: any) => {
      const sharesSnapshot = await db.collection('expenseShares').where('expenseId', '==', expense.id).get();
      sharesByExpense.set(expense.id, sharesSnapshot.docs.map((doc) => doc.data()));
    })
  );

  // Calculate raw balances, then net debts and approved settlements together
  const balances = calculateRawBalances(expenses, sharesByExpense);
  const finalBalances = applySettlements(balances, settlements);

  // Clear existing balances
  const existingBalancesSnapshot = await db.collection('balances').where('groupId', '==', groupId).get();
  existingBalancesSnapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  // Write new balances
  for (const balance of finalBalances) {
    if (balance.amount > 0) {
      const balanceRef = db.collection('balances').doc();
      batch.set(balanceRef, {
        groupId,
        debtorUserId: balance.debtorUserId,
        creditorUserId: balance.creditorUserId,
        amount: balance.amount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  await batch.commit();
}

interface RawBalance {
  debtorUserId: string;
  creditorUserId: string;
  amount: number;
}

// Amounts below half a paisa are treated as zero (float-rounding noise)
const EPSILON = 0.005;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Accumulate raw pairwise debts: each share (other than the payer's own)
 * means the member owes the payer. Netting happens in netBalances().
 * This mirrors src/services/balance.engine.ts in the app.
 */
function calculateRawBalances(expenses: any[], sharesByExpense: Map<string, any[]>): RawBalance[] {
  const totals = new Map<string, RawBalance>();

  for (const expense of expenses) {
    const shares = sharesByExpense.get(expense.id) || [];

    for (const share of shares) {
      if (share.memberId === expense.paidByUserId || !(share.shareAmount > 0)) continue;

      const key = `${share.memberId}→${expense.paidByUserId}`;
      const existing = totals.get(key);
      if (existing) {
        existing.amount += share.shareAmount;
      } else {
        totals.set(key, {
          debtorUserId: share.memberId,
          creditorUserId: expense.paidByUserId,
          amount: share.shareAmount,
        });
      }
    }
  }

  return Array.from(totals.values());
}

/**
 * Net opposite balances so each pair of users has at most one debt.
 * A owes B 100 and B owes A 60 → A owes B 40.
 */
function netBalances(balances: RawBalance[]): RawBalance[] {
  // Signed accumulation on a canonical (sorted) pair key
  const net = new Map<string, number>();

  for (const balance of balances) {
    const [first, second] = [balance.debtorUserId, balance.creditorUserId].sort();
    const sign = balance.debtorUserId === first ? 1 : -1;
    const key = `${first}→${second}`;
    net.set(key, (net.get(key) || 0) + sign * balance.amount);
  }

  const result: RawBalance[] = [];
  for (const [key, amount] of net) {
    const [first, second] = key.split('→');
    if (amount > EPSILON) {
      result.push({ debtorUserId: first, creditorUserId: second, amount: round2(amount) });
    } else if (amount < -EPSILON) {
      result.push({ debtorUserId: second, creditorUserId: first, amount: round2(-amount) });
    }
  }
  return result;
}

/**
 * A payment from X to Y cancels X's debt to Y (an overpayment flips it),
 * so approved settlements are modeled as reverse debts and netted.
 */
function applySettlements(balances: RawBalance[], settlements: any[]): RawBalance[] {
  const payments: RawBalance[] = settlements
    .filter((s) => s.status === 'APPROVED')
    .map((s) => ({
      debtorUserId: s.toUserId,
      creditorUserId: s.fromUserId,
      amount: s.amount,
    }));

  return netBalances([...balances, ...payments]);
}

/**
 * Attribute APPROVED settlements to the specific expense shares they pay
 * off (tagged settlements first, then whole-balance settlements pooled and
 * applied FIFO oldest-expense-first). Mirrors
 * BalanceEngine.allocateSettledShares in src/services/balance.engine.ts —
 * kept in sync even though these functions are not deployed.
 */
function allocateSettledShares(
  expenses: any[],
  sharesByExpense: Map<string, any[]>,
  settlements: any[]
): Map<string, number> {
  interface DebtItem {
    shareId: string;
    debtorUserId: string;
    creditorUserId: string;
    expenseId: string;
    amount: number;
    createdAt: number;
    allocated: number;
  }

  const items: DebtItem[] = [];
  for (const expense of expenses) {
    const paidBy = expense.paidByUserId;
    for (const share of sharesByExpense.get(expense.id) || []) {
      if (share.memberId === paidBy || !(share.shareAmount > 0)) continue;
      items.push({
        shareId: share.id,
        debtorUserId: share.memberId,
        creditorUserId: paidBy,
        expenseId: expense.id,
        amount: share.shareAmount,
        createdAt: expense.createdAt,
        allocated: 0,
      });
    }
  }

  const approved = settlements.filter((s) => s.status === 'APPROVED');

  // Pass 1: settlements tagged to one specific expense/share.
  for (const s of approved) {
    if (!s.expenseId) continue;
    const item = items.find(
      (it) => it.expenseId === s.expenseId && it.debtorUserId === s.fromUserId && it.creditorUserId === s.toUserId
    );
    if (!item) continue;
    const remaining = item.amount - item.allocated;
    item.allocated += Math.min(remaining, s.amount);
  }

  const settleFully = (list: DebtItem[]) => {
    for (const item of list) item.allocated = item.amount;
  };
  // Marks items settled FIFO (oldest first) until exactly `remainder` of
  // this list's total is left unsettled.
  const settleFifoLeavingRemainder = (list: DebtItem[], remainder: number) => {
    const total = list.reduce((sum, it) => sum + (it.amount - it.allocated), 0);
    let toSettle = total - remainder;
    for (const item of list) {
      if (toSettle <= EPSILON) break;
      const remaining = item.amount - item.allocated;
      if (remaining <= EPSILON) continue;
      const applied = Math.min(remaining, toSettle);
      item.allocated += applied;
      toSettle -= applied;
    }
  };
  // Nets whatever is currently open across the two lists and resolves it:
  // the smaller direction is wiped for free, the larger keeps exactly
  // `signedPayment` (positive tips it forward, negative tips it backward)
  // less debt outstanding, applied FIFO oldest-first.
  const netAndResolve = (forward: DebtItem[], backward: DebtItem[], signedPayment: number) => {
    const forwardRemaining = forward.reduce((sum, it) => sum + (it.amount - it.allocated), 0);
    const backwardRemaining = backward.reduce((sum, it) => sum + (it.amount - it.allocated), 0);
    const net = forwardRemaining - backwardRemaining + signedPayment;
    if (net > EPSILON) {
      settleFully(backward);
      settleFifoLeavingRemainder(forward, net);
    } else if (net < -EPSILON) {
      settleFully(forward);
      settleFifoLeavingRemainder(backward, -net);
    } else {
      settleFully(forward);
      settleFully(backward);
    }
  };

  const pairKeys = new Set<string>();
  for (const item of items) {
    const [first, second] = [item.debtorUserId, item.creditorUserId].sort();
    pairKeys.add(`${first}→${second}`);
  }
  for (const pairKey of pairKeys) {
    const [first, second] = pairKey.split('→');
    const forward = items
      .filter((it) => it.debtorUserId === first && it.creditorUserId === second)
      .sort((a, b) => a.createdAt - b.createdAt);
    const backward = items
      .filter((it) => it.debtorUserId === second && it.creditorUserId === first)
      .sort((a, b) => a.createdAt - b.createdAt);

    // Untagged ("whole-balance") settlements for this pair, oldest first.
    // Each one reflects the net balance the app showed at the moment it was
    // requested, so it — and any free cross-direction netting resolved
    // alongside it — may only draw on debts that already existed by that
    // settlement's own createdAt. A pair with no settlements at all still
    // gets pure cross-direction netting (order doesn't matter there — it's
    // just algebra, not payments).
    const untagged = approved
      .filter(
        (s) =>
          !s.expenseId &&
          ((s.fromUserId === first && s.toUserId === second) || (s.fromUserId === second && s.toUserId === first))
      )
      .sort((a: any, b: any) => a.createdAt - b.createdAt);

    if (untagged.length === 0) {
      netAndResolve(forward, backward, 0);
      continue;
    }

    for (const settlement of untagged) {
      const eligibleForward = forward.filter((it) => it.createdAt <= settlement.createdAt);
      const eligibleBackward = backward.filter((it) => it.createdAt <= settlement.createdAt);
      // A forward payment (first pays second) reduces first's debt; a
      // backward payment (second pays first) reduces second's, which shows
      // up here as increasing the signed forward-minus-backward net.
      const signedPayment = settlement.fromUserId === first ? -settlement.amount : settlement.amount;
      netAndResolve(eligibleForward, eligibleBackward, signedPayment);
    }
  }

  const result = new Map<string, number>();
  for (const item of items) {
    result.set(item.shareId, round2(Math.min(item.allocated, item.amount)));
  }
  return result;
}

async function createNotification(data: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: any;
}): Promise<void> {
  await db.collection('notifications').add({
    ...data,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function createAuditLog(data: {
  action: string;
  groupId: string;
  userId: string;
  details?: any;
}): Promise<void> {
  await db.collection('auditLogs').add({
    ...data,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ============= NOTIFICATION CLEANUP =============

/**
 * Auto-delete a notification the moment the client marks it read, so
 * read notifications stop appearing without needing an app update
 * (NotificationsScreen re-fetches from Firestore on each visit).
 *
 * Deploy this one alone (`firebase deploy --only functions:onNotificationRead`):
 * the older triggers above duplicate work the app already does client-side.
 */
export const onNotificationRead = functions.firestore
  .document('notifications/{notificationId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();

    if (!before.isRead && after.isRead) {
      await change.after.ref.delete();
    }
  });

// ============= PUSH NOTIFICATIONS (FCM) =============

/**
 * Send an OS push for every in-app notification doc the clients write.
 * The app stores each device's FCM token on users/{uid}.fcmTokens
 * (see split_app/src/services/push.service.ts).
 *
 * Deploy this one alone (`firebase deploy --only functions:onNotificationCreated`):
 * the older triggers above duplicate work the app already does client-side.
 */
export const onNotificationCreated = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap) => {
    const notification = snap.data();
    try {
      const userDoc = await db.collection('users').doc(notification.userId).get();
      const tokens: string[] = userDoc.data()?.fcmTokens || [];
      if (tokens.length === 0) return;

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

      // Prune tokens FCM says are dead (uninstalled/expired devices)
      const invalidTokens = tokens.filter((_, i) => {
        const code = response.responses[i].error?.code;
        return (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument'
        );
      });
      if (invalidTokens.length > 0) {
        await userDoc.ref.update({
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
        });
      }
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  });
