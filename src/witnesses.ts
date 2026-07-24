import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from '../contract/managed/contract/index.js';
import { LEAF_COUNT, NODE_COUNT } from './canonical.js';

export type PrivateState = Record<string, never>;

export interface WitnessInputs {
  secretKey: Uint8Array;
  balances: bigint[];
  salts: Uint8Array[];
  hashes: Uint8Array[];
  sums: bigint[];
}

const U64_CEIL = 1n << 64n;

function validate(inp: WitnessInputs): void {
  if (inp.secretKey.length !== 32) {
    throw new Error(`secretKey must be 32 bytes, got ${inp.secretKey.length}`);
  }
  if (inp.balances.length !== LEAF_COUNT) {
    throw new Error(`balances must have ${LEAF_COUNT} entries, got ${inp.balances.length}`);
  }
  if (inp.salts.length !== LEAF_COUNT) {
    throw new Error(`salts must have ${LEAF_COUNT} entries, got ${inp.salts.length}`);
  }
  if (inp.hashes.length !== NODE_COUNT) {
    throw new Error(`hashes must have ${NODE_COUNT} entries, got ${inp.hashes.length}`);
  }
  if (inp.sums.length !== NODE_COUNT) {
    throw new Error(`sums must have ${NODE_COUNT} entries, got ${inp.sums.length}`);
  }
  for (const b of inp.balances) {
    if (b < 0n || b >= U64_CEIL) throw new Error(`balance out of Uint<64> range: ${b}`);
  }
  for (const s of inp.salts) {
    if (s.length !== 32) throw new Error('each leaf salt must be 32 bytes');
  }
  for (const h of inp.hashes) {
    if (h.length !== 32) throw new Error('each node hash must be 32 bytes');
  }
}

export function makeWitnesses(inp: WitnessInputs): Witnesses<PrivateState> {
  validate(inp);
  const pass = (ctx: WitnessContext<Ledger, PrivateState>) => ctx.privateState;
  return {
    custodianSecretKey: (ctx): [PrivateState, Uint8Array] => [pass(ctx), inp.secretKey],
    treeHashes: (ctx): [PrivateState, Uint8Array[]] => [pass(ctx), inp.hashes],
    treeSums: (ctx): [PrivateState, bigint[]] => [pass(ctx), inp.sums],
    leafBalances: (ctx): [PrivateState, bigint[]] => [pass(ctx), inp.balances],
    leafSalts: (ctx): [PrivateState, Uint8Array[]] => [pass(ctx), inp.salts],
  };
}
