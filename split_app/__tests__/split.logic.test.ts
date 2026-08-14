import { computeEqualShares } from '../src/services/split.logic';

const A = 'userA';
const B = 'userB';
const C = 'userC';

describe('computeEqualShares', () => {
  test('300 among 3 → 100 each', () => {
    const shares = computeEqualShares(300, [A, B, C], A);
    expect(shares.get(A)).toBe(100);
    expect(shares.get(B)).toBe(100);
    expect(shares.get(C)).toBe(100);
  });

  test('100 among 3 → shares add up exactly, payer absorbs the extra paisa', () => {
    const shares = computeEqualShares(100, [A, B, C], B);
    const total = [A, B, C].reduce((s, id) => s + (shares.get(id) || 0), 0);
    expect(Math.round(total * 100)).toBe(10000); // exactly ₹100.00
    expect(shares.get(B)).toBe(33.34);
    expect(shares.get(A)).toBe(33.33);
    expect(shares.get(C)).toBe(33.33);
  });

  test('payer not in the member list → first member absorbs the remainder', () => {
    const shares = computeEqualShares(100, [A, B, C], 'outsider');
    expect(shares.get(A)).toBe(33.34);
    expect(shares.get(B)).toBe(33.33);
    expect(shares.get(C)).toBe(33.33);
  });

  test('decimal amounts stay paise-exact', () => {
    const shares = computeEqualShares(99.99, [A, B], A);
    const total = (shares.get(A) || 0) + (shares.get(B) || 0);
    expect(Math.round(total * 100)).toBe(9999);
  });

  test('empty members or zero amount → empty map', () => {
    expect(computeEqualShares(100, []).size).toBe(0);
    expect(computeEqualShares(0, [A, B]).size).toBe(0);
  });
});
