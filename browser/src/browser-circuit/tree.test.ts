import { describe, it, expect } from 'vitest';
import { LEAF_COUNT } from './canonical.js';
import { buildMerkleSumTree } from './tree.js';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function salts(seed: number): Uint8Array[] {
  return Array.from({ length: LEAF_COUNT }, (_, i) => {
    const s = new Uint8Array(32);
    s.fill(((i + seed) % 251) + 1);
    return s;
  });
}

describe('N=8 Merkle-sum tree (eligibility commitment)', () => {
  it('sums leaves into private total used by the eligibility gate', () => {
    const balances = Array.from({ length: LEAF_COUNT }, (_, i) => BigInt(i + 1));
    const tree = buildMerkleSumTree(balances, salts(1));
    const expected = balances.reduce((a, b) => a + b, 0n);
    expect(tree.total).toBe(expected);
    expect(tree.root).toHaveLength(32);
  });

  it('changing one leaf changes root commitment (observer sees only root)', () => {
    const a = Array.from({ length: LEAF_COUNT }, () => 10n);
    const b = [...a];
    b[0] = 99n;
    const t1 = buildMerkleSumTree(a, salts(2));
    const t2 = buildMerkleSumTree(b, salts(2));
    expect(toHex(t1.root)).not.toBe(toHex(t2.root));
    expect(t2.total).toBe(t1.total - 10n + 99n);
  });
});
