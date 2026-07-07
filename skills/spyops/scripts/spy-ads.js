#!/usr/bin/env node
/**
 * SpyOps — raspa a Meta Ad Library pública (sem token, sem login).
 * Motor: Puppeteer (NUNCA Playwright — convenção da casa).
 *
 * Uso:
 *   node automacao/spyops/spy-ads.js --url "<URL completa da Ad Library>" --out analises/<slug>
 *   node automacao/spyops/spy-ads.js --q "concorrente.com" --out analises/<slug>
 *   node automacao/spyops/spy-ads.js --page-id 353858751328296 --out analises/<slug>
 *
 * Flags: --country BR · --status active|all|inactive · --max-scrolls 40
 *
 * Saídas em --out:
 *   spy-raw-innertext.txt   texto integral da página (fonte da verdade)
 *   spy-raw-hrefs.json      links externos capturados (destinos dos ads)
 *   spy-ads.json            cards parseados + agrupamento por copy + destinos
 *   spy-ads.md              resumo legível
 *
 * Rodar SEMPRE deste repo (puppeteer resolve de automacao/node_modules).
 */

const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { country: "BR", status: "active", maxScrolls: 40 };
  for (let i = 0; i < a.length; i++) {
    switch (a[i]) {
      case "--url": o.url = a[++i]; break;
      case "--q": o.q = a[++i]; break;
      case "--page-id": o.pageId = a[++i]; break;
      case "--country": o.country = a[++i]; break;
      case "--status": o.status = a[++i]; break;
      case "--out": o.out = a[++i]; break;
      case "--max-scrolls": o.maxScrolls = parseInt(a[++i]); break;
    }
  }
  if (!o.out) { console.error("Faltou --out <dir>"); process.exit(1); }
  if (!o.url) {
    if (o.q) {
      o.url = `https://www.facebook.com/ads/library/?active_status=${o.status}&ad_type=all&country=${o.country}&is_targeted_country=false&media_type=all&q=${encodeURIComponent(o.q)}&search_type=keyword_unordered&sort_data[direction]=desc&sort_data[mode]=total_impressions`;
    } else if (o.pageId) {
      o.url = `https://www.facebook.com/ads/library/?active_status=${o.status}&ad_type=all&country=${o.country}&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${o.pageId}&sort_data[direction]=desc&sort_data[mode]=total_impressions`;
    } else {
      console.error("Passe --url, --q ou --page-id"); process.exit(1);
    }
  }
  return o;
}

