// Records the demo footage from the LIVE site with a scripted tour (real pages, real data, nothing mocked except a
// wallet stub that connects as an address which holds no Chog). Output: clips/<scene>.mp4 + clips/meta.json
//   node record.mjs            record every scene
//   node record.mjs s4 s7      record only these scenes
import { chromium } from "playwright-core";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const SITE = "https://chog-chaos-league.vercel.app";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const W = 1920, H = 1080;
const lines = JSON.parse(fs.readFileSync("lines.json", "utf8"));
const only = process.argv.slice(2);
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FPS = 24, STEP = 1000 / FPS;
let sleep = realSleep; // replaced per scene by the virtual-time sleep
const dur = (id) => parseFloat(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", `audio/${id}.wav`]).stdout.toString());
fs.mkdirSync("clips", { recursive: true });
const metaFile = "clips/meta.json";
const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : {};

/* ---------- overlay injected into every page: captions, chapter tag, visible cursor, click ripples ---------- */
const overlay = () => {
  const boot = () => {
    if (document.getElementById("demo-root")) return;
    const st = document.createElement("style");
    st.textContent = `
#demo-root{position:fixed;inset:0;pointer-events:none;z-index:2147483647;font-family:'Space Grotesk',system-ui,sans-serif}
#demo-cap{position:absolute;left:50%;bottom:40px;transform:translateX(-50%) translateY(10px);max-width:1240px;padding:14px 28px;background:rgba(14,9,28,.92);border:2px solid #836EF9;border-radius:20px;color:#F5F3FF;font-size:27px;font-weight:700;line-height:1.28;text-align:center;opacity:0;transition:opacity .25s,transform .25s;box-shadow:0 12px 40px rgba(0,0,0,.45)}
#demo-cap.on{opacity:1;transform:translateX(-50%)}
#demo-tag{position:absolute;left:36px;top:70px;padding:8px 18px;background:#FF8A3D;color:#0E091C;border-radius:999px;font-weight:800;font-size:17px;letter-spacing:.12em;text-transform:uppercase;opacity:0;transform:translateY(-8px);transition:opacity .3s,transform .3s;box-shadow:5px 5px 0 #0E091C}
#demo-tag.on{opacity:1;transform:none}
#demo-cursor{position:absolute;width:32px;height:32px;left:0;top:0;transform:translate(-4px,-2px);opacity:0;filter:drop-shadow(0 4px 6px rgba(0,0,0,.5))}
#demo-cursor.on{opacity:1}
.demo-ripple{position:absolute;width:20px;height:20px;border-radius:50%;border:4px solid #FF8A3D;transform:translate(-50%,-50%) scale(.3);animation:rip .6s ease-out forwards}
@keyframes rip{to{transform:translate(-50%,-50%) scale(3.2);opacity:0}}
.demo-pulse{outline:4px solid #FF8A3D !important;outline-offset:6px;border-radius:14px;animation:dp 1.1s ease-in-out infinite}
@keyframes dp{50%{outline-color:#836EF9;outline-offset:11px}}
html{scroll-behavior:auto !important}`;
    document.head.appendChild(st);
    const root = document.createElement("div");
    root.id = "demo-root";
    root.innerHTML = '<div id="demo-tag"></div><div id="demo-cap"></div><svg id="demo-cursor" viewBox="0 0 24 24"><path d="M3 2l17 8-7 2-3 8z" fill="#fff" stroke="#0E091C" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(root);
    const cur = root.querySelector("#demo-cursor");
    addEventListener("mousemove", (e) => { cur.classList.add("on"); cur.style.left = e.clientX + "px"; cur.style.top = e.clientY + "px"; }, true);
    addEventListener("mousedown", (e) => { const r = document.createElement("div"); r.className = "demo-ripple"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px"; root.appendChild(r); setTimeout(() => r.remove(), 700); }, true);
    window.__demo = {
      cap(t) { const c = root.querySelector("#demo-cap"); if (!t) { c.classList.remove("on"); return; } c.textContent = t; c.classList.add("on"); },
      tag(t) { const g = root.querySelector("#demo-tag"); if (!t) { g.classList.remove("on"); return; } g.textContent = t; g.classList.add("on"); },
      pulse(sel) { document.querySelectorAll(".demo-pulse").forEach((e) => e.classList.remove("demo-pulse")); if (sel) { const el = document.querySelector(sel); if (el) el.classList.add("demo-pulse"); } },
    };
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
};

/* A wallet stub: connects as an address that holds no Chog (the throwaway deployer wallet, which truly has none). */
const walletStub = () => {
  const ADDR = "0xEc027F254ADf6963D27a119750c1625128e30F65";
  let connected = false;
  window.ethereum = {
    request: async ({ method }) => {
      if (method === "eth_requestAccounts") { connected = true; return [ADDR]; }
      if (method === "eth_accounts") return connected ? [ADDR] : [];
      if (method === "eth_chainId") return "0x8f";
      if (method === "wallet_switchEthereumChain") return null;
      throw new Error("unsupported " + method);
    },
    on() {}, removeListener() {},
  };
};

/* ---------- cards (title, terminal, end) ---------- */
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Bowlby+One&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">';
const BASE_CSS = `*{box-sizing:border-box}body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#0E091C;color:#F5F3FF;font-family:'Space Grotesk',sans-serif}
.bg{position:absolute;inset:0;background:radial-gradient(1100px 700px at 15% -10%,rgba(131,110,249,.45),transparent 60%),radial-gradient(900px 600px at 95% 10%,rgba(255,138,61,.22),transparent 60%),radial-gradient(900px 600px at 50% 120%,rgba(0,245,255,.14),transparent 60%),#0E091C}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(131,110,249,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(131,110,249,.08) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(circle at 50% 40%,#000,transparent 75%)}
h1{font-family:'Bowlby One',Impact,sans-serif;font-weight:400;text-transform:uppercase;margin:0;line-height:1.02}
.hl{position:relative;display:inline-block;z-index:0}.hl:before{content:"";position:absolute;left:-2%;right:-2%;top:40%;bottom:4%;background:#ff2a2a;border-radius:999px;transform:rotate(-1.4deg);z-index:-1}`;

const titleHTML = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}
.wrap{position:absolute;left:110px;top:210px;width:1000px}
h1{font-size:104px;opacity:0;transform:translateY(40px)}
body.go .l1{animation:up .8s .5s cubic-bezier(.2,.9,.3,1) forwards}body.go .l2{animation:up .8s 3.1s cubic-bezier(.2,.9,.3,1) forwards}
.sub{margin-top:44px;font-size:34px;color:#b3a9d9;opacity:0}body.go .sub{animation:fade 1s 6.2s forwards}
.row{position:absolute;right:120px;top:130px;width:620px;height:820px}
.c{position:absolute;width:330px;height:330px;border-radius:34px;overflow:hidden;border:8px solid var(--c);box-shadow:14px 14px 0 rgba(0,0,0,.45);opacity:0;transform:scale(.4) rotate(0)}
.c img{width:100%;height:100%;object-fit:cover;display:block}
.c1{--c:#00f5ff;right:230px;top:0;} .c2{--c:#a6ff00;right:0;top:250px} .c3{--c:#836ef9;right:210px;top:480px}
body.go .c1{animation:pop .7s .2s cubic-bezier(.2,1.4,.4,1) forwards,bob 3.4s 1s ease-in-out infinite}
body.go .c2{animation:pop .7s .6s cubic-bezier(.2,1.4,.4,1) forwards,bob 3.4s 1.4s ease-in-out infinite}
body.go .c3{animation:pop .7s 1s cubic-bezier(.2,1.4,.4,1) forwards,bob 3.4s 1.8s ease-in-out infinite}
.wm{position:absolute;left:110px;top:60px;width:150px;opacity:0;border-radius:20px}body.go .wm{animation:fade .8s 0s forwards}
@keyframes up{to{opacity:1;transform:none}}@keyframes fade{to{opacity:1}}@keyframes pop{to{opacity:1;transform:scale(1) rotate(var(--r,-4deg))}}
@keyframes bob{50%{transform:translateY(-16px) rotate(2deg)}}</style></head><body><div class="bg"></div><div class="grid"></div>
<img class="wm" src="${SITE}/wordmark.png">
<div class="wrap"><h1 class="l1">Your Chog is not a picture.</h1><h1 class="l2" style="margin-top:34px">It is a creature<br>with a <span class="hl">career.</span></h1>
<div class="sub">1,969 Chog Genesis NFTs · one pixel meadow · Monad</div></div>
<div class="row"><div class="c c1"><img src="${SITE}/api/img/1049?w=512"></div><div class="c c2" style="--r:4deg"><img src="${SITE}/api/img/1557?w=512"></div><div class="c c3"><img src="${SITE}/api/img/7?w=512"></div></div>
</body></html>`;

const testsText = fs.existsSync("tests-output.txt") ? fs.readFileSync("tests-output.txt", "utf8") : "";
const testLines = testsText.split(/\r?\n/).filter((l) => l.startsWith("ok - ")).map((l) => l.slice(5));
const terminalHTML = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE_CSS}
.win{position:absolute;left:210px;top:120px;width:1500px;height:800px;border-radius:22px;background:#0b0716;border:2px solid #836EF9;box-shadow:0 30px 90px rgba(0,0,0,.6);overflow:hidden}
.bar{height:58px;background:#1a1233;display:flex;align-items:center;gap:12px;padding:0 24px}.bar i{width:18px;height:18px;border-radius:50%;display:block}
.bar span{margin-left:14px;color:#b3a9d9;font:700 22px 'JetBrains Mono',monospace}
.body{padding:30px 40px;font:500 25px/1.55 'JetBrains Mono',monospace}
.cmd{color:#F5F3FF;margin-bottom:12px}.cmd b{color:#3ddc97}
.ln{opacity:0;transform:translateX(-14px);transition:all .2s;white-space:nowrap}.ln.on{opacity:1;transform:none}
.ln em{color:#3ddc97;font-style:normal;font-weight:700}.ln.key.on{color:#FF8A3D;font-weight:700}
.sum{position:absolute;right:34px;top:8px;font:700 34px 'Bowlby One',sans-serif;color:#3ddc97;opacity:0;transition:opacity .5s}.sum.on{opacity:1}
</style></head><body><div class="bg"></div><div class="grid"></div>
<div class="win"><div class="bar"><i style="background:#ff5f56"></i><i style="background:#ffbd2e"></i><i style="background:#27c93f"></i><span>chog-chaos-league — npm test</span></div>
<div class="body"><div class="cmd"><b>$</b> npm test</div><div id="out"></div></div><div class="sum" id="sum">${testLines.length} / ${testLines.length} PASSING</div></div>
<script>window.reveal=(ms)=>{const out=document.getElementById('out');const L=${JSON.stringify(testLines)};L.forEach((t,i)=>{const d=document.createElement('div');d.className='ln'+(/non-owner|does not own/.test(t)?' key':'');d.innerHTML='<em>✔</em> '+t;out.appendChild(d);setTimeout(()=>d.classList.add('on'),i*ms)});setTimeout(()=>document.getElementById('sum').classList.add('on'),L.length*ms+200)}</script>
</body></html>`;

const endHTML = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>html{zoom:.8}${BASE_CSS}
.wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:30px;padding-bottom:230px}
.wm{width:560px;border-radius:30px;opacity:0;transform:scale(.85)}body.go .wm{animation:in .9s .1s cubic-bezier(.2,1.2,.4,1) forwards}
.roles{display:flex;gap:26px;opacity:0}body.go .roles{animation:in .8s 1.2s forwards}
.role{padding:18px 40px;border-radius:999px;font:400 40px 'Bowlby One',sans-serif;text-transform:uppercase;color:#0E091C}
.url{font:400 74px 'Bowlby One',sans-serif;color:#F5F3FF;opacity:0}body.go .url{animation:in .8s 2.2s forwards}
.meta{font:500 30px 'JetBrains Mono',monospace;color:#b3a9d9;opacity:0;line-height:1.7}body.go .meta{animation:in .8s 3s forwards}
.chogs{display:flex;gap:18px;opacity:0}body.go .chogs{animation:in .8s 3.6s forwards}.chogs img{width:110px;height:110px;border-radius:22px;border:4px solid #836EF9}
@keyframes in{to{opacity:1;transform:none}}</style></head><body><div class="bg"></div><div class="grid"></div>
<div class="wrap"><img class="wm" src="${SITE}/wordmark.png">
<div class="roles"><div class="role" style="background:#00f5ff">Character</div><div class="role" style="background:#FF8A3D">Key</div><div class="role" style="background:#a6ff00">Memory</div></div>
<div class="url">chog-chaos-league.vercel.app</div>
<div class="meta">github.com/victorhez/ChogChaosLeague<br>ChaosLedger on Monad · 0xa379…5143 · Built for Chogathon 2026</div>
<div class="chogs">${[1049, 7, 541, 1557, 25, 888, 1969].map((i) => `<img src="${SITE}/chogs/${i}.webp">`).join("")}</div></div>
</body></html>`;

/* ---------- helpers ---------- */
const state = { eventId: null };
async function glide(page, x, y, ms = 800) {
  const from = page.__m ?? { x: 960, y: 700 };
  const steps = Math.max(3, Math.round(ms / STEP));
  for (let i = 1; i <= steps; i++) {
    const p = i / steps, e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    await sleep(STEP);
  }
  page.__m = { x, y };
}
async function scrollTo(page, y, ms = 1200) {
  await page.evaluate(({ y, ms }) => new Promise((res) => {
    const s = scrollY, d = y - s, t0 = performance.now();
    const f = (t) => { const p = Math.min(1, (t - t0) / ms), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; scrollTo(0, s + d * e); p < 1 ? requestAnimationFrame(f) : res(); };
    requestAnimationFrame(f);
  }), { y, ms }).catch(() => {});
}
async function scrollToText(page, text, offset = 140, ms = 1300) {
  const y = await page.evaluate(({ text, offset }) => {
    const el = [...document.querySelectorAll("h1,h2,h3,.eyebrow,button,summary")].find((e) => e.textContent.includes(text));
    return el ? el.getBoundingClientRect().top + scrollY - offset : null;
  }, { text, offset }).catch(() => null);
  if (y !== null) await scrollTo(page, y, ms);
  return y !== null;
}
async function center(page, sel) {
  const r = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel).catch(() => null);
  return r;
}
async function clickSel(page, sel, ms = 900) {
  const c = await center(page, sel);
  if (!c) return false;
  await glide(page, c.x, c.y, ms);
  await sleep(150);
  await page.mouse.down(); await sleep(70); await page.mouse.up();
  return true;
}
async function clickText(page, tag, text, ms = 900) {
  const c = await page.evaluate(({ tag, text }) => { const el = [...document.querySelectorAll(tag)].find((e) => e.textContent.includes(text)); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, { tag, text }).catch(() => null);
  if (!c) return false;
  await glide(page, c.x, c.y, ms); await sleep(150); await page.mouse.down(); await sleep(70); await page.mouse.up();
  return true;
}
async function go(page, url, cur) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.evaluate(({ cap, tag }) => { window.__demo?.cap(cap); window.__demo?.tag(tag); }, cur ?? {}).catch(() => {});
  await page.mouse.move(page.__m?.x ?? 960, page.__m?.y ?? 700).catch(() => {});
  await sleep(350);
}

/* ---------- scenes ---------- */
const TAGS = {
  s2: "Live on Monad · every hour", s3: "Real traits → five genes", s4: "Provably fair · replay it", s5: "Seed = a Monad block hash",
  s6: "The key · only holders play", s7: "16 tests · all passing", s8: "The memory · career on-chain", s9: "Seasons · streaks · share cards", s10: "Remove the NFT · nothing works",
};

const scenes = [
  { id: "s1", full: true, head: 0.6, tail: 1.2, prep: async (p) => { await p.setContent(titleHTML, { waitUntil: "networkidle" }); }, run: async (p, c) => { await p.evaluate(() => document.body.classList.add("go")); } },

  { id: "s2", start: SITE + "/", run: async (p, c) => {
    await c.at(0.8); await c.tag(TAGS.s2);
    await c.at(1.6); await scrollTo(p, 540, 2600);
    await c.at(5.2); await scrollTo(p, await p.evaluate(() => document.querySelector(".arena")?.getBoundingClientRect().top + scrollY - 110 || 1200), 1800);
    await c.at(7.4);
    const r = await p.evaluate(() => { const b = document.querySelector(".arena canvas")?.getBoundingClientRect(); return b ? { l: b.left, t: b.top, w: b.width, h: b.height } : null; });
    if (r) {
      const px = (hx, hy) => ({ x: r.l + (hx / 480) * r.w, y: r.t + (hy / 270) * r.h });
      for (const [hx, hy] of [[150, 90], [270, 85], [390, 190]]) { const q = px(hx, hy); await glide(p, q.x, q.y, 1100); await sleep(500); }
      await c.at(11.6);
      const q = px(173, 86); await glide(p, q.x, q.y, 700); await sleep(200); await p.mouse.down(); await sleep(70); await p.mouse.up();
    }
  } },

  { id: "s3", start: SITE + "/chog/1049", run: async (p, c) => {
    await c.at(0.8); await c.tag(TAGS.s3);
    await c.at(2.0); await glide(p, 520, 760, 1400);
    await c.at(6.2); await scrollToText(p, "Traits become genes", 110, 1600); await p.evaluate(() => window.__demo.pulse(".tbl-wrap"));
    await c.at(10.5); await glide(p, 1100, 640, 1000); await glide(p, 1100, 800, 1600);
    await c.at(14.8); await p.evaluate(() => window.__demo.pulse(null)); await c.tag("Rare traits ★ · each gene capped at +30");
  } },

  { id: "s4", start: SITE + "/arena", run: async (p, c) => {
    await c.at(0.8); await c.tag(TAGS.s4);
    await c.at(1.8);
    const sel = (await center(p, ".feed .ev.hot")) ? ".feed .ev.hot" : ".feed .ev";
    await clickSel(p, sel, 1200);
    await p.waitForURL(/\/event\//, { timeout: 20000 }).catch(() => {});
    state.eventId = p.url().split("/event/")[1] ?? null; fs.writeFileSync("clips/event.txt", state.eventId ?? "");
    await p.waitForLoadState("networkidle").catch(() => {});
    await c.setTag(TAGS.s4);
    await c.at(6.2); await scrollToText(p, "Verify this result", 160, 1400);
    await c.at(8.6); await clickText(p, "button", "Replay", 1000);
    await c.at(13.2); await p.evaluate(() => window.__demo.pulse(".verdict"));
    await c.at(16.5); await scrollTo(p, await p.evaluate(() => scrollY - 120), 900);
  } },

  { id: "s5", prep: async (p) => { const ev = fs.existsSync("clips/event.txt") ? fs.readFileSync("clips/event.txt", "utf8").trim() : "r170-e0"; await go(p, `${SITE}/event/${ev}`); }, run: async (p, c) => {
    await c.at(0.8); await c.tag(TAGS.s5);
    await c.at(1.2); await scrollToText(p, "Inputs and seed", 130, 1400);
    await c.at(3.0); await clickText(p, "button", "Check seed against Monad", 1000);
    await c.at(5.0); await p.evaluate(() => window.__demo.pulse(".pill-mint"));
    await c.at(6.6); await c.tag("Fairness page · every formula public");
    await go(p, SITE + "/fairness");
    await c.at(7.4); await scrollTo(p, 1500, 2600);
  } },

  { id: "s6", start: SITE + "/play", init: walletStub, run: async (p, c) => {
    await c.at(0.8); await c.tag(TAGS.s6);
    await c.at(2.4); await clickSel(p, ".card-hard .btn-primary", 1200);
    await c.at(4.4); await p.evaluate(() => window.__demo.pulse(".card-hard"));
    await c.at(8.0); await c.tag("Wallet holds no Chog → cannot nudge");
    await glide(p, 960, 540, 1500);
    await c.at(12.5); await p.evaluate(() => window.__demo.pulse(null));
  } },

  { id: "s7", full: true, head: 0.6, prep: async (p) => { await p.setContent(terminalHTML, { waitUntil: "networkidle" }); }, run: async (p, c) => {
    await c.at(0.8); await c.tag(TAGS.s7);
    await c.at(1.2); await p.evaluate(() => window.reveal(300));
  } },

  { id: "s8", start: SITE + "/chog/1049", run: async (p, c) => {
    await c.at(0.8); await c.tag(TAGS.s8);
    await c.at(1.8); await scrollToText(p, "Career record", 110, 1600);
    await c.at(3.6); await p.evaluate(() => new Promise((res) => { const w = [...document.querySelectorAll(".tbl-wrap")].find((e) => e.textContent.includes("Proof")); if (!w) return res(); const s0 = w.scrollLeft, d = w.scrollWidth - w.clientWidth - s0, t0 = performance.now(); const f = (t) => { const q = Math.min(1, (t - t0) / 1400), e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2; w.scrollLeft = s0 + d * e; q < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); }));
    await c.at(5.4); const b = await center(p, "td a.pill-mint"); if (b) { await glide(p, b.x, b.y, 1200); await p.evaluate(() => window.__demo.pulse("td a.pill-mint")); }
    await c.at(9.0); await c.tag("ChaosLedger 0xa379…5143 · anchored tx 0x7915…f546");
    await c.at(13.0); await p.evaluate(() => window.__demo.pulse(null));
  } },

  { id: "s9", start: SITE + "/leaderboard", run: async (p, c) => {
    await c.at(0.8); await c.tag(TAGS.s9);
    await c.at(1.6); await scrollTo(p, 200, 2200);
    await c.at(4.4);
    const ev = fs.existsSync("clips/event.txt") ? fs.readFileSync("clips/event.txt", "utf8").trim() : "r170-e0";
    await go(p, `${SITE}/event/${ev}`);
    await c.at(5.8); await scrollToText(p, "Share this moment", 150, 1500);
    await c.at(7.8); await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => e.textContent.includes("Share to X")); b?.classList.add("demo-pulse"); });
  }, startBlank: false },

  { id: "s10", head: 0.8, tail: 3.6, start: SITE + "/", run: async (p, c) => {
    await c.at(0.8); await c.tag(TAGS.s10);
    await c.at(1.4); await scrollToText(p, "The delete-the-NFT test", 120, 1600); await p.evaluate(() => { const el = [...document.querySelectorAll("h3")].find((e) => e.textContent.includes("delete-the-NFT")); el?.closest(".card")?.classList.add("demo-pulse"); });
    await c.at(8.4); await c.tag(null);
    await p.setContent(endHTML, { waitUntil: "networkidle" }); await p.evaluate(overlay); await p.evaluate(() => document.body.classList.add("go"));
  } },
];

/* ---------- recorder: deterministic, frame-stepped capture ----------
 * The page clock is frozen (Playwright clock) and advanced one frame at a time; CSS animations/transitions are pinned to the same
 * virtual time; every frame is a screenshot. The result is smooth no matter how busy the machine is. */
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--force-device-scale-factor=1", "--hide-scrollbars"] });
const T0 = new Date("2026-10-15T10:00:00Z");

async function record(sc) {
  const id = sc.id, hasAudio = Boolean(lines[id]);
  const D = hasAudio ? dur(id) : 3;
  const head = sc.head ?? 0.8, tail = sc.tail ?? 1.0, T = head + D + tail;
  const frames = Math.ceil(T * FPS);
  const vp = sc.full ? { w: 1920, h: 1080, d: 1 } : { w: 1536, h: 864, d: 1.25 };
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.d });
  await ctx.addInitScript(overlay);
  if (sc.init) await ctx.addInitScript(sc.init);
  const page = await ctx.newPage();
  await page.clock.install({ time: T0 });
  const cur = { cap: "", tag: "" };
  const pageSet = (k, v) => { cur[k] = v ?? ""; return page.evaluate(({ k, v }) => window.__demo?.[k === "cap" ? "cap" : "tag"](v), { k, v: v ?? "" }).catch(() => {}); };

  // virtual clock for the scene script
  const V = { t: 0, waiters: [] };
  const vsleep = (ms) => new Promise((res) => V.waiters.push({ t: V.t + ms / 1000, res }));
  const flush = () => { V.waiters = V.waiters.filter((w) => (w.t <= V.t + 1e-9 ? (w.res(), false) : true)); };

  // page setup happens in real time (network), BEFORE the clock is frozen and frames start
  sleep = realSleep;
  if (sc.prep) { await sc.prep(page); await page.evaluate(overlay).catch(() => {}); }
  else if (sc.start) await go(page, sc.start);
  else await page.setContent("<body style='margin:0;background:#0E091C'></body>");
  await realSleep(600);
  await page.clock.pauseAt(new Date(T0.getTime() + 3600_000));
  sleep = vsleep;

  const dir = `frames/${id}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const c = { at: (s) => vsleep(Math.max(0, s - V.t) * 1000), tag: (v) => pageSet("tag", v), setTag: (v) => pageSet("tag", v) };

  const caps = [];
  if (hasAudio) {
    const sentences = lines[id].split(/(?<=[.!?:])\s+/);
    const words = sentences.map((x) => x.split(/\s+/).length), total = words.reduce((a, b) => a + b, 0);
    let acc = 0;
    sentences.forEach((x, i) => { const st = head + (acc / total) * D; acc += words[i]; const en = i === sentences.length - 1 ? head + D + 0.4 : head + (acc / total) * D; caps.push({ s: st, e: en, text: x.replace(/:$/, "…") }); });
  }
  const capTask = (async () => { for (const k of caps) { await c.at(k.s); await pageSet("cap", k.text); } await c.at(head + D + 0.45); await pageSet("cap", ""); })();
  // after a navigation the overlay is rebuilt; re-assert caption and tag
  const keep = setInterval(() => { page.evaluate(({ cap, tag }) => { if (window.__demo) { window.__demo.cap(cap); window.__demo.tag(tag); } }, cur).catch(() => {}); }, 300);

  let scriptDone = false;
  (async () => { try { await sc.run(page, c); } catch (e) { console.log(`  ! ${id}: ${String(e.message).split("\n")[0]}`); } scriptDone = true; })();

  for (let i = 0; i < frames; i++) {
    V.t = i / FPS;
    flush();
    await realSleep(12); // let the scene script issue its actions for this instant
    await page.clock.runFor(STEP).catch(() => {});
    await page.evaluate((t) => {
      for (const a of document.getAnimations()) { if (a.__v === undefined) a.__v = t; a.pause(); a.currentTime = t - a.__v; }
    }, V.t * 1000).catch(() => {});
    const buf = await page.screenshot({ type: "jpeg", quality: 90 }).catch(() => null);
    if (buf) fs.writeFileSync(`${dir}/${String(i).padStart(6, "0")}.jpg`, buf);
    else if (i > 0) fs.copyFileSync(`${dir}/${String(i - 1).padStart(6, "0")}.jpg`, `${dir}/${String(i).padStart(6, "0")}.jpg`);
    if (i % 48 === 0) console.log(`  ${id} frame ${i}/${frames}`);
  }
  V.t = T + 1; flush();
  clearInterval(keep);
  await ctx.close();

  const fade = `fade=t=in:st=0:d=0.3,fade=t=out:st=${(frames / FPS - 0.35).toFixed(2)}:d=0.35`;
  const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", `${dir}/%06d.jpg`, "-vf", `scale=${W}:${H},format=yuv420p,${fade}`, "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-r", String(FPS), `clips/${id}.mp4`], { stdio: "inherit" });
  if (r.status !== 0) throw new Error("ffmpeg failed for " + id);
  meta[id] = { T: frames / FPS, head, D, caps };
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
  console.log(`✔ ${id}  ${(frames / FPS).toFixed(1)}s  (${frames} frames)`);
}

for (const sc of scenes) {
  if (only.length && !only.includes(sc.id)) continue;
  try { await record(sc); } catch (e) { console.log("✖", sc.id, e.message); }
}
await browser.close();
