import { LEAF_COUNT, NODE_COUNT, FIRST_LEAF, leafHash, nodeHash } from './canonical.js';

export interface MerkleSumTree {
  hashes: Uint8Array[];
  sums: bigint[];
  root: Uint8Array;
  total: bigint;
}

export function buildMerkleSumTree(balances: bigint[], salts: Uint8Array[]): MerkleSumTree {
  if (balances.length !== LEAF_COUNT) {
    throw new Error(`buildMerkleSumTree requires exactly 64 balances, got ${balances.length}`);
  }
  if (salts.length !== LEAF_COUNT) {
    throw new Error(`buildMerkleSumTree requires exactly 64 salts, got ${salts.length}`);
  }
  const hashes = new Array<Uint8Array>(NODE_COUNT);
  const sums = new Array<bigint>(NODE_COUNT).fill(0n);
  for (let j = 0; j < LEAF_COUNT; j++) {
    hashes[FIRST_LEAF + j] = leafHash(balances[j], salts[j]);
    sums[FIRST_LEAF + j] = balances[j];
  }
  for (let i = FIRST_LEAF - 1; i >= 0; i--) {
    sums[i] = sums[2 * i + 1] + sums[2 * i + 2];
    hashes[i] = nodeHash(hashes[2 * i + 1], hashes[2 * i + 2]);
  }
  return { hashes, sums, root: hashes[0], total: sums[0] };
}
