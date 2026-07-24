# Deploying por-browser to Netlify (1AM ProofStation)

The browser demo uses an **N=8** `proveSolvency` circuit (~**18 MB** prover key). Production N=64 in `@por/onchain` is ~146 MB and does not fit ProofStation / extension limits.

**Correct 1AM path:** wallet → ProofStation (`api-preprod.1am.xyz`). Host ZK keys on public HTTPS (`/keys`, `/zkir`) on the same origin as the DApp.

## Netlify site settings

> Preflight: ensure the browser ZK assets exist locally before deploying. If the proof keys are missing, the build and runtime will fail even if the React app itself compiles.

| Setting | Value |
|---------|-------|
| Base directory | `packages/por-browser` |
| Build command | `pnpm --filter @por/por-browser build` (from `netlify.toml`) |
| Publish directory | `dist` |
| Node version | `22` |

**Environment variables** (Netlify UI → Site configuration → Environment variables):

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_NETWORK_ID` | `preprod` | Yes |
| `VITE_PROOF_SERVER_URL` | *(leave unset for 1AM)* | No |
| `POR_ZK_ASSETS_BASE_URL` | CDN base URL if keys are not in git | Only for CI without LFS |

Do **not** set `VITE_PROOF_SERVER_URL` when using 1AM ProofStation on Netlify.

## Build ZK assets (required once per machine / after circuit change)

```bash
pnpm --filter @por/por-browser build:zk
```

Produces `public/keys/proveSolvency.prover` (~18 MB), verifier, and `public/zkir/*`.

## Option A — Manual CLI deploy (recommended)

```bash
pnpm --filter @por/por-browser build:zk   # if keys missing
pnpm --filter @por/por-browser build
pnpm --filter @por/por-browser verify:deploy
pnpm --filter @por/por-browser deploy:netlify
```

Live site: https://por-browser.netlify.app

## Option B — Git-connected deploy (CI)

The N=8 `.prover` (~18 MB) may fit in git without LFS; N=64 (~146 MB) requires **Git LFS**:

```bash
git lfs install
git lfs track "*.prover"
```

See `netlify.toml` for CORS headers and SPA rules that keep `/keys/*` served as raw binaries.

## Option C — External CDN for keys

Host `/keys` and `/zkir` on S3, R2, etc. with CORS `Access-Control-Allow-Origin: *`.

Set build env: `POR_ZK_ASSETS_BASE_URL=https://your-cdn.example.com/por-zk`

## Post-deploy checklist

1. Open `https://por-browser.netlify.app/keys/proveSolvency.prover` — must download ~18 MB (not the React app).
2. Connect **1AM** on Preprod, **Deploy fresh contract**, then **proveSolvency from browser**.
3. Keep 1AM unlocked during the ~1–2 minute proof.
4. Copy contract address → `submission.preprod.json` → `pnpm verify:preprod -- <address>`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `/keys/...` shows the React app | Redeploy; check `netlify.toml` ZK redirect rules |
| Build fails "ZK assets missing" | Run `pnpm build:zk` locally or set `POR_ZK_ASSETS_BASE_URL` |
| Verifier key mismatch on rejoin | **Deploy fresh** — old contracts used different ZK builds (see `contractStorage.ts`) |
| Bit bound / 8-bit check failed | Hard refresh; stale cached keys — `zkFetch.ts` cache-busts by build id |
| Duplicate request on deploy | Wait for join to finish, or Disconnect → Connect, then Deploy |
