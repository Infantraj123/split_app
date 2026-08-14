import { Expense, ExpenseShare, Settlement, SettlementStatus } from '../types';
import { balanceService } from './firestore.service';

interface RawBalance {
  debtorUserId: string;
  creditorUserId: string;
  amount: number;
}

interface UserBalance {
  userId: string;
  balance: number; // positive = owed, negative = receives
}

// Amounts below half a paisa are treated as zero (float-rounding noise)
const EPSILON = 0.005;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Settlement Optimization Engine for Firebase Free Tier
 *
 * All methods are pure so they can be unit-tested and run either on the
 * client or inside a Cloud Function. Netting keeps at most one debt per
 * pair of users:
 *   A owes B 100, then A pays for B 150  →  B owes A 50
 */
export class BalanceEngine {
  /**
   * Accumulate raw pairwise debts from expenses.
   * Each share (other than the payer's own) means: share.memberId owes the payer.
   * No netting happens here — netBalances() handles that.
   */
  static calculateRawBalances(
    expenses: Expense[],
    shares: Map<string, ExpenseShare[]>,
    _members: string[]
  ): RawBalance[] {
    const totals = new Map<string, RawBalance>();

    for (const expense of expenses) {
      const expenseShares = shares.get(expense.id) || [];
      const paidBy = expense.paidByUserId;

      for (const share of expenseShares) {
        if (share.memberId === paidBy || share.shareAmount <= 0) continue;

        const key = `${share.memberId}→${paidBy}`;
        const existing = totals.get(key);
        if (existing) {
          existing.amount += share.shareAmount;
        } else {
          totals.set(key, {
            debtorUserId: share.memberId,
            creditorUserId: paidBy,
            amount: share.shareAmount,
          });
        }
      }
    }

    return Array.from(totals.values());
  }

  /**
   * Net opposite balances so each pair of users has at most one debt.
   * Example: A owes B 100 and B owes A 60  →  A owes B 40
   * Duplicate same-direction entries are summed, not overwritten.
   */
  static netBalances(balances: RawBalance[]): RawBalance[] {
    // Signed accumulation on a canonical (sorted) pair key:
    // positive = first user owes second, negative = the reverse.
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
   * Apply approved settlements to balances.
   * A payment from X to Y cancels X's debt to Y; an overpayment flips the
   * debt (Y then owes X the difference), so it is modeled as a reverse debt
   * and netted.
   */
  static applySettlements(balances: RawBalance[], settlements: Settlement[]): RawBalance[] {
    const payments: RawBalance[] = settlements
      .filter((s) => s.status === SettlementStatus.APPROVED)
      .map((s) => ({
        debtorUserId: s.toUserId,
        creditorUserId: s.fromUserId,
        amount: s.amount,
      }));

    return this.netBalances([...balances, ...payments]);
  }

  /**
   * Calculate final optimized balances for a group.
   * This is the main entry point for balance calculation.
   */
  static finalizeBalances(
    expenses: Expense[],
    expenseShares: Map<string, ExpenseShare[]>,
    settlements: Settlement[],
    members: string[]
  ): RawBalance[] {
    const raw = this.calculateRawBalances(expenses, expenseShares, members);
    return this.applySettlements(raw, settlements);
  }

  /**
   * Calculate settlement suggestions (min number of transactions to settle all debts)
   * Uses a greedy approach optimized for Firebase free tier
   */
  static calculateSettlementSuggestions(balances: RawBalance[]): Array<{ from: string; to: string; amount: number }> {
    const suggestions: Array<{ from: string; to: string; amount: number }> = [];
    const userBalances = new Map<string, number>();

    // Positive = owes money, Negative = owed money
    for (const balance of balances) {
      userBalances.set(balance.debtorUserId, (userBalances.get(balance.debtorUserId) || 0) + balance.amount);
      userBalances.set(balance.creditorUserId, (userBalances.get(balance.creditorUserId) || 0) - balance.amount);
    }

    const debtors = Array.from(userBalances.entries())
      .filter(([, balance]) => balance > EPSILON)
      .sort((a, b) => b[1] - a[1]);

    const creditors = Array.from(userBalances.entries())
      .filter(([, balance]) => balance < -EPSILON)
      .sort((a, b) => a[1] - b[1]);

    let debtorIdx = 0;
    let creditorIdx = 0;

    while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
      const [debtorId, debtorAmount] = debtors[debtorIdx];
      const [creditorId, creditorAmount] = creditors[creditorIdx];

      const settlementAmount = Math.min(debtorAmount, -creditorAmount);

      suggestions.push({
        from: debtorId,
        to: creditorId,
        amount: round2(settlementAmount),
      });

      debtors[debtorIdx][1] -= settlementAmount;
      creditors[creditorIdx][1] += settlementAmount;

      if (debtors[debtorIdx][1] <= EPSILON) debtorIdx++;
      if (creditors[creditorIdx][1] >= -EPSILON) creditorIdx++;
    }

    return suggestions;
  }

