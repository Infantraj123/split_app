/**
 * Integration test of the full expense → balance → settlement → export flow.
 *
 * The Firestore layer is replaced with an in-memory store; everything above
 * it (split calculation, recalcGroupBalances, BalanceEngine, report builder)
 * is the real production code.
 */
import { Expense, ExpenseShare, Settlement, SettlementStatus, SplitType, GroupMember } from '../src/types';

// ---------- In-memory "Firestore" ----------
const mockData: {
  expenses: Expense[];
  shares: ExpenseShare[];
  settlements: Settlement[];
  members: GroupMember[];
  balances: any[];
} = { expenses: [], shares: [], settlements: [], members: [], balances: [] };

let mockIdCounter = 0;

jest.mock('../src/config/firebase', () => ({ db: {} }));

jest.mock('firebase/firestore', () => ({
  collection: (_db: any, name: string) => ({ __coll: name }),
  doc: (a: any, b?: string, c?: string) =>
    a && a.__coll ? { id: `gen_${++mockIdCounter}`, coll: a.__coll } : { id: c, coll: b },
  writeBatch: () => {
    const ops: Array<{ type: 'set' | 'delete' | 'update'; ref: any; data?: any }> = [];
    return {
      set: (ref: any, data: any) => ops.push({ type: 'set', ref, data }),
      update: (ref: any, data: any) => ops.push({ type: 'update', ref, data }),
      delete: (ref: any) => ops.push({ type: 'delete', ref }),
      commit: async () => {
        for (const op of ops) {
          if (op.type === 'delete') {
            const idx = mockData.balances.findIndex((b) => b.id === op.ref.id);
            if (idx >= 0) mockData.balances.splice(idx, 1);
          } else if (op.type === 'update') {
            const share = mockData.shares.find((s) => s.id === op.ref.id);
            if (share) Object.assign(share, op.data);
          } else {
            mockData.balances.push({ id: op.ref.id, ...op.data });
          }
        }
      },
    };
  },
  Timestamp: { now: () => ({ toMillis: () => Date.now() }) },
}));

jest.mock('../src/services/firestore.service', () => ({
  expenseService: {
    getGroupExpenses: async (groupId: string) => mockData.expenses.filter((e) => e.groupId === groupId),
    getExpenseShares: async (expenseId: string) => mockData.shares.filter((s) => s.expenseId === expenseId),
  },
  settlementService: {
    getGroupSettlements: async (groupId: string) => mockData.settlements.filter((s) => s.groupId === groupId),
  },
  groupMemberService: {
    getGroupMembers: async (groupId: string) => mockData.members.filter((m) => m.groupId === groupId),
  },
  balanceService: {
    getGroupBalances: async (groupId: string) => mockData.balances.filter((b) => b.groupId === groupId),
  },
}));

import { recalcGroupBalances } from '../src/services/balance.sync';
import { computeEqualShares } from '../src/services/split.logic';
import { buildGroupReport } from '../src/services/export.service';

const A = 'userA';
const B = 'userB';
const C = 'userC';
const D = 'userD';
const GROUP = 'g1';
const NAMES = { [A]: 'Alice', [B]: 'Bob', [C]: 'Carol' };

function addMember(userId: string) {
  mockData.members.push({ id: `m_${userId}`, groupId: GROUP, userId, joinedAt: Date.now() });
}

/** Mirrors what AddExpenseScreen writes to Firestore. */
function addExpense(paidBy: string, amount: number, splitType: SplitType, customShares?: Record<string, number>) {
  const id = `exp_${++mockIdCounter}`;
  mockData.expenses.push({
    id,
    groupId: GROUP,
    title: `Expense ${id}`,
    amount,
    paidByUserId: paidBy,
    splitType,
    createdAt: Date.now(),
    createdBy: paidBy,
  });
  const memberIds = mockData.members.map((m) => m.userId);
  const shares =
    splitType === SplitType.EQUAL ? Object.fromEntries(computeEqualShares(amount, memberIds, paidBy)) : customShares!;
  for (const [memberId, shareAmount] of Object.entries(shares)) {
    mockData.shares.push({ id: `sh_${++mockIdCounter}`, expenseId: id, memberId, shareAmount });
  }
  return id;
}

function balanceOf(debtor: string, creditor: string): number | undefined {
  return mockData.balances.find((b) => b.debtorUserId === debtor && b.creditorUserId === creditor)?.amount;
}

