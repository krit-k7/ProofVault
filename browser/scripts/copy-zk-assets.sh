#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/../public"
KEYS_DIR="${POR_BROWSER_KEYS_DIR:-$HOME/.midnight-expert/por-browser-keys}"
ZK_BASE="${POR_ZK_ASSETS_BASE_URL:-}"

# N=8 browser circuit prover is ~few–20 MB; N=64 legacy keys are ~146 MB.
MAX_BROWSER_PROVER_BYTES=$((50 * 1024 * 1024))

REQUIRED=(
  "$PUBLIC_DIR/keys/proveSolvency.prover"
  "$PUBLIC_DIR/keys/proveSolvency.verifier"
  "$PUBLIC_DIR/zkir/proveSolvency.bzkir"
)

prover_size_if_present() {
  local prover="$PUBLIC_DIR/keys/proveSolvency.prover"
  if [[ ! -f "$prover" ]]; then
    echo 0
    return
  fi
  stat -f%z "$prover" 2>/dev/null || stat -c%s "$prover"
}

assets_present() {
  for f in "${REQUIRED[@]}"; do
    [[ -f "$f" ]] || return 1
  done
  local size
  size=$(prover_size_if_present)
  if [[ "$size" -gt "$MAX_BROWSER_PROVER_BYTES" ]]; then
    echo "stale N=64 prover key detected (${size} bytes) — will refresh browser N=8 assets" >&2
    return 1
  fi
  return 0
}

copy_from_local_keys_dir() {
  if [[ ! -d "$KEYS_DIR/keys" ]] || [[ ! -d "$KEYS_DIR/zkir" ]]; then
    return 1
  fi
  mkdir -p "$PUBLIC_DIR/keys" "$PUBLIC_DIR/zkir"
  cp -f "$KEYS_DIR/keys/"* "$PUBLIC_DIR/keys/"
  cp -f "$KEYS_DIR/zkir/"* "$PUBLIC_DIR/zkir/"
  find "$PUBLIC_DIR" -name '._*' -delete 2>/dev/null || true
  echo "copied browser ZK assets from $KEYS_DIR to $PUBLIC_DIR"
}

download_from_base_url() {
  local base="${ZK_BASE%/}"
  if [[ -z "$base" ]]; then
    return 1
  fi
  mkdir -p "$PUBLIC_DIR/keys" "$PUBLIC_DIR/zkir"
  echo "downloading ZK assets from $base …"
  curl -fsSL "$base/keys/proveSolvency.prover" -o "$PUBLIC_DIR/keys/proveSolvency.prover"
  curl -fsSL "$base/keys/proveSolvency.verifier" -o "$PUBLIC_DIR/keys/proveSolvency.verifier"
  curl -fsSL "$base/zkir/proveSolvency.bzkir" -o "$PUBLIC_DIR/zkir/proveSolvency.bzkir"
  curl -fsSL "$base/zkir/proveSolvency.zkir" -o "$PUBLIC_DIR/zkir/proveSolvency.zkir" 2>/dev/null || true
  echo "downloaded ZK assets from $base"
}

if assets_present; then
  echo "browser ZK assets already present in $PUBLIC_DIR — skipping copy"
  exit 0
fi

if copy_from_local_keys_dir; then
  exit 0
fi

if download_from_base_url && assets_present; then
  exit 0
fi

cat <<'EOF' >&2
error: browser N=8 ZK assets missing for por-browser build.

Local dev:
  pnpm --filter @por/por-browser build:zk
  pnpm --filter @por/por-browser copy:zk

Netlify CI:
  1. Commit public/keys/*.prover after build:zk (or Git LFS)
  2. Set POR_ZK_ASSETS_BASE_URL to a CDN hosting the N=8 keys
EOF
exit 1
