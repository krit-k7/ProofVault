#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PKG_DIR/dist"

if [[ ! -f "$DIST_DIR/index.html" ]]; then
  echo "error: $DIST_DIR missing — run: pnpm build && pnpm verify:deploy" >&2
  exit 1
fi

if ! command -v netlify >/dev/null 2>&1; then
  echo "error: netlify CLI not found — run: npm install -g netlify-cli" >&2
  exit 1
fi

cd "$PKG_DIR"
echo "Deploying $DIST_DIR to Netlify (por-browser)…"
# Monorepo git root confuses relative --dir=dist; use absolute path.
exec netlify deploy --prod --no-build --dir="$DIST_DIR"
