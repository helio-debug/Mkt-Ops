#!/bin/bash
# Setup idempotente do SpyOps (roda uma vez; marcador .setup-done).
# Instala puppeteer (com Chromium). Whisper e ffmpeg são opcionais (só análise de vídeo).
set -u
ROOT="${CLAUDE_SKILL_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
MARK="$ROOT/.setup-done"
[ -f "$MARK" ] && exit 0

echo "[spyops] Primeira instalação — configurando o ambiente (pode levar alguns minutos)…"
cd "$ROOT" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "[spyops] ERRO: Node/npm não encontrado. Instale o Node (nodejs.org) e rode /spy de novo."
  exit 1
fi
echo "[spyops] Instalando puppeteer…"
npm install --silent || { echo "[spyops] npm install falhou."; exit 1; }

command -v ffmpeg >/dev/null 2>&1 || echo "[spyops] AVISO: ffmpeg não encontrado (só pra análise de vídeo). Mac: brew install ffmpeg."

if command -v python3 >/dev/null 2>&1; then
  python3 -m venv "$ROOT/.venv" 2>/dev/null || true
  if [ -x "$ROOT/.venv/bin/pip" ]; then
    "$ROOT/.venv/bin/pip" install -q --upgrade pip >/dev/null 2>&1 || true
    "$ROOT/.venv/bin/pip" install -q openai-whisper >/dev/null 2>&1 \
      && echo "[spyops] Whisper pronto." \
      || echo "[spyops] AVISO: Whisper não instalou (opcional). Depois: $ROOT/.venv/bin/pip install openai-whisper"
  fi
else
  echo "[spyops] AVISO: python3 ausente. Transcrição de vídeo indisponível até instalar Python + Whisper."
fi

touch "$MARK"
echo "[spyops] Pronto. Use:  /spy <link da Ad Library>"
