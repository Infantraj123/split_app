import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  Query,
  DocumentData,
  writeBatch,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  User,
  Group,
  Expense,
  Settlement,
  Balance,
  GroupMember,
  ExpenseShare,
  ExpenseDeleteRequest,
} from '../types';

// Utility function to convert Firebase timestamp to milliseconds
const toTimestamp = (timestamp: any): number => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toMillis();
  }
  return typeof timestamp === 'number' ? timestamp : Date.now();
};

// ============= USER OPERATIONS =============
export const userService = {
  async createUser(user: User): Promise<void> {
    const userRef = doc(db, 'users', user.id);
    await setDoc(userRef, {
      ...user,
      createdAt: Timestamp.now(),
    });
  },

  async getUser(userId: string): Promise<User | null> {
    const userRef = doc(db, 'users', userId);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      return {
        ...data,
        id: snapshot.id,
        createdAt: toTimestamp(data.createdAt),
        updatedAt: data.updatedAt ? toTimestamp(data.updatedAt) : undefined,
      } as User;
    }
    return null;
  },

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      createdAt: toTimestamp(data.createdAt),
      updatedAt: data.updatedAt ? toTimestamp(data.updatedAt) : undefined,
    } as User;
  },

  async listUsers(constraints?: Query<DocumentData>): Promise<User[]> {
    const q = constraints || collection(db, 'users');
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: toTimestamp(data.createdAt),
        updatedAt: data.updatedAt ? toTimestamp(data.updatedAt) : undefined,
      } as User;
    });
  },
};

// ============= GROUP OPERATIONS =============
export const groupService = {
  async createGroup(group: Omit<Group, 'id'>): Promise<string> {
    const groupRef = doc(collection(db, 'groups'));
    await setDoc(groupRef, {
      ...group,
      createdAt: Timestamp.now(),
    });
    return groupRef.id;
  },

  async getGroup(groupId: string): Promise<Group | null> {
    const groupRef = doc(db, 'groups', groupId);
    const snapshot = await getDoc(groupRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      return {
        ...data,
        id: snapshot.id,
        createdAt: toTimestamp(data.createdAt),
        updatedAt: data.updatedAt ? toTimestamp(data.updatedAt) : undefined,
      } as Group;
    }
    return null;
  },

  async updateGroup(groupId: string, updates: Partial<Group>): Promise<void> {
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  },

  async listAllGroups(): Promise<Group[]> {
    const snapshot = await getDocs(collection(db, 'groups'));
    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: toTimestamp(data.createdAt),
          updatedAt: data.updatedAt ? toTimestamp(data.updatedAt) : undefined,
        } as Group;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async listUserGroups(userId: string): Promise<Group[]> {
    // Get group IDs from groupMembers collection
    const q = query(collection(db, 'groupMembers'), where('userId', '==', userId));
    const memberSnapshot = await getDocs(q);

    if (memberSnapshot.empty) return [];

    const groupIds = memberSnapshot.docs.map((doc) => doc.data().groupId);
    const groups: Group[] = [];

    for (const groupId of groupIds) {
      const group = await this.getGroup(groupId);
      if (group) groups.push(group);
    }

    return groups;
  },
};

