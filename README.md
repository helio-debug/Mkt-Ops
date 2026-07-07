# SpyOps — skill do Claude Code (Mkt-Ops)

Espionagem de anúncios na Meta Ad Library: copy dos ads ativos, funil, landing pages e vídeos transcritos. Entregue como **skill** — funciona em qualquer Claude Code, **sem `/plugin`, sem conta GitHub**.

## Instalação (aluno) — uma linha
No terminal, ou pedindo pro próprio Claude Code rodar:
```bash
curl -fsSL https://raw.githubusercontent.com/helio-debug/Mkt-Ops/main/install.sh | bash
```
Isso copia a skill pra `~/.claude/skills/spyops/` e instala o puppeteer (Chromium, alguns minutos na 1ª vez). Depois é só abrir o Claude Code e usar:
```
/spy <link da Meta Ad Library do concorrente>
```

**Alternativa manual (sem terminal):** baixar o ZIP do repo ("Code → Download ZIP") e copiar a pasta `skills/spyops` inteira pra dentro de `~/.claude/skills/` (fica `~/.claude/skills/spyops/SKILL.md`). Reinicia o Claude Code e o `/spy` aparece.

## Pré-requisitos do aluno
- **Claude Code capaz de rodar shell** (terminal CLI, app desktop, ou web). SpyOps roda Node + Puppeteer, então precisa de um ambiente com Bash — **não roda em ambiente sem execução de comando.**
- **Node** instalado (o setup instala o resto).
- Opcional (transcrição de vídeo): colar uma **API key** (OpenAI ou Groq) em `.env`. Sem chave, roda normal só pulando os vídeos. ffmpeg entra automático (ffmpeg-static).
- A execução usa a conta/assinatura Claude do aluno (custo dele, não seu).

## Estrutura do repo
```
install.sh                     ← instalador de 1 linha
skills/spyops/
  SKILL.md                     ← a skill (usa ${CLAUDE_SKILL_DIR})
  package.json                 ← dep puppeteer
  scripts/
    spy-ads.js, spy-videos.js  ← pipeline
    setup.sh                   ← instala puppeteer; Whisper/ffmpeg opcionais
sync-from-canonical.sh         ← copia scripts de automacao/spyops/ (canônico)
```

## Manutenção
- Canônico dos scripts: `automacao/spyops/` no repo interno. Depois de mudar, rode `bash sync-from-canonical.sh` e `git push` — os alunos pegam na próxima instalação (ou re-rodando o install).
- Atualização automática pro aluno não existe nesse formato; pra atualizar, ele re-roda o `install.sh`.

## Por que skill e não plugin
O sistema `/plugin` não está disponível em vários ambientes de Claude Code ("/plugin isn't available in this environment"). Skill em `~/.claude/skills/` é auto-descoberta em todos, sem comando de instalação — entrega mais simples e robusta.

## Limitação conhecida
Windows / aluno não-técnico pode travar no setup de Node/ffmpeg/Whisper. Pra esse perfil, o caminho é você rodar o SpyOps e entregar o relatório (done-for-you).
