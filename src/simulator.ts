import { Contract, ledger } from '../contract/managed/contract/index.js';
import { createConstructorContext, createCircuitContext } from '@midnight-ntwrk/compact-runtime';
import { sampleContractAddress } from '@midnight-ntwrk/onchain-runtime-v3';
import { makeWitnesses, type WitnessInputs } from './witnesses.js';

const COIN_PK = '0'.repeat(64);

export interface RunResult {
  result: boolean;
  solvent: boolean;
  published: boolean;
  reservesSnapshot: bigint;
  liabilitiesRoot: Uint8Array;
}

export interface SnapshotCall {
  reserves: bigint;
  slot: bigint;
}

export type RunInputs = WitnessInputs & SnapshotCall;

export function runProveSolvencySequence(inp: WitnessInputs, calls: SnapshotCall[]): RunResult[] {
  const contract = new Contract(makeWitnesses(inp));
  const addr = sampleContractAddress();
  const init = contract.initialState(createConstructorContext({}, COIN_PK));
  let ctx = createCircuitContext(addr, COIN_PK, init.currentContractState, init.currentPrivateState);
  const results: RunResult[] = [];
  for (const c of calls) {
    const res = contract.impureCircuits.proveSolvency(ctx, c.reserves, c.slot);
    ctx = res.context;
    const state = ledger(ctx.currentQueryContext.state);
    results.push({
      result: res.result,
      solvent: state.solvent,
      published: state.published,
      reservesSnapshot: state.reservesSnapshot,
      liabilitiesRoot: state.liabilitiesRoot,
    });
  }
  return results;
}

export function runProveSolvency(inp: RunInputs): RunResult {
  const { reserves, slot, ...witnessInputs } = inp;
  return runProveSolvencySequence(witnessInputs, [{ reserves, slot }])[0];
}
