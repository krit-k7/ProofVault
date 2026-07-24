import { describe, it, expect } from 'vitest';
import customers from './data/customers.json' assert { type: 'json' };
import { runProveSolvency, runProveSolvencySequence } from '../src/simulator.js';
import { buildMerkleSumTree } from '../src/tree.js';
import { loadLiabilities, toPaddedBalances } from '../src/liabilities.js';
import type { WitnessInputs } from '../src/witnesses.js';

const SK = new Uint8Array(32).fill(7);
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const saltsFrom = (seed: number) =>
  Array.from({ length: 64 }, (_, i) => new Uint8Array(32).fill(((i + seed) % 251) + 1));
const SALTS = saltsFrom(0);

const balances = toPaddedBalances(loadLiabilities(customers));
const tree = buildMerkleSumTree(balances, SALTS);

function inputs(bals: bigint[], salts: Uint8Array[]): WitnessInputs {
  const t = buildMerkleSumTree(bals, salts);
  return { secretKey: SK, balances: bals, salts, hashes: t.hashes, sums: t.sums };
}

describe('proveSolvency execution', () => {
  it('SOLVENT: total <= reserves -> boolean true', () => {
    const r = runProveSolvency({ ...inputs(balances, SALTS), reserves: tree.total + 1n, slot: 1234n });
    expect(r.result).toBe(true);
    expect(r.solvent).toBe(true);
    expect(r.published).toBe(true);
    expect(r.reservesSnapshot).toBe(tree.total + 1n);
  });

  it('INSOLVENT: total > reserves -> boolean flips to false', () => {
    const r = runProveSolvency({ ...inputs(balances, SALTS), reserves: tree.total - 1n, slot: 1234n });
    expect(r.solvent).toBe(false);
  });

  it('TAMPER: inflate a hidden leaf past reserves -> caught (false)', () => {
    const inflated = [...balances];
    inflated[3] = 10_000n;
    const r = runProveSolvency({ ...inputs(inflated, SALTS), reserves: tree.total, slot: 1234n });
    expect(r.solvent).toBe(false);
  });

  it('LYING TREE (sum): faked root sum is rejected', () => {
    const i = inputs(balances, SALTS);
    const lyingSums = [...i.sums];
    lyingSums[0] = 1n;
    expect(() =>
      runProveSolvency({ ...i, sums: lyingSums, reserves: tree.total + 1n, slot: 1234n }),
    ).toThrow('node sum mismatch');
  });

  it('LYING TREE (hash): faked node hash is rejected', () => {
    const i = inputs(balances, SALTS);
    const lyingHashes = i.hashes.map((h) => new Uint8Array(h));
    lyingHashes[0] = new Uint8Array(32).fill(9);
    expect(() =>
      runProveSolvency({ ...i, hashes: lyingHashes, reserves: tree.total + 1n, slot: 1234n }),
    ).toThrow('node hash mismatch');
  });
});

describe('privacy: salted commitments hide balances', () => {
  it('different salts -> different published root', () => {
    const r1 = runProveSolvency({ ...inputs(balances, saltsFrom(1)), reserves: tree.total + 1n, slot: 1n });
    const r2 = runProveSolvency({ ...inputs(balances, saltsFrom(2)), reserves: tree.total + 1n, slot: 1n });
    expect(hex(r1.liabilitiesRoot)).not.toBe(hex(r2.liabilitiesRoot));
  });
});

describe('anti-replay: slot must strictly increase', () => {
  it('strictly increasing slots publish successfully', () => {
    const [r1, r2] = runProveSolvencySequence(inputs(balances, SALTS), [
      { reserves: tree.total + 1n, slot: 100n },
      { reserves: tree.total + 1n, slot: 101n },
    ]);
    expect(r1.solvent).toBe(true);
    expect(r2.solvent).toBe(true);
  });

  it('stale slot is rejected', () => {
    expect(() =>
      runProveSolvencySequence(inputs(balances, SALTS), [
        { reserves: tree.total + 1n, slot: 100n },
        { reserves: tree.total + 1n, slot: 100n },
      ]),
    ).toThrow('stale slot');
  });
});
