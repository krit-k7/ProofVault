#!/usr/bin/env bash
set -euo pipefail

# Full ZK compile of por-browser.compact (N=8 demo circuit) to APFS, then copy
# generated contract + keys into packages/por-browser for browser proving.

KEYS_DIR="${POR_BROWSER_KEYS_DIR:-$HOME/.midnight-expert/por-browser-keys}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACT_SRC="$PKG_DIR/compact/por-browser.compact"
GENERATED_DIR="$PKG_DIR/src/generated"
PUBLIC_DIR="$PKG_DIR/public"

echo "==> Keys dir   : $KEYS_DIR"
echo "==> Contract   : $CONTRACT_SRC"
echo "==> Generated  : $GENERATED_DIR"
echo "==> Public ZK  : $PUBLIC_DIR"

rm -rf "$KEYS_DIR"
compact compile "$CONTRACT_SRC" "$KEYS_DIR"
find "$KEYS_DIR" -name '._*' -delete

mkdir -p "$GENERATED_DIR"
cp "$KEYS_DIR/contract/index.js" "$GENERATED_DIR/index.js"
cp "$KEYS_DIR/contract/index.d.ts" "$GENERATED_DIR/index.d.ts"
find "$GENERATED_DIR" -name '._*' -delete

mkdir -p "$PUBLIC_DIR/keys" "$PUBLIC_DIR/zkir"
cp -f "$KEYS_DIR/keys/"* "$PUBLIC_DIR/keys/"
cp -f "$KEYS_DIR/zkir/"* "$PUBLIC_DIR/zkir/"
find "$PUBLIC_DIR" -name '._*' -delete 2>/dev/null || true

prover_size=$(stat -f%z "$PUBLIC_DIR/keys/proveSolvency.prover" 2>/dev/null || stat -c%s "$PUBLIC_DIR/keys/proveSolvency.prover")
prover_mb=$((prover_size / 1024 / 1024))

echo ""
echo "==> Browser ZK build complete."
echo "    Prover key : ${prover_mb} MB ($PUBLIC_DIR/keys/proveSolvency.prover)"
echo "    Generated  : $GENERATED_DIR/index.{js,d.ts}"
echo "    ZKIR       : $PUBLIC_DIR/zkir/proveSolvency.bzkir"
