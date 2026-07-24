#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/../dist"

REQUIRED=(
  "$DIST_DIR/index.html"
  "$DIST_DIR/keys/proveSolvency.prover"
  "$DIST_DIR/keys/proveSolvency.verifier"
  "$DIST_DIR/zkir/proveSolvency.bzkir"
)

MIN_PROVER_BYTES=$((500 * 1024))          # N=8 prover should be well above 500 KB
MAX_PROVER_BYTES=$((50 * 1024 * 1024))    # reject legacy N=64 ~146 MB keys

fail() {
  echo "verify-deploy: $*" >&2
  exit 1
}

[[ -d "$DIST_DIR" ]] || fail "dist/ not found — run pnpm build first"

for f in "${REQUIRED[@]}"; do
  [[ -f "$f" ]] || fail "missing $f"
done

prover_size=$(stat -f%z "$DIST_DIR/keys/proveSolvency.prover" 2>/dev/null || stat -c%s "$DIST_DIR/keys/proveSolvency.prover")
if [[ "$prover_size" -lt "$MIN_PROVER_BYTES" ]]; then
  fail "proveSolvency.prover looks too small (${prover_size} bytes) — run build:zk first"
fi
if [[ "$prover_size" -gt "$MAX_PROVER_BYTES" ]]; then
  fail "proveSolvency.prover looks like legacy N=64 (${prover_size} bytes) — run build:zk for N=8"
fi

echo "verify-deploy: OK (browser N=8 circuit)"
echo "  dist size : $(du -sh "$DIST_DIR" | awk '{print $1}')"
echo "  prover key: $(du -sh "$DIST_DIR/keys/proveSolvency.prover" | awk '{print $1}')"
echo ""
echo "After deploy, confirm these URLs return binary downloads (not index.html):"
echo "  https://<your-site>.netlify.app/keys/proveSolvency.prover"
echo "  https://<your-site>.netlify.app/zkir/proveSolvency.bzkir"
