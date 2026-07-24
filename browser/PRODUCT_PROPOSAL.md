# Product proposal — Age / Eligibility Gate (Level 3)

**Chosen idea (from provided list):** Age / Eligibility Gate  
**Working title:** Solvency Eligibility Gate on Midnight  
**Repository:** https://github.com/cryptonean/confidential-por-midnight  
**Package:** `browser/`  
**Live demo:** https://por-browser.netlify.app

## Problem

Custodians and exchanges must show they can cover customer liabilities without publishing every balance (or even the liability total). Traditional audits leak competitive and customer-sensitive data.

## Solution

A Lace-connected Midnight dApp that proves a **private liability total is ≤ a public reserves snapshot**. Observers learn only whether the custodian is **eligible** to claim solvency (`solvent`), plus a commitment root and reserves/slot — never per-customer balances or the exact liability sum.

## Why this is Eligibility Gate

Same selective-disclosure pattern as age gates: prove `privateValue ≤ publicThreshold` without revealing `privateValue`. Here `privateValue` = committed liability total; `publicThreshold` = attested reserves.

## Privacy model (summary)

| Observer learns | Observer does not learn |
|---|---|
| `solvent` yes/no | Exact liability total |
| `reservesSnapshot`, `reservesSlot` | Per-customer balances |
| `liabilitiesRoot` commitment | Leaf salts / tree witnesses |
| Custodian `owner` key hash | Custodian secret key |

## Level 3 engineering scope

- Existing N=8 browser circuit + Preprod deploy/prove flow
- ≥3 automated tests (`pnpm --dir browser test`)
- GitHub Actions CI (Phase C)
- README privacy model + 1-min demo video
