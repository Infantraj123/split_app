/**
 * Unit tests for the balance netting engine.
 * Covers the exact product scenarios:
 *   Scenario 1: A pays 300 equal among A,B,C  → B owes A 100, C owes A 100
 *   Scenario 2: B pays 300 unequal (A 150, C 150)
 *     → net result: A owes B 50, C owes A 100, C owes B 150
 */
jest.mock('../src/services/firestore.service', () => ({ balanceService: {} }));

import { BalanceEngine } from '../src/services/balance.engine';
import { Expense, ExpenseShare, Settlement, SettlementStatus, SplitType } from '../src/types';

const A = 'userA';
const B = 'userB';
const C = 'userC';
const GROUP = 'group1';

let expenseCounter = 0;

function makeExpense(
  paidBy: string,
  amount: number,
  shareAmounts: Record<string, number>,
  splitType = SplitType.EQUAL
): { expense: Expense; shares: ExpenseShare[] } {
  const id = `exp${++expenseCounter}`;
  const expense: Expense = {
    id,
    groupId: GROUP,
    title: `Expense ${id}`,
    amount,
    paidByUserId: paidBy,
    splitType,
    createdAt: Date.now(),
    createdBy: paidBy,
  };
  const shares: ExpenseShare[] = Object.entries(shareAmounts).map(([memberId, shareAmount], i) => ({
    id: `${id}_share${i}`,
    expenseId: id,
    memberId,
    shareAmount,
  }));
  return { expense, shares };
}

function finalize(
  items: Array<{ expense: Expense; shares: ExpenseShare[] }>,
  settlements: Settlement[] = []
) {
  const sharesMap = new Map<string, ExpenseShare[]>();
  items.forEach(({ expense, shares }) => sharesMap.set(expense.id, shares));
  return BalanceEngine.finalizeBalances(
    items.map((i) => i.expense),
    sharesMap,
    settlements,
    [A, B, C]
  );
}

function findBalance(balances: ReturnType<typeof finalize>, debtor: string, creditor: string) {
  return balances.find((b) => b.debtorUserId === debtor && b.creditorUserId === creditor);
}