// ============= GROUP MEMBER OPERATIONS =============
export const groupMemberService = {
  async addMember(groupId: string, userId: string): Promise<string> {
    const memberRef = doc(collection(db, 'groupMembers'));
    await setDoc(memberRef, {
      groupId,
      userId,
      joinedAt: Timestamp.now(),
      role: 'MEMBER',
    });
    return memberRef.id;
  },

  async removeMember(groupId: string, userId: string): Promise<void> {
    const q = query(
      collection(db, 'groupMembers'),
      where('groupId', '==', groupId),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    for (const doc of snapshot.docs) {
      await deleteDoc(doc.ref);
    }
  },

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const q = query(collection(db, 'groupMembers'), where('groupId', '==', groupId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      joinedAt: toTimestamp(doc.data().joinedAt),
    })) as GroupMember[];
  },

  async isGroupMember(groupId: string, userId: string): Promise<boolean> {
    const q = query(
      collection(db, 'groupMembers'),
      where('groupId', '==', groupId),
      where('userId', '==', userId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  },
};

// ============= EXPENSE OPERATIONS =============
export const expenseService = {
  async createExpense(expense: Omit<Expense, 'id'>, shares: Omit<ExpenseShare, 'id'>[]): Promise<string> {
    const batch = writeBatch(db);
    const expenseRef = doc(collection(db, 'expenses'));

    batch.set(expenseRef, {
      ...expense,
      createdAt: Timestamp.now(),
    });

    // Add expense shares
    for (const share of shares) {
      const shareRef = doc(collection(db, 'expenseShares'));
      batch.set(shareRef, {
        ...share,
        expenseId: expenseRef.id,
      });
    }

    await batch.commit();
    return expenseRef.id;
  },

  async getExpense(expenseId: string): Promise<Expense | null> {
    const expenseRef = doc(db, 'expenses', expenseId);
    const snapshot = await getDoc(expenseRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      return {
        ...data,
        id: snapshot.id,
        createdAt: toTimestamp(data.createdAt),
        updatedAt: data.updatedAt ? toTimestamp(data.updatedAt) : undefined,
      } as Expense;
    }
    return null;
  },

  async getGroupExpenses(groupId: string, limitCount = 100): Promise<Expense[]> {
    // No orderBy: equality filter + orderBy needs a composite index; sort client-side
    const q = query(collection(db, 'expenses'), where('groupId', '==', groupId), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: toTimestamp(data.createdAt),
          updatedAt: data.updatedAt ? toTimestamp(data.updatedAt) : undefined,
        } as Expense;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async getExpenseShares(expenseId: string): Promise<ExpenseShare[]> {
    const q = query(collection(db, 'expenseShares'), where('expenseId', '==', expenseId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    })) as ExpenseShare[];
  },

  async deleteExpense(expenseId: string): Promise<void> {
    const batch = writeBatch(db);

    // Delete expense
    batch.delete(doc(db, 'expenses', expenseId));

    // Delete shares
    const shares = await this.getExpenseShares(expenseId);
    for (const share of shares) {
      batch.delete(doc(db, 'expenseShares', share.id));
    }

    await batch.commit();
  },
};

// ============= EXPENSE DELETE REQUEST OPERATIONS =============
export const deleteRequestService = {
  async createDeleteRequest(request: Omit<ExpenseDeleteRequest, 'id'>): Promise<string> {
    const requestRef = doc(collection(db, 'expenseDeleteRequests'));
    await setDoc(requestRef, {
      ...request,
      createdAt: Timestamp.now(),
    });
    return requestRef.id;
  },

  async getGroupDeleteRequests(groupId: string, limitCount = 100): Promise<ExpenseDeleteRequest[]> {
    // No orderBy: equality filter + orderBy needs a composite index; sort client-side
    const q = query(
      collection(db, 'expenseDeleteRequests'),
      where('groupId', '==', groupId),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          approvedBy: data.approvedBy || [],
          createdAt: toTimestamp(data.createdAt),
          resolvedAt: data.resolvedAt ? toTimestamp(data.resolvedAt) : undefined,
        } as ExpenseDeleteRequest;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async addApproval(requestId: string, userId: string): Promise<void> {
    const requestRef = doc(db, 'expenseDeleteRequests', requestId);
    await updateDoc(requestRef, { approvedBy: arrayUnion(userId) });
  },

  async markApproved(requestId: string): Promise<void> {
    const requestRef = doc(db, 'expenseDeleteRequests', requestId);
    await updateDoc(requestRef, {
      status: 'APPROVED',
      resolvedAt: Timestamp.now(),
    });
  },

  async markRejected(requestId: string, rejectedBy: string): Promise<void> {
    const requestRef = doc(db, 'expenseDeleteRequests', requestId);
    await updateDoc(requestRef, {
      status: 'REJECTED',
      rejectedBy,
      resolvedAt: Timestamp.now(),
    });
  },
};

// ============= SETTLEMENT OPERATIONS =============
export const settlementService = {
  async createSettlement(settlement: Omit<Settlement, 'id'>): Promise<string> {
    const settlementRef = doc(collection(db, 'settlements'));
    await setDoc(settlementRef, {
      ...settlement,
      createdAt: Timestamp.now(),
    });
    return settlementRef.id;
  },

  async updateSettlementStatus(
    settlementId: string,
    status: SettlementStatus,
    approvedAt?: number
  ): Promise<void> {
    const settlementRef = doc(db, 'settlements', settlementId);
    const updates: any = { status };
    if (approvedAt) {
      updates.approvedAt = Timestamp.fromMillis(approvedAt);
    }
    await updateDoc(settlementRef, updates);
  },

  async deleteSettlement(settlementId: string): Promise<void> {
    await deleteDoc(doc(db, 'settlements', settlementId));
  },

  async getGroupSettlements(groupId: string, limitCount = 100): Promise<Settlement[]> {
    // No orderBy: equality filter + orderBy needs a composite index; sort client-side
    const q = query(collection(db, 'settlements'), where('groupId', '==', groupId), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: toTimestamp(data.createdAt),
          approvedAt: data.approvedAt ? toTimestamp(data.approvedAt) : undefined,
        } as Settlement;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  async getUserSettlements(groupId: string, userId: string): Promise<Settlement[]> {
    const q = query(
      collection(db, 'settlements'),
      where('groupId', '==', groupId),
      where('toUserId', '==', userId),
      where('status', '==', 'PENDING'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: toTimestamp(data.createdAt),
        approvedAt: data.approvedAt ? toTimestamp(data.approvedAt) : undefined,
      } as Settlement;
    });
  },
};

// ============= BALANCE OPERATIONS =============
export const balanceService = {
  async upsertBalance(balance: Balance): Promise<void> {
    const q = query(
      collection(db, 'balances'),
      where('groupId', '==', balance.groupId),
      where('debtorUserId', '==', balance.debtorUserId),
      where('creditorUserId', '==', balance.creditorUserId),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      const balanceRef = doc(collection(db, 'balances'));
      await setDoc(balanceRef, {
        ...balance,
        updatedAt: Timestamp.now(),
      });
    } else {
      const existing = snapshot.docs[0];
      await updateDoc(existing.ref, {
        amount: balance.amount,
        updatedAt: Timestamp.now(),
      });
    }
  },

  async getGroupBalances(groupId: string): Promise<Balance[]> {
    const q = query(collection(db, 'balances'), where('groupId', '==', groupId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        updatedAt: toTimestamp(data.updatedAt),
      } as Balance;
    });
  },

  async clearBalance(groupId: string, debtorUserId: string, creditorUserId: string): Promise<void> {
    const q = query(
      collection(db, 'balances'),
      where('groupId', '==', groupId),
      where('debtorUserId', '==', debtorUserId),
      where('creditorUserId', '==', creditorUserId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      await updateDoc(snapshot.docs[0].ref, { amount: 0 });
    }
  },
};

export type SettlementStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
