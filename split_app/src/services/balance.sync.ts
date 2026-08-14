// @ts-ignore
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';
// @ts-ignore
import { db } from '../config/firebase';
import { expenseService, settlementService, groupMemberService, balanceService } from './firestore.service';
import { BalanceEngine } from './balance.engine';
import { ExpenseShare } from '../types';

/**
 * Recalculate and persist all balances for a group.
 * Runs client-side because the Cloud Function triggers are not deployed.
 * Call after creating/deleting an expense or approving a settlement.
 */
export async function recalcGroupBalances(groupId: string): Promise<void> {
  const [expenses, settlements, members] = await Promise.all([
    expenseService.getGroupExpenses(groupId, 500),
    settlementService.getGroupSettlements(groupId, 500),
    groupMemberService.getGroupMembers(groupId),
  ]);

  const sharesMap = new Map<string, ExpenseShare[]>();
  await Promise.all(
    expenses.map(async (expense) => {
      sharesMap.set(expense.id, await expenseService.getExpenseShares(expense.id));
    })
  );

  const finalBalances = BalanceEngine.finalizeBalances(
    expenses,
    sharesMap,
    settlements,
    members.map((m) => m.userId)
  );

  // Replace existing balance docs atomically. This is the correctness-critical
  // write and must stay its own batch — Firestore caps a batch at 500 writes,
  // and a group's expense/share count is unbounded, so nothing else can share
  // this batch without risking the whole commit (including this rewrite)
  // failing once history grows large enough.
  const existing = await balanceService.getGroupBalances(groupId);
  const balanceBatch = writeBatch(db);
  for (const bal of existing) {
    balanceBatch.delete(doc(db, 'balances', bal.id));
  }
  for (const bal of finalBalances) {
    const ref = doc(collection(db, 'balances'));
    balanceBatch.set(ref, {
      groupId,
      debtorUserId: bal.debtorUserId,
      creditorUserId: bal.creditorUserId,
      amount: Math.round(bal.amount * 100) / 100,
      updatedAt: Timestamp.now(),
    });
  }
  await balanceBatch.commit();

  // Persist per-share "settled" status separately, chunked to stay under the
  // 500-write batch cap. Best-effort — a failure here must never block or
  // roll back the balance rewrite above, since that's the one users depend on.
  try {
    const settledMap = BalanceEngine.allocateSettledShares(expenses, sharesMap, settlements);
    const updates: Array<{ id: string; settledAmount: number }> = [];
    for (const shares of sharesMap.values()) {
      for (const share of shares) {
        const settledAmount = settledMap.get(share.id) || 0;
        if (settledAmount !== (share.settledAmount || 0)) {
          updates.push({ id: share.id, settledAmount });
        }
      }
    }
    const CHUNK_SIZE = 450;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      const shareBatch = writeBatch(db);
      for (const u of chunk) {
        shareBatch.update(doc(db, 'expenseShares', u.id), { settledAmount: u.settledAmount });
      }
      await shareBatch.commit();
    }
  } catch (e) {
    console.error('Failed to persist per-share settled status (balances above are still correct):', e);
  }
}
