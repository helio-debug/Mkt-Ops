#!/bin/bash
# Sincroniza os scripts canônicos (automacao/spyops/) -> plugin, aplicando a
# adaptação do caminho do Whisper. Rode sempre que mudar o spy-ads/spy-videos canônico.
#   bash automacao/spyops-plugin/sync-from-canonical.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
SRC="$REPO/automacao/spyops"
DST="$HERE/plugins/spyops/scripts"

cp "$SRC/spy-ads.js" "$DST/spy-ads.js"
cp "$SRC/spy-videos.js" "$DST/spy-videos.js"

# Adapta o caminho do Whisper (canônico usa REPO/automacao/whisper; plugin usa a própria pasta)
python3 - "$DST/spy-videos.js" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
s = s.replace('const REPO = path.resolve(__dirname, "..", "..");',
              'const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..");')
s = s.replace('const WHISPER = path.join(REPO, "automacao", "whisper", ".venv", "bin", "whisper");',
              'const WHISPER = process.env.SPYOPS_WHISPER || path.join(PLUGIN_ROOT, ".venv", "bin", "whisper");')
open(p, "w", encoding="utf-8").write(s)
PY

echo "[sync] plugin atualizado a partir de automacao/spyops/"
