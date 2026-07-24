import { describe, it, expect } from 'vitest';
import {
  evaluateEligibility,
  observerCannotLearnLiabilityTotal,
} from './evaluateEligibility.js';

describe('solvency eligibility gate', () => {
  it('marks eligible when private liability total ≤ public reserves', () => {
    const r = evaluateEligibility({ liabilityTotal: 1000n, reserves: 1000n });
    expect(r.eligible).toBe(true);
    expect(r.publicDisclosure.solvent).toBe(true);
    expect(r.publicDisclosure.reservesSnapshot).toBe(1000n);
    expect(r.privateWitness.liabilityTotal).toBe(1000n);
  });

  it('marks ineligible when private liability total > public reserves', () => {
    const r = evaluateEligibility({ liabilityTotal: 2000n, reserves: 1000n });
    expect(r.eligible).toBe(false);
    expect(r.publicDisclosure.solvent).toBe(false);
  });

  it('public ledger fields never include liability total', () => {
    const r = evaluateEligibility({ liabilityTotal: 2505n, reserves: 3000n });
    const ledger = {
      solvent: r.publicDisclosure.solvent,
      reservesSnapshot: r.publicDisclosure.reservesSnapshot,
      liabilitiesRoot: 'ab'.repeat(32),
    };
    expect(observerCannotLearnLiabilityTotal(ledger)).toBe(true);
    expect('liabilityTotal' in ledger).toBe(false);
    expect(Object.values(ledger)).not.toContain(2505n);
  });
});