describe('BalanceEngine — product scenarios', () => {
  test('Scenario 1: A pays 300 equal → B and C each owe A 100', () => {
    const e1 = makeExpense(A, 300, { [A]: 100, [B]: 100, [C]: 100 });
    const balances = finalize([e1]);

    expect(balances).toHaveLength(2);
    expect(findBalance(balances, B, A)?.amount).toBe(100);
    expect(findBalance(balances, C, A)?.amount).toBe(100);
  });

  test('Scenario 2: after B pays 300 unequal (A 150, C 150) → A owes B 50, C owes A 100, C owes B 150', () => {
    const e1 = makeExpense(A, 300, { [A]: 100, [B]: 100, [C]: 100 });
    const e2 = makeExpense(B, 300, { [A]: 150, [B]: 0, [C]: 150 }, SplitType.UNEQUAL);
    const balances = finalize([e1, e2]);

    expect(balances).toHaveLength(3);
    // B owed A 100, now A owes B 150 → nets to A owes B 50
    expect(findBalance(balances, A, B)?.amount).toBe(50);
    expect(findBalance(balances, B, A)).toBeUndefined();
    // B owes nothing to anyone
    expect(balances.some((b) => b.debtorUserId === B)).toBe(false);
    // C owes A 100 and B 150
    expect(findBalance(balances, C, A)?.amount).toBe(100);
    expect(findBalance(balances, C, B)?.amount).toBe(150);
  });

  test('Settlement: C settles 100 to A and A approves → C owes A nothing', () => {
    const e1 = makeExpense(A, 300, { [A]: 100, [B]: 100, [C]: 100 });
    const e2 = makeExpense(B, 300, { [A]: 150, [B]: 0, [C]: 150 }, SplitType.UNEQUAL);
    const settlement: Settlement = {
      id: 's1',
      groupId: GROUP,
      fromUserId: C,
      toUserId: A,
      amount: 100,
      status: SettlementStatus.APPROVED,
      createdAt: Date.now(),
    };
    const balances = finalize([e1, e2], [settlement]);

    expect(findBalance(balances, C, A)).toBeUndefined();
    expect(findBalance(balances, A, B)?.amount).toBe(50);
    expect(findBalance(balances, C, B)?.amount).toBe(150);
    expect(balances).toHaveLength(2);
  });

  test('PENDING and REJECTED settlements do not change balances', () => {
    const e1 = makeExpense(A, 300, { [A]: 100, [B]: 100, [C]: 100 });
    const settlements: Settlement[] = [
      {
        id: 's1',
        groupId: GROUP,
        fromUserId: B,
        toUserId: A,
        amount: 100,
        status: SettlementStatus.PENDING,
        createdAt: Date.now(),
      },
      {
        id: 's2',
        groupId: GROUP,
        fromUserId: C,
        toUserId: A,
        amount: 100,
        status: SettlementStatus.REJECTED,
        createdAt: Date.now(),
      },
    ];
    const balances = finalize([e1], settlements);
    expect(findBalance(balances, B, A)?.amount).toBe(100);
    expect(findBalance(balances, C, A)?.amount).toBe(100);
  });

  test('Overpaid settlement flips the debt direction', () => {
    const e1 = makeExpense(A, 200, { [A]: 100, [B]: 100 });
    const settlement: Settlement = {
      id: 's1',
      groupId: GROUP,
      fromUserId: B,
      toUserId: A,
      amount: 150,
      status: SettlementStatus.APPROVED,
      createdAt: Date.now(),
    };
    const balances = finalize([e1], [settlement]);
    expect(findBalance(balances, B, A)).toBeUndefined();
    expect(findBalance(balances, A, B)?.amount).toBe(50);
  });

  test('Exact settlement of every debt clears the group', () => {
    const e1 = makeExpense(A, 300, { [A]: 100, [B]: 100, [C]: 100 });
    const settlements: Settlement[] = [B, C].map((from, i) => ({
      id: `s${i}`,
      groupId: GROUP,
      fromUserId: from,
      toUserId: A,
      amount: 100,
      status: SettlementStatus.APPROVED,
      createdAt: Date.now(),
    }));
    expect(finalize([e1], settlements)).toHaveLength(0);
  });
});

describe('BalanceEngine.netBalances', () => {
  test('nets opposite debts to a single record', () => {
    const result = BalanceEngine.netBalances([
      { debtorUserId: A, creditorUserId: B, amount: 100 },
      { debtorUserId: B, creditorUserId: A, amount: 60 },
    ]);
    expect(result).toEqual([{ debtorUserId: A, creditorUserId: B, amount: 40 }]);
  });

  test('sums duplicate same-direction entries instead of overwriting', () => {
    const result = BalanceEngine.netBalances([
      { debtorUserId: A, creditorUserId: B, amount: 100 },
      { debtorUserId: A, creditorUserId: B, amount: 25 },
    ]);
    expect(result).toEqual([{ debtorUserId: A, creditorUserId: B, amount: 125 }]);
  });

  test('drops fully cancelled debts and float noise', () => {
    const result = BalanceEngine.netBalances([
      { debtorUserId: A, creditorUserId: B, amount: 33.33 },
      { debtorUserId: B, creditorUserId: A, amount: 33.33 },
      { debtorUserId: C, creditorUserId: A, amount: 0.001 },
    ]);
    expect(result).toHaveLength(0);
  });
});

