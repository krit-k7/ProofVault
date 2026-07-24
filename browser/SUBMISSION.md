# Rise In Midnight — Level 3 submission

**Chosen idea:** Age / Eligibility Gate → **Solvency Eligibility Gate**  
**Repo:** https://github.com/cryptonean/confidential-por-midnight  
**Live demo:** https://por-browser.netlify.app  
**Proposal:** [PRODUCT_PROPOSAL.md](./PRODUCT_PROPOSAL.md)

| Item | Status | Evidence |
|------|--------|----------|
| Public GitHub + README | ✅ | This repo; [README.md](../README.md), [browser/README.md](./README.md) |
| Live demo | ✅ | https://por-browser.netlify.app (redeploy after Level 3 framing) |
| ≥3 tests passing | ✅ | `pnpm --dir browser test` (eligibility + tree) |
| Screenshot: tests | 📝 | Capture after confirm; store in `docs/screenshots/` |
| CI/CD badge + passing runs | ✅ | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) + Actions badge |
| Demo video (~1 min) | 📝 | [Script below](#demo-video-script-1-min) |
| README privacy model | ✅ | [Privacy model](./README.md#privacy-model) |
| Product proposal (idea list) | ✅ | [PRODUCT_PROPOSAL.md](./PRODUCT_PROPOSAL.md) |
| ≥10 meaningful commits | 📝 | Level 3 commits on this repo |

## Requirements mapped

| Requirement | Implementation |
|-------------|----------------|
| Functional privacy dApp | Lace + deploy + `proveSolvency` eligibility check |
| Selective disclosure | Private liability total; public `solvent` / reserves / root |
| ≥3 tests | `src/eligibility/*.test.ts`, `src/browser-circuit/tree.test.ts` |
| CI/CD | Phase C on this GitHub repo |

## Verify locally

```bash
# From repo root
pnpm --dir browser install
pnpm --dir browser test
pnpm --dir browser typecheck

# Optional: Level 1 simulator (needs Compact CLI)
pnpm test
```

> Submission note: if you need a quick evidence trail for review, keep the latest test output, a screenshot of the live demo, and the deployment URL together in the same folder for easy reference.

## Demo video script (1 min)

| Sec | Action |
|---|---|
| 0–10 | Title + open https://por-browser.netlify.app |
| 10–25 | Connect Lace/1AM (Preprod) |
| 25–40 | Deploy/join + Check eligibility |
| 40–55 | Privacy model panel (can / cannot learn) |
| 55–60 | Refresh ledger / disconnect |
