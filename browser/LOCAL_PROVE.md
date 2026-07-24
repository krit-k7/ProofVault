# Fast path: proveSolvency with local Docker

The browser demo uses an **N=8** circuit (~18 MB prover key). Production N=64 remains ~146 MB in `@por/onchain`.

**Recommended setup:** browser proves against a local Midnight proof server; wallet handles balance + submit.

## One-time / each reboot

```bash
# Proof server (already started once as midnight-proof-server)
docker start midnight-proof-server
# or first time:
# docker run -d --name midnight-proof-server -p 6300:6300 midnightntwrk/proof-server:8.1.0

curl -s http://localhost:6300/health   # expect {"status":"ok",...}
```

## Build browser ZK assets (after pulling or changing compact/)

```bash
pnpm --filter @por/por-browser build:zk
```

## Env (packages/por-browser/.env — not committed)

```bash
VITE_NETWORK_ID=preprod
VITE_PROOF_SERVER_URL=http://localhost:6300
```

## Run the DApp

```bash
cd /path/to/midnight-project
pnpm --filter @por/por-browser dev
```

> Before proving, confirm the local proof server is reachable and that the browser is using the local endpoint. If the health check fails or the app points at the wrong server, proving will not start correctly.

Open **http://localhost:5175** (not the Netlify URL — Netlify cannot reach your Docker).

## Wallet

1. Connect **1AM** (or Lace) on **preprod**
2. Console should show: `proving via local proof server: http://localhost:6300`
3. **Deploy fresh** (old N=64 contract addresses will not work)
4. **proveSolvency from browser** — first prove usually **1–3 min** on N=8
5. Approve balance/submit in the wallet when prompted

## Why not Netlify + old N=64?

| Path | N=64 (~146 MB) | N=8 (~18 MB) |
|------|----------------|--------------|
| Browser → ProofStation | 413 / too large | May work via 1AM |
| Extension bridge | Too large | Likely OK |
| Localhost → Docker `:6300` | Works (slow) | **Works (fast)** |
