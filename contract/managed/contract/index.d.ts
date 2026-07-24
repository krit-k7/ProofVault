import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  custodianSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  treeHashes(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array[]];
  treeSums(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint[]];
  leafBalances(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint[]];
  leafSalts(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array[]];
}

export type ImpureCircuits<PS> = {
  proveSolvency(context: __compactRuntime.CircuitContext<PS>,
                reserves_0: bigint,
                slot_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
}

export type ProvableCircuits<PS> = {
  proveSolvency(context: __compactRuntime.CircuitContext<PS>,
                reserves_0: bigint,
                slot_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  proveSolvency(context: __compactRuntime.CircuitContext<PS>,
                reserves_0: bigint,
                slot_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
}

export type Ledger = {
  readonly owner: Uint8Array;
  readonly liabilitiesRoot: Uint8Array;
  readonly reservesSnapshot: bigint;
  readonly reservesSlot: bigint;
  readonly solvent: boolean;
  readonly published: boolean;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