describe('BalanceEngine.allocateSettledShares', () => {
  function sharesMapOf(items: Array<{ expense: Expense; shares: ExpenseShare[] }>) {
    const map = new Map<string, ExpenseShare[]>();
    items.forEach(({ expense, shares }) => map.set(expense.id, shares));
    return map;
  }

  test('whole-balance settlement is allocated FIFO to the oldest unpaid expense first', () => {
    const e1 = makeExpense(A, 100, { [A]: 50, [B]: 50 });
    const e2 = makeExpense(A, 100, { [A]: 50, [B]: 50 });
    e1.expense.createdAt = 1000;
    e2.expense.createdAt = 2000;
    const bShareE1 = e1.shares.find((s) => s.memberId === B)!;
    const bShareE2 = e2.shares.find((s) => s.memberId === B)!;

    const settlement: Settlement = {
      id: 's1',
      groupId: GROUP,
      fromUserId: B,
      toUserId: A,
      amount: 50,
      status: SettlementStatus.APPROVED,
      createdAt: 3000,
    };

    const result = BalanceEngine.allocateSettledShares(
      [e1.expense, e2.expense],
      sharesMapOf([e1, e2]),
      [settlement]
    );
    expect(result.get(bShareE1.id)).toBe(50);
    expect(result.get(bShareE2.id)).toBe(0);
  });

  test('a settlement tagged with expenseId settles that specific expense directly, even if an older one is still unpaid', () => {
    const e1 = makeExpense(A, 100, { [A]: 50, [B]: 50 });
    const e2 = makeExpense(A, 100, { [A]: 50, [B]: 50 });
    e1.expense.createdAt = 1000;
    e2.expense.createdAt = 2000;
    const bShareE1 = e1.shares.find((s) => s.memberId === B)!;
    const bShareE2 = e2.shares.find((s) => s.memberId === B)!;

    const settlement: Settlement = {
      id: 's1',
      groupId: GROUP,
      fromUserId: B,
      toUserId: A,
      amount: 50,
      status: SettlementStatus.APPROVED,
      createdAt: 3000,
      expenseId: e2.expense.id,
    };

    const result = BalanceEngine.allocateSettledShares(
      [e1.expense, e2.expense],
      sharesMapOf([e1, e2]),
      [settlement]
    );
    // e2 was settled directly even though e1 (older) is still unpaid
    expect(result.get(bShareE2.id)).toBe(50);
    expect(result.get(bShareE1.id)).toBe(0);
  });

  test('a payer\'s own share never appears as a debt item', () => {
    const e1 = makeExpense(A, 100, { [A]: 50, [B]: 50 });
    const aShare = e1.shares.find((s) => s.memberId === A)!;
    const bShare = e1.shares.find((s) => s.memberId === B)!;

    const result = BalanceEngine.allocateSettledShares([e1.expense], sharesMapOf([e1]), []);
    expect(result.has(aShare.id)).toBe(false);
    expect(result.get(bShare.id)).toBe(0);
  });

  test('opposite-direction shares between the same pair are cross-netted, matching netBalances()', () => {
    // e1: B paid, A owes B 100. e2: A paid, B owes A 150.
    // netBalances() nets this pair to "B owes A 50" with zero settlements.
    // So e1's share (A's 100 debt) should already read as settled, and e2's
    // share (B's 150 debt) should show only 50 remaining unsettled.
    const e1 = makeExpense(B, 100, { [B]: 0, [A]: 100 });
    const e2 = makeExpense(A, 150, { [A]: 0, [B]: 150 });
    const aShareE1 = e1.shares.find((s) => s.memberId === A)!;
    const bShareE2 = e2.shares.find((s) => s.memberId === B)!;

    const result = BalanceEngine.allocateSettledShares([e1.expense, e2.expense], sharesMapOf([e1, e2]), []);
    expect(result.get(aShareE1.id)).toBe(100);
    expect(result.get(bShareE2.id)).toBe(100);
  });

  test('a whole-balance settlement on top of cross-netted shares fully settles both directions', () => {
    const e1 = makeExpense(B, 100, { [B]: 0, [A]: 100 });
    const e2 = makeExpense(A, 150, { [A]: 0, [B]: 150 });
    e1.expense.createdAt = 1000;
    e2.expense.createdAt = 2000;
    const aShareE1 = e1.shares.find((s) => s.memberId === A)!;
    const bShareE2 = e2.shares.find((s) => s.memberId === B)!;

    const settlement: Settlement = {
      id: 's1',
      groupId: GROUP,
      fromUserId: B,
      toUserId: A,
      amount: 50,
      status: SettlementStatus.APPROVED,
      createdAt: 3000,
    };

    const result = BalanceEngine.allocateSettledShares(
      [e1.expense, e2.expense],
      sharesMapOf([e1, e2]),
      [settlement]
    );
    expect(result.get(aShareE1.id)).toBe(100);
    expect(result.get(bShareE2.id)).toBe(150);
  });

  test('settlements in both directions do not double-count with the raw cross-cancel', () => {
    // e1: B paid, A owes B 100. e2: A paid, B owes A 1000.
    // Raw netting alone: B owes A net 900.
    // Settlements: A pays B 80 (paying down A's 100), B pays A 920 (paying down B's 1000).
    // True remaining per netBalances()/applySettlements(): (100-80) - (1000-920) = 20-80 = -60,
    // i.e. B still owes A 60. Neither direction should read as fully settled.
    const e1 = makeExpense(B, 100, { [B]: 0, [A]: 100 });
    const e2 = makeExpense(A, 1000, { [A]: 0, [B]: 1000 });
    e1.expense.createdAt = 1000;
    e2.expense.createdAt = 2000;
    const aShareE1 = e1.shares.find((s) => s.memberId === A)!;
    const bShareE2 = e2.shares.find((s) => s.memberId === B)!;

    const settlements: Settlement[] = [
      { id: 's1', groupId: GROUP, fromUserId: A, toUserId: B, amount: 80, status: SettlementStatus.APPROVED, createdAt: 3000 },
      { id: 's2', groupId: GROUP, fromUserId: B, toUserId: A, amount: 920, status: SettlementStatus.APPROVED, createdAt: 3001 },
    ];

    const result = BalanceEngine.allocateSettledShares([e1.expense, e2.expense], sharesMapOf([e1, e2]), settlements);
    // A's debt to B nets away entirely (paid off + cancelled by the reverse debt)
    expect(result.get(aShareE1.id)).toBe(100);
    // B's debt to A still has 60 remaining unsettled — must NOT read as fully settled (1000)
    expect(result.get(bShareE2.id)).toBe(940);
  });

  test('a settlement cannot retroactively cover an expense added after it was already requested', () => {
    // A owes B for an old dinner (e1). B settles up in full — at that moment
    // that's the only debt between them. Only afterward does B pay for a
    // brand new grocery run (e2) that A now owes B for. That new debt must
    // NOT be silently wiped out just because the earlier settlement, viewed
    // in aggregate, happens to be "big enough" to cover both.
    const e1 = makeExpense(B, 100, { [B]: 0, [A]: 100 });
    e1.expense.createdAt = 1000;
    const settlement: Settlement = {
      id: 's1',
      groupId: GROUP,
      fromUserId: A,
      toUserId: B,
      amount: 100,
      status: SettlementStatus.APPROVED,
      createdAt: 2000,
    };
    const e2 = makeExpense(B, 40, { [B]: 0, [A]: 40 });
    e2.expense.createdAt = 3000;
    const aShareE1 = e1.shares.find((s) => s.memberId === A)!;
    const aShareE2 = e2.shares.find((s) => s.memberId === A)!;

    const result = BalanceEngine.allocateSettledShares(
      [e1.expense, e2.expense],
      sharesMapOf([e1, e2]),
      [settlement]
    );
    expect(result.get(aShareE1.id)).toBe(100);
    expect(result.get(aShareE2.id)).toBe(0);
  });
});

describe('BalanceEngine.calculateSettlementSuggestions', () => {
  test('suggestions settle every debt with minimal transfers', () => {
    const balances = [
      { debtorUserId: A, creditorUserId: B, amount: 50 },
      { debtorUserId: C, creditorUserId: A, amount: 100 },
      { debtorUserId: C, creditorUserId: B, amount: 150 },
    ];
    const suggestions = BalanceEngine.calculateSettlementSuggestions(balances);

    // Net positions: A = 50 - 100 = -50 (receives), B = -200 (receives), C = +250 (owes)
    const totalOut = suggestions.reduce((s, x) => s + x.amount, 0);
    expect(totalOut).toBe(250);
    expect(suggestions.every((s) => s.from === C)).toBe(true);
    const toB = suggestions.filter((s) => s.to === B).reduce((s, x) => s + x.amount, 0);
    const toA = suggestions.filter((s) => s.to === A).reduce((s, x) => s + x.amount, 0);
    expect(toB).toBe(200);
    expect(toA).toBe(50);
  });
});
