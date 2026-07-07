#!/usr/bin/env node
/**
 * SpyOps — baixa e prepara os VÍDEOS dos anúncios da Meta Ad Library.
 * Motor: Puppeteer (NUNCA Playwright) + ffprobe/ffmpeg (homebrew) + curl.
 *
 * Como funciona: a página de detalhe (facebook.com/ads/library/?id=<library_id>)
 * autoplay-a vídeos do anunciante — capturamos as URLs fbcdn .mp4 via network +
 * JSON embutido. As URLs vêm em POOL do anunciante (não 1:1 com o ad); o de-para
 * é feito pela DURAÇÃO, que aparece no card da listagem como "0:00 / 0:41".
 *
 * Uso:
 *   node automacao/spyops/spy-videos.js --ids "123,456,789" --out analises/<slug>/videos
 *   node automacao/spyops/spy-videos.js --from-json analises/<slug>/spy-ads.json --sample 5 --out analises/<slug>/videos
 *
 * Flags:
 *   --max 12          teto de vídeos únicos a baixar
 *   --frames          gera mosaico de frames (1 frame/4s, grade 4x3) por vídeo
 *   --transcribe      transcreve com Whisper local (automacao/whisper)
 *   --lang Portuguese idioma pro Whisper (use "auto" pra detectar)
 *
 * Saídas em --out: <dur>s-<hash>.mp4 · *-mosaic.jpg · *.txt · video-index.json
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Whisper local (opcional): venv da casa internamente; no skill/plugin, a própria pasta.
const SKILL_ROOT = process.env.CLAUDE_SKILL_DIR || process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..");
const REPO_WHISPER = path.join(__dirname, "..", "..", "automacao", "whisper", ".venv", "bin", "whisper");
const WHISPER = process.env.SPYOPS_WHISPER
  || (fs.existsSync(REPO_WHISPER) ? REPO_WHISPER : path.join(SKILL_ROOT, ".venv", "bin", "whisper"));

// ffmpeg/ffprobe: usa o do sistema; senão cai nos pacotes estáticos (via npm).
function resolveBin(sys, staticPkg, field) {
  try { execFileSync(sys, ["-version"], { stdio: "ignore" }); return sys; } catch (_) {}
  try { const m = require(staticPkg); return field ? m[field] : m; } catch (_) {}
  return sys;
}
const FFMPEG = resolveBin("ffmpeg", "ffmpeg-static");
const FFPROBE = resolveBin("ffprobe", "ffprobe-static", "path");

// API key de transcrição (opcional): env ou <SKILL_ROOT>/.env. OpenAI ou Groq.
function transcribeKey() {
  const pick = (k) => k
    ? { key: k.startsWith("gsk_") ? k : k, url: k.startsWith("gsk_")
        ? "https://api.groq.com/openai/v1/audio/transcriptions"
        : "https://api.openai.com/v1/audio/transcriptions",
        model: k.startsWith("gsk_") ? "whisper-large-v3" : "whisper-1" }
    : null;
  if (process.env.OPENAI_API_KEY) return pick(process.env.OPENAI_API_KEY);
  if (process.env.GROQ_API_KEY) return pick(process.env.GROQ_API_KEY);
  try {
    const envf = path.join(SKILL_ROOT, ".env");
    if (fs.existsSync(envf)) {
      const o = {};
      for (const line of fs.readFileSync(envf, "utf8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i > 0) o[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      }
      return pick(o.OPENAI_API_KEY || o.GROQ_API_KEY);
    }
  } catch (_) {}
  return null;
}

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { max: 12, lang: "Portuguese", sample: 5 };
  for (let i = 0; i < a.length; i++) {
    switch (a[i]) {
      case "--ids": o.ids = a[++i].split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--from-json": o.fromJson = a[++i]; break;
      case "--sample": o.sample = parseInt(a[++i]); break;
      case "--out": o.out = a[++i]; break;
      case "--max": o.max = parseInt(a[++i]); break;
      case "--frames": o.frames = true; break;
      case "--transcribe": o.transcribe = true; break;
      case "--lang": o.lang = a[++i]; break;
    }
  }
  if (!o.out) { console.error("Faltou --out <dir>"); process.exit(1); }
  if (!o.ids && o.fromJson) {
    // pega 1 library_id por grupo de criativo (os N maiores) — cobre os masters
    const j = JSON.parse(fs.readFileSync(o.fromJson, "utf-8"));
    o.ids = (j.creative_groups || []).slice(0, o.sample).map((g) => g.library_ids[0]);
  }
  if (!o.ids || !o.ids.length) { console.error("Passe --ids ou --from-json"); process.exit(1); }
  return o;
}

function ffprobeDuration(url) {
  try {
    const r = execFileSync(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", url],
      { timeout: 45000 }).toString().trim();
    return r ? Math.round(parseFloat(r) * 10) / 10 : null;
  } catch (_) { return null; }
}

(async () => {
  const opt = parseArgs();
  fs.mkdirSync(opt.out, { recursive: true });

  // 1. coleta URLs de vídeo nas páginas de detalhe
  const browser = await puppeteer.launch({ headless: true, args: ["--lang=pt-BR"] });
  const urls = new Set();
  for (const id of opt.ids) {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    page.on("response", (res) => {
      const u = res.url();
      if (/\.mp4/.test(u)) urls.add(u.split("&bytestart")[0]);
    });
    try {
      await page.goto(`https://www.facebook.com/ads/library/?id=${id}`, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(4000);
      const found = await page.evaluate(() => {
        const out = new Set();
        document.querySelectorAll("video").forEach((v) => {
          if (v.src && v.src.startsWith("http")) out.add(v.src);
          v.querySelectorAll("source").forEach((s) => s.src && out.add(s.src));
        });
        const html = document.documentElement.innerHTML;
        for (const key of ["video_hd_url", "video_sd_url", "playable_url_quality_hd", "playable_url"]) {
          const re = new RegExp('"' + key + '":"(https:[^"]+)"', "g");
          let m;
          while ((m = re.exec(html))) { try { out.add(JSON.parse('"' + m[1] + '"')); } catch (_) {} }
        }
        return Array.from(out);
      });
      found.forEach((u) => urls.add(u));
      console.log(`id ${id}: pool acumulado ${urls.size} URLs`);
    } catch (e) {
      console.log(`id ${id}: ERRO ${e.message}`);
    }
    await page.close();
  }
  await browser.close();

  // 2. sonda duração e deduplica (mesmo vídeo aparece em SD+HD com duração ±0.3s)
  console.log(`\nSondando durações de ${urls.size} URLs…`);
  const byDur = new Map();
  for (const u of urls) {
    const d = ffprobeDuration(u);
    if (!d) continue;
    const near = [...byDur.keys()].find((k) => Math.abs(k - d) <= 0.3);
    if (!near) byDur.set(d, u);
  }
  console.log(`${byDur.size} vídeos únicos por duração: ${[...byDur.keys()].sort((a, b) => a - b).join("s, ")}s`);

  // 3. baixa (até --max), gera mosaico e transcreve
  const index = [];
  let n = 0;
  for (const [dur, u] of [...byDur.entries()].sort((a, b) => b[0] - a[0])) {
    if (n++ >= opt.max) { console.log(`(teto --max ${opt.max} atingido; ${byDur.size - opt.max} vídeos não baixados)`); break; }
    const base = `${String(dur).replace(".", "_")}s-${Buffer.from(u).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(-8)}`;
    const mp4 = path.join(opt.out, `${base}.mp4`);
    try {
      execFileSync("curl", ["-sL", "-o", mp4, u], { timeout: 180000 });
      const entry = { file: `${base}.mp4`, duration_s: dur, url: u };
      if (opt.frames) {
        spawnSync(FFMPEG, ["-y", "-v", "error", "-i", mp4, "-vf", "fps=1/4,scale=320:-1,tile=4x3", "-frames:v", "1",
          path.join(opt.out, `${base}-mosaic.jpg`)], { timeout: 120000 });
        entry.mosaic = `${base}-mosaic.jpg`;
      }
      if (opt.transcribe) {
        const tk = transcribeKey();
        if (tk) {
          // extrai áudio e manda pra API (OpenAI/Groq)
          const audio = path.join(opt.out, `${base}.mp3`);
          const ff = spawnSync(FFMPEG, ["-y", "-v", "error", "-i", mp4, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", audio], { timeout: 120000 });
          if (ff.status === 0 && fs.existsSync(audio)) {
            const r = spawnSync("curl", ["-s", tk.url, "-H", `Authorization: Bearer ${tk.key}`,
              "-F", `file=@${audio}`, "-F", `model=${tk.model}`, "-F", "response_format=text"],
              { encoding: "utf8", timeout: 180000, maxBuffer: 20 * 1024 * 1024 });
            const out = (r.stdout || "").trim();
            if (out && !out.startsWith("{")) {
              fs.writeFileSync(path.join(opt.out, `${base}.txt`), out);
              entry.transcript = `${base}.txt`;
            } else {
              entry.transcript_error = (out || "sem resposta da API").slice(0, 200);
            }
            try { fs.unlinkSync(audio); } catch (_) {}
          }
        } else if (fs.existsSync(WHISPER)) {
          const args = [mp4, "--model", "small", "--output_format", "txt", "--output_dir", opt.out];
          if (opt.lang !== "auto") args.push("--language", opt.lang);
          spawnSync(WHISPER, args, { timeout: 600000 });
          entry.transcript = `${base}.txt`;
        } else {
          entry.transcript_skipped = "sem API key e sem Whisper local";
        }
      }
      index.push(entry);
      console.log(`✓ ${base}.mp4 (${dur}s)`);
    } catch (e) {
      console.log(`✗ ${dur}s: ${e.message}`);
    }
  }
  fs.writeFileSync(path.join(opt.out, "video-index.json"), JSON.stringify(index, null, 2));
  console.log(`\n→ ${index.length} vídeos em ${opt.out} (índice em video-index.json)`);
  console.log(`De-para com os ads: case "duration_s" com o "video_duration" dos cards no spy-ads.json.`);
})();
