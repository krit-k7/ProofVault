export interface EligibilityInput {
  liabilityTotal: bigint;
  reserves: bigint;
}

export interface EligibilityResult {
  eligible: boolean;
  publicDisclosure: {
    solvent: boolean;
    reservesSnapshot: bigint;
  };
  privateWitness: {
    liabilityTotal: bigint;
  };
}

/** Threshold gate: private total ≤ public reserves (same predicate as proveSolvency). */
export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const eligible = input.liabilityTotal <= input.reserves;
  return {
    eligible,
    publicDisclosure: {
      solvent: eligible,
      reservesSnapshot: input.reserves,
    },
    privateWitness: {
      liabilityTotal: input.liabilityTotal,
    },
  };
}

/** Invariant: on-chain / public bundle must not carry the private total. */
export function observerCannotLearnLiabilityTotal(ledger: {
  solvent: boolean;
  reservesSnapshot: bigint;
  liabilitiesRoot: string;
}): boolean {
  const keys = Object.keys(ledger);
  return !keys.includes('liabilityTotal') && !keys.includes('balances');
}
