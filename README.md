# mktops — marketplace de plugins (SpyOps)

Repositório privado = marketplace do Claude Code. Contém o plugin **spyops**.
Distribuído pra alunos via convite no repo privado (o acesso pago é o convite).

## Estrutura
```
.claude-plugin/marketplace.json     ← catálogo
plugins/spyops/
  .claude-plugin/plugin.json        ← manifesto do plugin
  skills/spyops/SKILL.md            ← a skill
  commands/spy.md                    ← comando /spy
  hooks/hooks.json                   ← nudge de setup no início da sessão
  scripts/spy-ads.js, spy-videos.js  ← pipeline (Puppeteer + ffmpeg + Whisper)
  scripts/setup.sh                   ← instala puppeteer; Whisper/ffmpeg opcionais
  package.json                       ← dep puppeteer
```

## Como publicar (uma vez)
1. Criar repo **privado** no GitHub, ex: `helio-debug/mktops-spyops`.
2. Copiar o conteúdo desta pasta pra raiz do repo e `git push`.
   > Importante: o `marketplace.json` fica em `.claude-plugin/` na **raiz** do repo.

## Como dar acesso a um aluno (o portão pago)
- Convidar o usuário GitHub do aluno como **colaborador** do repo (Settings → Collaborators), ou adicionar a um time da org.
- Cancelou? Remover o colaborador → ele perde as atualizações. (A cópia em cache local dele continua; pra corte duro precisaria de checagem de licença — fora do escopo v1.)

## O que o aluno faz
1. Precisa ter **Claude Code** (a execução roda na conta/assinatura dele — custo dele, não seu).
2. No Claude Code:
   ```
   /plugin marketplace add helio-debug/mktops-spyops
   /plugin install spyops@mktops
   ```
   (Usa a credencial git que ele já tem — sem login extra.)
3. Rodar `/spy <link da Ad Library>`. Na primeira vez a skill roda o `setup.sh` (instala puppeteer + Chromium; alguns minutos, uma vez só).
4. **Opcional (análise de vídeo):** ter ffmpeg + Whisper. O setup tenta instalar o Whisper local; se falhar, o aluno roda `.venv/bin/pip install openai-whisper` e `brew install ffmpeg`. Sem isso, o SpyOps roda normal só pulando os vídeos.

## Atualização
`git push` no repo → o Claude do aluno auto-atualiza (ou ele roda `/plugin marketplace update mktops`). Bump o `version` no `plugin.json` a cada release relevante.

## Limitações conhecidas
- **Windows / aluno não-técnico:** puppeteer entra ok, mas ffmpeg e Whisper local podem exigir instalação manual. Pra esse perfil, o caminho é rodar o SpyOps por ele e entregar o relatório (done-for-you).
- Transcrição de vídeo depende de Whisper local (v1). Migração pra API key de transcrição fica pra v2 se necessário.
