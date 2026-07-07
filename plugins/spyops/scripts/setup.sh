#!/bin/bash
# Setup idempotente do SpyOps. Roda uma vez (marcador .setup-done).
# Instala puppeteer (com Chromium). Whisper e ffmpeg são opcionais (só pra análise de vídeo).
set -u
ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
MARK="$ROOT/.setup-done"

if [ -f "$MARK" ]; then
  exit 0
fi

echo "[spyops] Primeira instalação — configurando o ambiente (pode levar alguns minutos)…"
cd "$ROOT" || exit 1

# 1. Node + puppeteer (obrigatório — baixa o Chromium)
if ! command -v npm >/dev/null 2>&1; then
  echo "[spyops] ERRO: Node/npm não encontrado. Instale o Node (nodejs.org) e rode este setup de novo."
  exit 1
fi
echo "[spyops] Instalando puppeteer…"
npm install --silent || { echo "[spyops] npm install falhou."; exit 1; }

# 2. ffmpeg (opcional — só pra baixar/cortar frames de vídeo)
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "[spyops] AVISO: ffmpeg não encontrado (necessário só pra análise de vídeo)."
  echo "         Mac: brew install ffmpeg   |   Windows: baixe em ffmpeg.org e adicione ao PATH."
fi

# 3. Whisper local (opcional — só pra transcrever os vídeos dos ads)
if command -v python3 >/dev/null 2>&1; then
  echo "[spyops] Preparando Whisper local (transcrição de vídeo, opcional)…"
  python3 -m venv "$ROOT/.venv" 2>/dev/null || true
  if [ -x "$ROOT/.venv/bin/pip" ]; then
    "$ROOT/.venv/bin/pip" install -q --upgrade pip >/dev/null 2>&1 || true
    if "$ROOT/.venv/bin/pip" install -q openai-whisper >/dev/null 2>&1; then
      echo "[spyops] Whisper pronto."
    else
      echo "[spyops] AVISO: Whisper não instalou automático. Pra transcrição de vídeo, rode depois:"
      echo "         $ROOT/.venv/bin/pip install openai-whisper"
    fi
  fi
else
  echo "[spyops] AVISO: python3 não encontrado. Transcrição de vídeo ficará indisponível até instalar Python + Whisper."
fi

touch "$MARK"
echo "[spyops] Pronto. Use:  /spy <link da Ad Library do concorrente>"