describe('End-to-end flow: expenses → balances → settlement → export', () => {
  beforeAll(() => {
    [A, B, C].forEach(addMember);
  });

  test('Scenario 1: A adds ₹300 equal split → B and C each owe A ₹100', async () => {
    addExpense(A, 300, SplitType.EQUAL);
    await recalcGroupBalances(GROUP);

    expect(mockData.balances).toHaveLength(2);
    expect(balanceOf(B, A)).toBe(100);
    expect(balanceOf(C, A)).toBe(100);
  });

  test('Scenario 2: B adds ₹300 unequal (A 150, B 0, C 150) → netted group balances', async () => {
    addExpense(B, 300, SplitType.UNEQUAL, { [A]: 150, [B]: 0, [C]: 150 });
    await recalcGroupBalances(GROUP);

    expect(mockData.balances).toHaveLength(3);
    expect(balanceOf(A, B)).toBe(50); // 150 owed minus the 100 B already owed A
    expect(balanceOf(B, A)).toBeUndefined();
    expect(balanceOf(C, A)).toBe(100);
    expect(balanceOf(C, B)).toBe(150);
  });

  test('Settlement: C pays A ₹100, A approves → C↔A cleared, others unchanged', async () => {
    // Pending settlement changes nothing
    const settlement: Settlement = {
      id: 'set_1',
      groupId: GROUP,
      fromUserId: C,
      toUserId: A,
      amount: 100,
      status: SettlementStatus.PENDING,
      createdAt: Date.now(),
    };
    mockData.settlements.push(settlement);
    await recalcGroupBalances(GROUP);
    expect(balanceOf(C, A)).toBe(100);

    // A approves → debt disappears
    settlement.status = SettlementStatus.APPROVED;
    settlement.approvedAt = Date.now();
    await recalcGroupBalances(GROUP);

    expect(mockData.balances).toHaveLength(2);
    expect(balanceOf(C, A)).toBeUndefined();
    expect(balanceOf(A, B)).toBe(50);
    expect(balanceOf(C, B)).toBe(150);
  });

  test('Export: report over the same data shows correct totals', async () => {
    const sharesByExpense = new Map<string, ExpenseShare[]>();
    for (const e of mockData.expenses) {
      sharesByExpense.set(
        e.id,
        mockData.shares.filter((s) => s.expenseId === e.id)
      );
    }
    const report = buildGroupReport({
      groupName: 'Test Group',
      expenses: mockData.expenses,
      sharesByExpense,
      names: NAMES,
    });

    expect(report.totalAmount).toBe(600);
    const totals = Object.fromEntries(report.userTotals.map((t) => [t.userId, t]));
    expect(totals[A]).toEqual({ userId: A, paid: 300, share: 250, net: 50 });
    expect(totals[B]).toEqual({ userId: B, paid: 300, share: 100, net: 200 });
    expect(totals[C]).toEqual({ userId: C, paid: 0, share: 250, net: -250 });
    expect(report.csv).toContain('Group Total, 600');
  });

  test('Rounding: ₹100 equal among 3 creates no phantom paise debts', async () => {
    addExpense(C, 100, SplitType.EQUAL);
    await recalcGroupBalances(GROUP);

    // C paid: A and B each owe C 33.33 → nets against existing debts
    // Before: A→B 50, C→B 150
    // New: A→C 33.33, B→C 33.33
    expect(balanceOf(A, B)).toBe(50);
    expect(balanceOf(C, B)).toBe(116.67); // 150 - 33.33
    expect(balanceOf(A, C)).toBe(33.33);
    // Sum of all debts is consistent (no drift)
    const total = mockData.balances.reduce((s, b) => s + b.amount, 0);
    expect(Math.round(total * 100)).toBe(20000); // 50 + 116.67 + 33.33
  });

  describe('Per-split settlement tracking', () => {
    beforeAll(() => addMember(D));

    test('a whole-balance settlement is allocated FIFO to the oldest expense first', async () => {
      const id1 = addExpense(A, 100, SplitType.UNEQUAL, { [D]: 100 });
      const id2 = addExpense(A, 100, SplitType.UNEQUAL, { [D]: 100 });
      mockData.expenses.find((e) => e.id === id1)!.createdAt = 1000;
      mockData.expenses.find((e) => e.id === id2)!.createdAt = 2000;
      await recalcGroupBalances(GROUP);
      expect(balanceOf(D, A)).toBe(200);

      mockData.settlements.push({
        id: 'set_d1',
        groupId: GROUP,
        fromUserId: D,
        toUserId: A,
        amount: 100,
        status: SettlementStatus.APPROVED,
        createdAt: 3000,
        approvedAt: 3000,
      });
      await recalcGroupBalances(GROUP);

      expect(balanceOf(D, A)).toBe(100);
      const share1 = mockData.shares.find((s) => s.expenseId === id1 && s.memberId === D)!;
      const share2 = mockData.shares.find((s) => s.expenseId === id2 && s.memberId === D)!;
      expect(share1.settledAmount).toBe(100);
      expect(share2.settledAmount || 0).toBe(0);
    });

    test('a settlement tagged with expenseId settles that expense directly, even with an older unpaid one', async () => {
      const id2 = mockData.expenses.find((e) => e.paidByUserId === A && e.createdAt === 2000)!.id;
      const id3 = addExpense(A, 100, SplitType.UNEQUAL, { [D]: 100 });
      mockData.settlements.push({
        id: 'set_d2',
        groupId: GROUP,
        fromUserId: D,
        toUserId: A,
        amount: 100,
        status: SettlementStatus.APPROVED,
        createdAt: 4000,
        approvedAt: 4000,
        expenseId: id3,
      });
      await recalcGroupBalances(GROUP);

      const share2 = mockData.shares.find((s) => s.expenseId === id2 && s.memberId === D)!;
      const share3 = mockData.shares.find((s) => s.expenseId === id3 && s.memberId === D)!;
      expect(share3.settledAmount).toBe(100); // settled directly via the tagged settlement
      expect(share2.settledAmount || 0).toBe(0); // still unsettled and untouched, despite being older
      expect(balanceOf(D, A)).toBe(100); // only the older expense's 100 remains outstanding
    });
  });
});
