/**
 * Pure split-calculation helpers, kept free of Firebase imports so they can
 * be unit-tested and reused by screens, the export builder and tests.
 */

/**
 * Split `totalAmount` equally among `memberIds`, working in paise so the
 * shares always add up to the total exactly. Any leftover paise from the
 * division go to the payer (extra paise on the payer create no debt);
 * if the payer is not in the list, the first member absorbs them.
 *
 * Example: 100 among 3 → 33.33 / 33.33 / 33.34 (payer gets 33.34)
 */
export function computeEqualShares(
  totalAmount: number,
  memberIds: string[],
  payerId?: string
): Map<string, number> {
  const shares = new Map<string, number>();
  if (memberIds.length === 0 || !(totalAmount > 0)) return shares;

  const totalPaise = Math.round(totalAmount * 100);
  const base = Math.floor(totalPaise / memberIds.length);
  let remainder = totalPaise - base * memberIds.length;

  const absorberId = payerId && memberIds.includes(payerId) ? payerId : memberIds[0];

  for (const id of memberIds) {
    let paise = base;
    if (id === absorberId) {
      paise += remainder;
      remainder = 0;
    }
    shares.set(id, paise / 100);
  }

  return shares;
}
