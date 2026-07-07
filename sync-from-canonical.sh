#!/bin/bash
# Sincroniza os scripts canônicos (automacao/spyops/) -> a skill do repo Mkt-Ops.
# Os scripts já se auto-ajustam ao ambiente (env vars), então é só copiar.
#   bash automacao/spyops-plugin/sync-from-canonical.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
SRC="$REPO/automacao/spyops"
DST="$HERE/skills/spyops/scripts"

cp "$SRC/spy-ads.js" "$DST/spy-ads.js"
cp "$SRC/spy-videos.js" "$DST/spy-videos.js"

echo "[sync] skill atualizada a partir de automacao/spyops/"
