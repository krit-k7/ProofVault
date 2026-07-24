import { z } from 'zod';
import { LEAF_COUNT } from './canonical.js';

export interface Customer {
  id: string;
  balance: bigint;
}

const RawCustomer = z.object({
  id: z.string().min(1),
  balance: z.string().regex(/^\d+$/, 'balance must be a non-negative integer string'),
});
const RawList = z.array(RawCustomer);

export function loadLiabilities(raw: unknown): Customer[] {
  return RawList.parse(raw).map((c) => ({ id: c.id, balance: BigInt(c.balance) }));
}

export function toPaddedBalances(customers: Customer[]): bigint[] {
  if (customers.length > LEAF_COUNT) {
    throw new Error(`at most 64 customers, got ${customers.length}`);
  }
  const out = new Array<bigint>(LEAF_COUNT).fill(0n);
  customers.forEach((c, i) => {
    out[i] = c.balance;
  });
  return out;
}
