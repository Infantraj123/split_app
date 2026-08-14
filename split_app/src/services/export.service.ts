import { Expense, ExpenseShare } from '../types';
import { formatCurrency, formatDate } from '../utils/formatting';

/**
 * Pure report builder — no Firebase imports so it is fully unit-testable.
 * The Export screen feeds it data from Firestore and shares the result
 * via the OS share sheet (text or CSV).
 */

export interface ReportOptions {
  groupName: string;
  expenses: Expense[];
  sharesByExpense: Map<string, ExpenseShare[]>;
  names: Record<string, string>;
  /** Inclusive range in millis. Omit either side for an open range. */
  startDate?: number;
  endDate?: number;
  /** When set, only expenses this user paid or has a share in ("my expenses"). */
  forUserId?: string;
}

export interface UserTotals {
  userId: string;
  paid: number;
  share: number;
  /** paid - share: positive = others owe this user for this period */
  net: number;
}

export interface GroupReport {
  expenses: Expense[];
  totalAmount: number;
  userTotals: UserTotals[];
  text: string;
  csv: string;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function filterExpensesByDate(expenses: Expense[], startDate?: number, endDate?: number): Expense[] {
  return expenses.filter(
    (e) => (startDate === undefined || e.createdAt >= startDate) && (endDate === undefined || e.createdAt <= endDate)
  );
}

export function buildGroupReport(options: ReportOptions): GroupReport {
  const { groupName, sharesByExpense, names, startDate, endDate, forUserId } = options;
  const nameOf = (id: string) => names[id] || id;

  let expenses = filterExpensesByDate(options.expenses, startDate, endDate);
  if (forUserId) {
    expenses = expenses.filter((e) => {
      if (e.paidByUserId === forUserId) return true;
      const shares = sharesByExpense.get(e.id) || [];
      return shares.some((s) => s.memberId === forUserId && s.shareAmount > 0);
    });
  }
  // Oldest first reads naturally in a report
  expenses = [...expenses].sort((a, b) => a.createdAt - b.createdAt);

  const totalAmount = round2(expenses.reduce((sum, e) => sum + e.amount, 0));

  // Per-user totals across the filtered expenses
  const totalsMap = new Map<string, UserTotals>();
  const totalsFor = (userId: string): UserTotals => {
    let t = totalsMap.get(userId);
    if (!t) {
      t = { userId, paid: 0, share: 0, net: 0 };
      totalsMap.set(userId, t);
    }
    return t;
  };
  for (const expense of expenses) {
    if (!forUserId || expense.paidByUserId === forUserId) {
      totalsFor(expense.paidByUserId).paid += expense.amount;
    }
    for (const share of sharesByExpense.get(expense.id) || []) {
      if (forUserId && share.memberId !== forUserId) continue;
      totalsFor(share.memberId).share += share.shareAmount;
    }
  }

  const userTotals = Array.from(totalsMap.values()).map((t) => ({
    userId: t.userId,
    paid: round2(t.paid),
    share: round2(t.share),
    net: round2(t.paid - t.share),
  }));

  // ---------- Text report ----------
  const rangeLabel =
    startDate !== undefined || endDate !== undefined
      ? `${startDate !== undefined ? formatDate(startDate) : 'Beginning'} → ${
          endDate !== undefined ? formatDate(endDate) : 'Today'
        }`
      : 'All time';
  const scopeLabel = forUserId ? `Expenses of ${nameOf(forUserId)}` : 'All group expenses';

  const lines: string[] = [];
  lines.push(`💰 Expense Report — ${groupName}`);
  lines.push(`Period: ${rangeLabel}`);
  lines.push(`Scope: ${scopeLabel}`);
  lines.push('');

  if (expenses.length === 0) {
    lines.push('No expenses in this period.');
  } else {
    lines.push(`— Expenses (${expenses.length}) —`);
    for (const e of expenses) {
      lines.push(`• ${formatDate(e.createdAt)} · ${e.title}`);
      lines.push(`  Amount: ${formatCurrency(e.amount)} · Paid by ${nameOf(e.paidByUserId)} · ${e.splitType} split`);
      for (const s of sharesByExpense.get(e.id) || []) {
        if (s.shareAmount > 0 && (!forUserId || s.memberId === forUserId)) {
          lines.push(`    - ${nameOf(s.memberId)}: ${formatCurrency(s.shareAmount)}`);
        }
      }
    }
    lines.push('');
    lines.push(`— Summary —`);
    lines.push(`Total spent: ${formatCurrency(totalAmount)}`);
    for (const t of userTotals) {
      lines.push(
        `${nameOf(t.userId)}: paid ${formatCurrency(t.paid)}, share ${formatCurrency(t.share)}, ` +
          (t.net > 0
            ? `gets back ${formatCurrency(t.net)}`
            : t.net < 0
            ? `owes ${formatCurrency(-t.net)}`
            : 'settled')
      );
    }
  }
  const text = lines.join('\n');

  // ---------- CSV ----------
  const esc = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvLines: string[] = [];
  csvLines.push(['Date', 'Title', 'Split Type', 'Amount', 'Paid By', 'Member', 'Member Share'].join(', '));
  for (const e of expenses) {
    const shares = (sharesByExpense.get(e.id) || []).filter(
      (s) => s.shareAmount > 0 && (!forUserId || s.memberId === forUserId)
    );
    if (shares.length === 0) {
      csvLines.push(
        [formatDate(e.createdAt), esc(e.title), e.splitType, e.amount, esc(nameOf(e.paidByUserId)), '', ''].join(', ')
      );
    } else {
      for (const s of shares) {
        csvLines.push(
          [
            formatDate(e.createdAt),
            esc(e.title),
            e.splitType,
            e.amount,
            esc(nameOf(e.paidByUserId)),
            esc(nameOf(s.memberId)),
            s.shareAmount,
          ].join(', ')
        );
      }
    }
  }
  csvLines.push('');
  csvLines.push(['User', 'Total Paid', 'Total Share', 'Net'].join(', '));
  for (const t of userTotals) {
    csvLines.push([esc(nameOf(t.userId)), t.paid, t.share, t.net].join(', '));
  }
  csvLines.push('');
  csvLines.push(['Group Total', totalAmount].join(', '));
  const csv = csvLines.join('\n');

  return { expenses, totalAmount, userTotals, text, csv };
}
