#!/usr/bin/env bash
# Remove alice + awen tunnel rules from cloudflared config.
set -euo pipefail
CFG="$HOME/.cloudflared/config.yml"
BAK="$CFG.bak.$(date +%s)"
cp "$CFG" "$BAK"
awk '
  /^  - hostname: (alice|awen)\.maintenis\.tech/ { skip=2; next }
  skip > 0 { skip--; next }
  { print }
' "$BAK" > "$CFG"
echo "backup: $BAK"
echo "--- new config ---"
cat "$CFG"
