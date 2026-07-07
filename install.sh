#!/bin/bash
# Instalador do SpyOps — copia a skill pra ~/.claude/skills/ (funciona em qualquer
# Claude Code, sem /plugin, sem GitHub). Uso:
#   curl -fsSL https://raw.githubusercontent.com/helio-debug/Mkt-Ops/main/install.sh | bash
set -e

REPO_TARBALL="https://github.com/helio-debug/Mkt-Ops/archive/refs/heads/main.tar.gz"
DEST="$HOME/.claude/skills/spyops"

echo "[spyops] Baixando…"
TMP="$(mktemp -d)"
curl -fsSL "$REPO_TARBALL" | tar xz -C "$TMP"
SRC="$(find "$TMP" -type d -path '*/skills/spyops' | head -1)"
if [ -z "$SRC" ]; then echo "[spyops] ERRO: não achei a skill no pacote."; exit 1; fi

echo "[spyops] Instalando em $DEST"
mkdir -p "$DEST"
cp -R "$SRC"/. "$DEST"/
rm -rf "$TMP"

echo "[spyops] Rodando setup (puppeteer/Chromium — alguns minutos na 1ª vez)…"
bash "$DEST/scripts/setup.sh" || true

echo ""
echo "[spyops] ✅ Instalado. Abre (ou reinicia) o Claude Code e use:"
echo "         /spy <link da Meta Ad Library do concorrente>"
