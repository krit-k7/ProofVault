import {
  persistentHash,
  persistentCommit,
  CompactTypeBytes,
  CompactTypeVector,
  CompactTypeUnsignedInteger,
} from '@midnight-ntwrk/compact-runtime';

/** Fixed capacity: 64 leaves -> binary sum-tree of depth 6 -> 127 heap nodes. */
export const LEAF_COUNT = 64;
export const NODE_COUNT = 2 * LEAF_COUNT - 1; // 127
export const FIRST_LEAF = LEAF_COUNT - 1; // 63

/** Domain separators (must match por.compact verbatim). */
export const DOMAIN = { owner: 'por:owner:', node: 'por:node:' } as const;

/** Encode a string as a Compact `pad(32, s)` Bytes<32>: UTF-8 bytes, zero-padded to 32. */
export function padDomain(s: string): Uint8Array {
  const bytes = new TextEncoder().encode(s);
  if (bytes.length > 32) throw new Error(`domain "${s}" exceeds 32 bytes`);
  const out = new Uint8Array(32);
  out.set(bytes);
  return out;
}

const U64 = new CompactTypeUnsignedInteger((1n << 64n) - 1n, 8);
const BYTES32 = new CompactTypeBytes(32);
const NODE_VEC = new CompactTypeVector(3, BYTES32);
const NODE_DOMAIN = padDomain(DOMAIN.node);

/** Leaf hash = salted commitment to the balance. */
export function leafHash(balance: bigint, salt: Uint8Array): Uint8Array {
  if (balance < 0n || balance >= 1n << 64n) throw new Error('balance out of Uint<64> range');
  if (salt.length !== 32) throw new Error('salt must be 32 bytes');
  return persistentCommit(U64, balance, salt);
}

/** Internal node hash = domain-separated hash of the two child hashes. */
export function nodeHash(left: Uint8Array, right: Uint8Array): Uint8Array {
  return persistentHash(NODE_VEC, [NODE_DOMAIN, left, right]);
}
