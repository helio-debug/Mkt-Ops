#!/bin/bash
# Setup idempotente do SpyOps (roda uma vez; marcador .setup-done).
# Instala puppeteer (Chromium) + ffmpeg-static + ffprobe-static via npm.
# Transcrição de vídeo é por API key (opcional) — ver .env.example.
set -u
ROOT="${CLAUDE_SKILL_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
MARK="$ROOT/.setup-done"
[ -f "$MARK" ] && exit 0

echo "[spyops] Primeira instalação — configurando (Chromium é pesado, alguns minutos)…"
cd "$ROOT" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "[spyops] ERRO: Node/npm não encontrado. Instale o Node (nodejs.org) e rode /spy de novo."
  exit 1
fi
npm install --silent || { echo "[spyops] npm install falhou."; exit 1; }

# Template pra API key de transcrição (opcional)
if [ ! -f "$ROOT/.env" ]; then
  cat > "$ROOT/.env.example" <<'EOF'
# Transcrição de vídeo (OPCIONAL). Copie este arquivo pra .env e cole UMA das chaves.
# Sem chave, o SpyOps roda normal — só não transcreve os vídeos.
OPENAI_API_KEY=
# ou, alternativa mais barata:
# GROQ_API_KEY=
EOF
fi

touch "$MARK"
echo "[spyops] Pronto. Use:  /spy <link da Meta Ad Library>"
echo "[spyops] (Opcional) pra transcrever vídeo: copie .env.example pra .env e cole sua OPENAI_API_KEY."
