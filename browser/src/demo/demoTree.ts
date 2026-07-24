import { createHash } from './hash';
import { buildMerkleSumTree } from '../browser-circuit/tree.js';
import type { WitnessInputs } from '../browser-circuit/witnesses.js';
import { LEAF_COUNT } from '../browser-circuit/canonical.js';

const LOVELACE_PER_ADA = 1_000_000n;
const DEMO_SECRET = new Uint8Array(32).fill(0x42);
const SALT_SEED = 'por-preprod-demo-seed-v1';

function deriveSalts(seed: string, count: number): Uint8Array[] {
  const salts: Uint8Array[] = [];
  const seedBytes = new TextEncoder().encode(seed);
  for (let i = 0; i < count; i++) {
    const index = new Uint8Array(4);
    new DataView(index.buffer).setUint32(0, i, false);
    const digest = createHash(new Uint8Array([...seedBytes, ...index]));
    salts.push(digest);
  }
  return salts;
}

export interface DemoTreeSnapshot {
  witnessInputs: WitnessInputs;
  totalLiabilities: bigint;
  customerCount: number;
}

/** Demo liabilities tree — 5 customers padded to N=8 browser circuit leaves. */
export function buildDemoTree(insolvent = false): DemoTreeSnapshot {
  const rawAda = [100n, 250n, 150n, 75n, 300n];
  const balances = Array.from({ length: LEAF_COUNT }, (_, i) => (rawAda[i] ?? 0n) * LOVELACE_PER_ADA);
  const salts = deriveSalts(SALT_SEED, LEAF_COUNT);
  const tree = buildMerkleSumTree(balances, salts);

  return {
    witnessInputs: {
      secretKey: DEMO_SECRET,
      balances,
      salts,
      hashes: tree.hashes,
      sums: tree.sums,
    },
    totalLiabilities: tree.total,
    customerCount: rawAda.length,
  };
}

export function demoReserves(totalLiabilities: bigint, insolvent: boolean): bigint {
  if (insolvent) {
    return totalLiabilities > 0n ? totalLiabilities - 1n : 0n;
  }
  return totalLiabilities + 1_000_000_000n;
}

export function nextSlot(previousSlot: bigint | null): bigint {
  const now = BigInt(Date.now());
  if (previousSlot === null || now > previousSlot) return now;
  return previousSlot + 1n;
}
