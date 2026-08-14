import { buildGroupReport, filterExpensesByDate } from '../src/services/export.service';
import { Expense, ExpenseShare, SplitType } from '../src/types';

const A = 'userA';
const B = 'userB';
const C = 'userC';
const NAMES = { [A]: 'Alice', [B]: 'Bob', [C]: 'Carol' };

const JULY_1 = new Date('2026-07-01T12:00:00Z').getTime();
const JULY_5 = new Date('2026-07-05T12:00:00Z').getTime();
const JULY_20 = new Date('2026-07-20T12:00:00Z').getTime();

function makeData() {
  const expenses: Expense[] = [
    {
      id: 'e1',
      groupId: 'g1',
      title: 'Dinner',
      amount: 300,
      paidByUserId: A,
      splitType: SplitType.EQUAL,
      createdAt: JULY_1,
      createdBy: A,
      category: 'Food',
    },
    {
      id: 'e2',
      groupId: 'g1',
      title: 'Cab',
      amount: 300,
      paidByUserId: B,
      splitType: SplitType.UNEQUAL,
      createdAt: JULY_5,
      createdBy: B,
    },
    {
      id: 'e3',
      groupId: 'g1',
      title: 'Snacks, "special"',
      amount: 90,
      paidByUserId: C,
      splitType: SplitType.EQUAL,
      createdAt: JULY_20,
      createdBy: C,
    },
  ];
  const sharesByExpense = new Map<string, ExpenseShare[]>([
    [
      'e1',
      [
        { id: 's1', expenseId: 'e1', memberId: A, shareAmount: 100 },
        { id: 's2', expenseId: 'e1', memberId: B, shareAmount: 100 },
        { id: 's3', expenseId: 'e1', memberId: C, shareAmount: 100 },
      ],
    ],
    [
      'e2',
      [
        { id: 's4', expenseId: 'e2', memberId: A, shareAmount: 150 },
        { id: 's5', expenseId: 'e2', memberId: B, shareAmount: 0 },
        { id: 's6', expenseId: 'e2', memberId: C, shareAmount: 150 },
      ],
    ],
    [
      'e3',
      [
        { id: 's7', expenseId: 'e3', memberId: A, shareAmount: 30 },
        { id: 's8', expenseId: 'e3', memberId: B, shareAmount: 30 },
        { id: 's9', expenseId: 'e3', memberId: C, shareAmount: 30 },
      ],
    ],
  ]);
  return { expenses, sharesByExpense };
}

describe('filterExpensesByDate', () => {
  test('inclusive range keeps only matching expenses', () => {
    const { expenses } = makeData();
    const filtered = filterExpensesByDate(expenses, JULY_1, JULY_5);
    expect(filtered.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });

  test('open-ended ranges', () => {
    const { expenses } = makeData();
    expect(filterExpensesByDate(expenses, JULY_5, undefined)).toHaveLength(2);
    expect(filterExpensesByDate(expenses, undefined, JULY_1)).toHaveLength(1);
    expect(filterExpensesByDate(expenses)).toHaveLength(3);
  });
});

describe('buildGroupReport', () => {
  test('group totals and per-user paid/share/net', () => {
    const { expenses, sharesByExpense } = makeData();
    const report = buildGroupReport({ groupName: 'Trip', expenses, sharesByExpense, names: NAMES });

    expect(report.totalAmount).toBe(690);
    const totals = Object.fromEntries(report.userTotals.map((t) => [t.userId, t]));
    expect(totals[A]).toEqual({ userId: A, paid: 300, share: 280, net: 20 });
    expect(totals[B]).toEqual({ userId: B, paid: 300, share: 130, net: 170 });
    expect(totals[C]).toEqual({ userId: C, paid: 90, share: 280, net: -190 });
    // Nets always sum to zero
    const netSum = report.userTotals.reduce((s, t) => s + t.net, 0);
    expect(Math.round(netSum * 100)).toBe(0);
  });

  test('date range limits the report', () => {
    const { expenses, sharesByExpense } = makeData();
    const report = buildGroupReport({
      groupName: 'Trip',
      expenses,
      sharesByExpense,
      names: NAMES,
      startDate: JULY_1,
      endDate: JULY_5,
    });
    expect(report.expenses.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(report.totalAmount).toBe(600);
  });

  test('forUserId keeps only expenses the user paid or shared in', () => {
    const { expenses, sharesByExpense } = makeData();
    // B has zero share in e2 but paid it; B shared in e1 and e3
    const report = buildGroupReport({
      groupName: 'Trip',
      expenses,
      sharesByExpense,
      names: NAMES,
      forUserId: B,
    });
    expect(report.expenses.map((e) => e.id).sort()).toEqual(['e1', 'e2', 'e3']);

    // A user with no involvement gets an empty report
    const empty = buildGroupReport({
      groupName: 'Trip',
      expenses,
      sharesByExpense,
      names: NAMES,
      forUserId: 'stranger',
    });
    expect(empty.expenses).toHaveLength(0);
    expect(empty.totalAmount).toBe(0);
    expect(empty.text).toContain('No expenses in this period.');
  });

  test('text report names people and shows shares', () => {
    const { expenses, sharesByExpense } = makeData();
    const report = buildGroupReport({ groupName: 'Trip', expenses, sharesByExpense, names: NAMES });
    expect(report.text).toContain('Expense Report — Trip');
    expect(report.text).toContain('Dinner');
    expect(report.text).toContain('Paid by Alice');
    expect(report.text).toContain('Total spent');
    // B's zero share in e2 is omitted from the breakdown
    const cabSection = report.text.split('Cab')[1].split('•')[0];
    expect(cabSection).not.toContain('Bob:');
  });

  test('CSV has header, escapes commas/quotes, and ends with the group total', () => {
    const { expenses, sharesByExpense } = makeData();
    const report = buildGroupReport({ groupName: 'Trip', expenses, sharesByExpense, names: NAMES });
    const lines = report.csv.split('\n');
    expect(lines[0]).toBe('Date, Title, Split Type, Amount, Paid By, Member, Member Share');
    expect(report.csv).toContain('"Snacks, ""special"""');
    expect(lines[lines.length - 1]).toBe('Group Total, 690');
  });

  test('forUserId also restricts the share breakdown and totals to just that user', () => {
    const { expenses, sharesByExpense } = makeData();
    const report = buildGroupReport({ groupName: 'Trip', expenses, sharesByExpense, names: NAMES, forUserId: B });
    expect(report.userTotals).toHaveLength(1);
    expect(report.userTotals[0].userId).toBe(B);
    // Other members' shares no longer appear as CSV rows
    expect(report.csv).not.toContain('Alice, 100');
    expect(report.csv).not.toContain('Carol, 100');
  });
});
