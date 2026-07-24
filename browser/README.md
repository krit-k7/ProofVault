# Solvency Eligibility Gate — Browser DApp (Level 3)

**Idea list:** Age / Eligibility Gate  

Lace-connected browser frontend that proves a **private liability total ≤ public reserves** on **Midnight Preprod** without revealing balances — the same selective-disclosure pattern as an age/eligibility gate.

| | |
|---|---|
| **Live demo** | https://por-browser.netlify.app · [/app](https://por-browser.netlify.app/app) |
| **Repository** | https://github.com/Cryptonean/confidential-por-midnight |
| **Product proposal** | [PRODUCT_PROPOSAL.md](./PRODUCT_PROPOSAL.md) |
| **Submission guide** | [SUBMISSION.md](./SUBMISSION.md) |
| **CI pipeline** | [Actions — CI workflow](https://github.com/Cryptonean/confidential-por-midnight/actions/workflows/ci.yml) |
| **Workflow file** | [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) |

```bash
cd browser
pnpm install
pnpm test
```

---

## Privacy model

What an **observer** (public Midnight ledger + tx metadata) **can** learn:

- Whether the custodian passed the eligibility check (`solvent`)
- Attested `reservesSnapshot` and freshness `reservesSlot`
- Commitment `liabilitiesRoot` (Merkle root only)
- Custodian `owner` public key hash

What an observer **cannot** learn:

- Exact total liabilities
- Per-customer balances or salts
- Merkle tree witness material beyond the published root
- Custodian secret key

Demo UI may show sandbox balances for teaching; those values are **not** written on-chain. After prove, use **Refresh ledger** — only public fields above appear in contract state.

The circuit predicate is `Σ liabilities ≤ reserves`, framed for Level 3 as a **threshold eligibility gate**.

---

## Quick start (local)

```bash
cd browser
pnpm install
pnpm build:zk          # compile N=8 browser circuit (~18 MB prover)
cp .env.example .env   # VITE_NETWORK_ID=preprod
pnpm test
pnpm dev               # http://localhost:5175
```

See [LOCAL_PROVE.md](./LOCAL_PROVE.md) for Docker proof-server setup and [DEPLOY.md](./DEPLOY.md) for Netlify.

---

## User flow

1. **Connect** — Lace or 1AM on Preprod  
2. **Deploy fresh contract** — N=8 browser circuit  
3. **Check eligibility** — `proveSolvency` via wallet / ProofStation  
4. **Privacy model** — observer can/cannot learn (panel)  
5. **Disconnect** — clean session teardown  

---

## Architecture

```
Browser UI (React)
  ├─ walletConnector     Lace / 1AM
  ├─ PorBrowserClient    deploy + proveSolvency + readState
  ├─ eligibility/        threshold gate helper (unit-tested)
  ├─ browser-circuit/    N=8 Merkle-sum tree + witnesses
  ├─ compact/por-browser.compact
  └─ public/keys|zkir
```