  /**
   * Attribute APPROVED settlements to the specific expense shares they pay
   * off, so callers can show "this expense is settled" instead of only a
   * netted pair balance. Purely additive — does not affect finalizeBalances.
   *
   * Settlements tagged with `expenseId` (single-split settle) are applied
   * directly to that share first, regardless of timing.
   *
   * Untagged ("whole-balance") settlements are then applied per pair, in
   * chronological order. Each one reflects the net balance the app showed
   * at the moment it was requested, so it — and any free cross-direction
   * netting resolved alongside it — may only draw on debts that already
   * existed by that settlement's own createdAt. An expense added later
   * (even if it's approved before that new expense is), or added after the
   * only settlement between that pair, is left fully unsettled: nothing can
   * retroactively pay off a debt that didn't exist yet when the money moved.
   * A pair with no settlements at all still gets pure cross-direction
   * netting (order doesn't matter there — it's just algebra, not payments).
   */
  static allocateSettledShares(
    expenses: Expense[],
    shares: Map<string, ExpenseShare[]>,
    settlements: Settlement[]
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
      for (const share of shares.get(expense.id) || []) {
        if (share.memberId === paidBy || share.shareAmount <= 0) continue;
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

    const approved = settlements.filter((s) => s.status === SettlementStatus.APPROVED);

    // Pass 1: settlements tagged to one specific expense/share.
    for (const s of approved) {
      if (!s.expenseId) continue;
      const item = items.find(
        (it) =>
          it.expenseId === s.expenseId && it.debtorUserId === s.fromUserId && it.creditorUserId === s.toUserId
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

      const untagged = approved
        .filter(
          (s) =>
            !s.expenseId &&
            ((s.fromUserId === first && s.toUserId === second) || (s.fromUserId === second && s.toUserId === first))
        )
        .sort((a, b) => a.createdAt - b.createdAt);

      if (untagged.length === 0) {
        netAndResolve(forward, backward, 0);
        continue;
      }

      for (const settlement of untagged) {
        const eligibleForward = forward.filter((it) => it.createdAt <= settlement.createdAt);
        const eligibleBackward = backward.filter((it) => it.createdAt <= settlement.createdAt);
        // A forward payment (first pays second) reduces first's debt; a
        // backward payment (second pays first) reduces second's, which
        // shows up here as increasing the signed forward-minus-backward net.
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

  /**
   * Persist optimized balances to Firestore.
   * Note: the app's live path is recalcGroupBalances() in balance.sync.ts,
   * which replaces docs in a single batch; this helper remains for callers
   * that update one group incrementally.
   */
  static async persistBalances(groupId: string, balances: RawBalance[]): Promise<void> {
    const existingBalances = await balanceService.getGroupBalances(groupId);

    for (const existing of existingBalances) {
      await balanceService.clearBalance(groupId, existing.debtorUserId, existing.creditorUserId);
    }

    for (const balance of balances) {
      await balanceService.upsertBalance({
        id: `${groupId}_${balance.debtorUserId}_${balance.creditorUserId}`,
        groupId,
        debtorUserId: balance.debtorUserId,
        creditorUserId: balance.creditorUserId,
        amount: round2(balance.amount),
        updatedAt: Date.now(),
      });
    }
  }
}

/** Given a share possibly carrying settledAmount, is it fully paid off? */
export function isShareSettled(share: ExpenseShare): boolean {
  return (share.settledAmount || 0) >= share.shareAmount - EPSILON;
}

export { EPSILON };
export type { RawBalance, UserBalance };