const PT_MONTHS = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const EN_MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function parseStarted(blk) {
  let m = blk.match(/Started running on\s+([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})/);
  if (m && EN_MONTHS[m[1]]) return `${m[3]}-${String(EN_MONTHS[m[1]]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = blk.match(/Veicula[cç][aã]o iniciada em\s+(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
  if (m && PT_MONTHS[m[2].slice(0, 3).toLowerCase()]) return `${m[3]}-${String(PT_MONTHS[m[2].slice(0, 3).toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

const CTA_RE = /\n(Order now|Book now|Reserve agora|Learn more|Learn More|Saiba mais|Request time|Solicitar hor[aá]rio|See details|Ver detalhes|Send WhatsApp message|Enviar mensagem(?: pelo WhatsApp)?|Sign up|Cadastre-se|Shop now|Comprar agora|Subscribe|Download|Get offer|Apply now|Contact us|Watch more)\n/;

function parseCards(text) {
  const blocks = text.split(/\n(?=(?:Library ID|Identifica[cç][aã]o da biblioteca):\s*\d+)/);
  const cards = [];
  for (const blk of blocks) {
    const mId = blk.match(/(?:Library ID|Identifica[cç][aã]o da biblioteca):\s*(\d+)/);
    if (!mId) continue;
    const mGrp = blk.match(/(\d+)\s+(?:ads use this creative and text|an[uú]ncios usam esse criativo)/);
    const mBody = blk.match(
      /\n(?:Sponsored|Patrocinado)\s*\n([\s\S]*?)(?=\n0:00 \/ |\nLow impression count|\n[A-Z0-9][A-Z0-9.\-]+\.[A-Z]{2,}\n|\nSorry,|(?=\n(?:Order now|Book now|Reserve agora|Learn more|Learn More|Saiba mais|See details|Sign up|Shop now|Subscribe|Download|Send WhatsApp message|Enviar mensagem)\n)|\n(?:Library ID|Identifica[cç][aã]o da biblioteca):|$)/
    );
    const mPage = blk.match(/\n([^\n]{2,80})\n(?:Sponsored|Patrocinado)\n/);
    const mCap = blk.match(/\n([A-Z0-9][A-Z0-9.\-]+\.[A-Z]{2,})\n/);
    const mVid = blk.match(/0:00 \/ (\d+:\d+)/);
    const mCta = blk.match(CTA_RE);
    cards.push({
      library_id: mId[1],
      started: parseStarted(blk),
      page_name: mPage ? mPage[1].trim() : "",
      group_size: mGrp ? parseInt(mGrp[1]) : 1,
      low_impressions: /Low impression count/.test(blk),
      primary_text: mBody ? mBody[1].trim() : "",
      video_duration: mVid ? mVid[1] : null,
      link_caption: mCap ? mCap[1] : "",
      cta_button: mCta ? mCta[1] : "",
      snapshot_url: `https://www.facebook.com/ads/library/?id=${mId[1]}`,
    });
  }
  return cards;
}

function summarize(cards) {
  const byBody = new Map();
  for (const c of cards) {
    const k = c.primary_text;
    if (!byBody.has(k)) byBody.set(k, []);
    byBody.get(k).push(c);
  }
  const groups = [...byBody.entries()]
    .map(([body, g]) => ({
      primary_text: body,
      cards: g.length,
      total_ads: g.reduce((s, c) => s + c.group_size, 0),
      pages: [...new Set(g.map((c) => c.page_name).filter(Boolean))],
      video_durations: [...new Set(g.map((c) => c.video_duration || "estático"))].sort(),
      ctas: [...new Set(g.map((c) => c.cta_button).filter(Boolean))],
      captions: [...new Set(g.map((c) => c.link_caption).filter(Boolean))],
      first_started: g.map((c) => c.started).filter(Boolean).sort()[0] || "",
      library_ids: g.map((c) => c.library_id),
      snapshot_url_sample: g[0].snapshot_url,
    }))
    .sort((a, b) => b.total_ads - a.total_ads);
  return groups;
}

function decodeDest(h) {
  try {
    if (h.includes("l.facebook.com/l.php")) {
      const u = new URL(h).searchParams.get("u");
      return u ? decodeURIComponent(u) : h;
    }
  } catch (_) {}
  return h;
}

(async () => {
  const opt = parseArgs();
  fs.mkdirSync(opt.out, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--lang=pt-BR"],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1440, height: 1800 });

  console.log(`Abrindo: ${opt.url}`);
  await page.goto(opt.url, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(4000);
  try { await page.click('[data-cookiebanner="accept_button"]'); await sleep(1500); } catch (_) {}
  try { await page.keyboard.press("Escape"); await sleep(800); } catch (_) {}

  let prev = 0, stable = 0;
  for (let i = 0; i < opt.maxScrolls; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(2200);
    const n = await page.evaluate(
      () => (document.body.innerText.match(/(?:Library ID|Identificação da biblioteca):\s*\d+/g) || []).length
    );
    process.stdout.write(`scroll ${i + 1}: ${n} cards\n`);
    if (n === prev) { if (++stable >= 4) break; } else stable = 0;
    prev = n;
  }

  const data = await page.evaluate(() => ({
    text: document.body.innerText,
    hrefs: Array.from(document.querySelectorAll("a[href]"))
      .map((a) => a.href)
      .filter((h) => h.includes("l.facebook.com/l.php") || (!h.includes("facebook.com") && h.startsWith("http"))),
  }));
  await browser.close();

  fs.writeFileSync(path.join(opt.out, "spy-raw-innertext.txt"), data.text);
  fs.writeFileSync(path.join(opt.out, "spy-raw-hrefs.json"), JSON.stringify(data.hrefs, null, 2));

  const cards = parseCards(data.text);
  const groups = summarize(cards);
  const dests = {};
  for (const h of data.hrefs) {
    const d = decodeDest(h).split("?")[0];
    if (d.includes("facebook.com") || d.includes("metastatus")) continue;
    dests[d] = (dests[d] || 0) + 1;
  }

  const out = {
    captured_at: new Date().toISOString(),
    source_url: opt.url,
    total_cards: cards.length,
    total_ads_with_groups: cards.reduce((s, c) => s + c.group_size, 0),
    destinations: dests,
    creative_groups: groups,
    cards,
  };
  fs.writeFileSync(path.join(opt.out, "spy-ads.json"), JSON.stringify(out, null, 2));

  const md = [
    `# SpyOps — Ad Library`,
    ``,
    `- **Fonte:** ${opt.url}`,
    `- **Capturado em:** ${out.captured_at}`,
    `- **Cards:** ${out.total_cards} · **Ads (com grupos):** ${out.total_ads_with_groups}`,
    ``,
    `## Destinos`,
    ...Object.entries(dests).sort((a, b) => b[1] - a[1]).map(([d, n]) => `- ${n}× ${d}`),
    ``,
    `## Criativos agrupados por copy (mais ads primeiro)`,
    ``,
  ];
  groups.forEach((g, i) => {
    md.push(`### #${i + 1} — ${g.total_ads} ads (${g.cards} cards) · ${g.pages.join(", ")}`);
    if (g.first_started) md.push(`- Primeiro start: ${g.first_started}`);
    if (g.video_durations.length) md.push(`- Formatos: ${g.video_durations.join(", ")}`);
    if (g.ctas.length) md.push(`- CTA: ${g.ctas.join(" / ")}`);
    if (g.captions.length) md.push(`- Destino exibido: ${g.captions.join(" / ")}`);
    md.push(`- Library IDs: ${g.library_ids.slice(0, 8).join(", ")}${g.library_ids.length > 8 ? "…" : ""}`);
    md.push("", "**Primary text:**", "", "> " + (g.primary_text || "_(sem texto)_").replace(/\n/g, "\n> "), "");
    md.push(`[Snapshot →](${g.snapshot_url_sample})`, "", "---", "");
  });
  fs.writeFileSync(path.join(opt.out, "spy-ads.md"), md.join("\n"));

  console.log(`\n→ ${out.total_cards} cards, ${groups.length} copies únicas`);
  console.log(`→ ${path.join(opt.out, "spy-ads.json")}`);
  console.log(`→ ${path.join(opt.out, "spy-ads.md")}`);
})();
