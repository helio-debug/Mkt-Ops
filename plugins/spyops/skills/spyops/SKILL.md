---
name: spyops
description: "Espiona anúncios de concorrentes na Meta Ad Library (sem token, sem login) e mapeia o funil completo: copy dos ads ativos, criativos-mestre, destinos, landing pages e download + transcrição + frames dos vídeos. Pipeline Puppeteer — NUNCA Playwright, NUNCA a API oficial (travada, erro 2332002). Acionar quando: pedir pra espiar/analisar anúncios, mandar link da Ad Library, ou disser 'SpyOps' / '/spy'. [triggers: SpyOps, spy, espionar anúncios, Ad Library, biblioteca de anúncios, analisar ads do concorrente, funil do concorrente, ver os vídeos dos ads]"
---

# SpyOps — Espionagem de Ads + Funil (Meta Ad Library)

Fluxo roteirizado. Os scripts em `${CLAUDE_PLUGIN_ROOT}/scripts/` resolvem tudo. Não improvisar acesso.

## Regras duras
1. **NUNCA Playwright.** Motor é Puppeteer (instalado no setup do plugin).
2. **NUNCA a Graph API `/ads_archive`** — erro `2332002`. Ir direto pro pipeline.
3. Saída em `analises/<slug-do-alvo>/` na pasta do projeto do usuário (kebab-case).
4. Vídeos vêm em pool do anunciante; de-para por **duração** (card mostra `0:00 / 0:41`). Comportamento esperado.

## Passo 0 — Garantir o setup (primeira vez)
Se `${CLAUDE_PLUGIN_ROOT}/node_modules` não existir, rode uma vez:
```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh"
```
Instala puppeteer (Chromium). Whisper e ffmpeg são opcionais — só pra análise de vídeo; se faltarem, o passo de vídeo é pulado com aviso.

## Passo 1 — Raspar os ads
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/spy-ads.js" --url "<URL da Ad Library>" --out "analises/<slug>"
# ou: --q "dominio.com" | --page-id 123456   (+ --country BR --status active)
```
Gera `spy-ads.json` (cards + grupos por copy + destinos), `spy-ads.md` e os raws.

## Passo 2 — Baixar e assistir uma amostra dos vídeos (mín. 5)
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/spy-videos.js" --from-json "analises/<slug>/spy-ads.json" --sample 5 \
  --out "analises/<slug>/videos" --frames --transcribe
```
- Ler os mosaicos (`*-mosaic.jpg`) com a tool Read pra descrever o visual.
- Ler as transcrições (`*.txt`). Vazia = vídeo só com música → analisar pelo mosaico.
- Sem Whisper instalado, rodar sem `--transcribe` (só frames).

## Passo 3 — Mapear o funil
Pra cada destino em `spy-ads.json → destinations`, raspar a LP (Puppeteer: goto + scroll + innerText + anchors + forms; ou `curl -sL` se estática). Levantar: preço/lotes, countdown, campos de form, provedor de checkout, builder da página, links de WhatsApp, downsells.

## Passo 4 — Relatório
Escrever `analises/<slug>/spy-report-<slug>.md`: Snapshot · Criativos-mestre (copy literal) · Análise da copy · Desenho do funil (ASCII) · Amostragem de vídeos (roteiro por corte) · O que vale roubar · Limitações.

## Troubleshooting
`Cannot find module 'puppeteer'` → rode o setup do Passo 0. Vídeo sem transcrição → Whisper não instalado (opcional). ffmpeg ausente → instala só pra análise de vídeo.
