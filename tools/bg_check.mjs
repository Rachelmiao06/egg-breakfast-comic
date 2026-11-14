#!/usr/bin/env node
// 后景无头检查（headless Chrome over CDP，不依赖 puppeteer）。
// 对每个视口，从头到尾按固定步长滚过 /preview/background，每个采样点量：
//   - 蛋元素个数（img[src*="egg.webp"]，必须始终 = 1）
//   - 交接之后（handoff 进入阶段结束起）蛋是否完全不可见；唯一例外是环境段 tablecall（碗里的蛋），
//     这时蛋必须在 B3 碗里（碗不透明度 ≥ 0.9，脚底在碗前沿线之下 = 被前沿遮挡层挡住）
//   - 蛋在桌沿时（drop 落桌后 → catch 起跳前）脚底是否落在桌面上（B1 的 top 线 ≤ 脚底 ≤ edge 线）且整只蛋在视口内
//   - 当前后景名（HUD）
// 并在关键点截图。usage:
//   node tools/bg_check.mjs <outDir> [base] [sizes] [stepVh]
//   RECORD=1 node tools/bg_check.mjs <outDir> [base] 1440x900   → 连续滚动录屏（screencast 帧 → ffmpeg mp4）
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = process.argv[2] ?? "notes/background-scenes";
const base = process.argv[3] ?? "http://localhost:3008";
const sizes = (process.argv[4] ?? "1600x900,1440x900,1024x768,860x1000,390x844").split(",").map((s) => s.split("x").map(Number));
const step = +(process.argv[5] ?? 5);
mkdirSync(`${out}/shots`, { recursive: true });

const beats = JSON.parse(readFileSync(new URL("../src/app/preview/visual/beats.visual-v2.json", import.meta.url), "utf8")).beats;
const starts = {};
let acc = 0;
for (const b of beats) { starts[b.id] = acc; acc += b.lengthVh; }
const total = acc;
const at = (id, p) => starts[id] + p * beats.find((b) => b.id === id).lengthVh;
const SHOTS = { opening: at("opening", 0.4), dropMid: at("drop", 0.45), tableLanded: at("drop", 0.95), bag: at("bag", 0.5), prejump: at("prejump", 0.6), hear: at("hear", 0.5), catchFlight: at("catch", 0.45), catchHold: at("catch", 0.92), handoff: at("handoff", 0.6), bowl: at("bowl", 0.8), call: at("call", 0.95), tablecall: at("tablecall", 0.6), tablecallOut: at("tablecall", 0.93), search: at("search", 0.6), eggcall: at("eggcall", 0.5), return: at("return", 0.6), punchline: at("punchline", 0.5), closeup: at("closeup", 0.8) };

const port = 9481;
// Chrome 配置目录放系统临时目录，不放进仓库（否则 eslint 会扫到里面的 JS）
const profile = mkdtempSync(join(tmpdir(), "bg-check-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "--mute-audio", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let list;
for (let i = 0; i < 150; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.some((t) => t.type === "page")) break; } catch {} await sleep(200); }
const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method) listeners.forEach((f) => f(d)); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
await send("Page.enable");
await send("Runtime.enable");

const MEASURE = `(() => {
  const eggs=[...document.images].filter(i=>i.src.includes('egg.webp'));
  const img=eggs[0], wrap=img&&img.parentElement;
  let op=1; for(let e=wrap;e&&e!==document.body;e=e.parentElement){op*=+getComputedStyle(e).opacity;}
  const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1)}};
  const W=r(wrap);
  const top=document.querySelector('[data-bg-line="top"]'), edge=document.querySelector('[data-bg-line="edge"]');
  const table=document.querySelector('[data-bg="table"]');
  const rim=document.querySelector('[data-bg-line="bowl-rim"]'), bowl=document.querySelector('[data-bg="bowl"]');
  const hud=document.querySelector('[data-hud]');
  return {eggCount:eggs.length, eggOpacity:+op.toFixed(3), egg:W, foot:W&&+(W.y+W.h).toFixed(1), cx:W&&+(W.x+W.w/2).toFixed(1),
    topY:top?+top.getBoundingClientRect().y.toFixed(1):null, edgeY:edge?+edge.getBoundingClientRect().y.toFixed(1):null,
    tableOpacity:table?+getComputedStyle(table).opacity:0, rimY:rim?+rim.getBoundingClientRect().y.toFixed(1):null, bowlOpacity:bowl?+getComputedStyle(bowl).opacity:0, hud:hud?hud.innerText.replace(/\\n/g,' | '):null, vw:innerWidth, vh:innerHeight, vhNow:+(scrollY/innerHeight*100).toFixed(1)};
})()`;

const go = async (vh, settle = 700) => {
  await evalJs(`window.scrollTo(0, ${vh / 100} * innerHeight)`);
  await sleep(settle);
};
const beatOf = (vh) => { let b = beats[0]; for (const x of beats) if (vh >= starts[x.id]) b = x; return { id: b.id, p: (vh - starts[b.id]) / b.lengthVh }; };
// 蛋在桌沿：drop 落定（动作阶段 0.15+0.6 = 0.75 之后，留 0.05 余量）→ catch 起跳（enter 0.22）之前
const onTable = (vh) => vh >= at("drop", 0.8) && vh <= at("catch", 0.2);
const afterHandoff = (vh) => vh >= at("handoff", 0.36);
const inTablecall = (vh) => vh >= starts.tablecall && vh < starts.search;

if (process.env.RECORD) {
  const [w, h] = sizes[0];
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${base}/preview/background?clean=1` });
  await sleep(5000);
  const dir = `${out}/frames`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  listeners.push((d) => {
    if (d.method !== "Page.screencastFrame") return;
    const n = frames.length;
    writeFileSync(`${dir}/${String(n).padStart(5, "0")}.jpg`, Buffer.from(d.params.data, "base64"));
    frames.push(d.params.metadata.timestamp);
    send("Page.screencastFrameAck", { sessionId: d.params.sessionId });
  });
  await send("Page.startScreencast", { format: "jpeg", quality: 72, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  await sleep(1500);
  // 连续滚动：页面内每帧用合成 wheel 事件推 Lenis（与真实滚轮同一路径），恒定速度
  const seconds = +(process.env.SECONDS ?? 80);
  await evalJs(`new Promise(res => { const totalPx = ${total} / 100 * innerHeight; const pxPerMs = totalPx / ${seconds * 1000}; let last = performance.now();
    const tick = (now) => { const dt = now - last; last = now; window.dispatchEvent(new WheelEvent('wheel', { deltaY: pxPerMs * dt / 0.9, bubbles: true, cancelable: true }));
      if (scrollY < totalPx - 2) requestAnimationFrame(tick); else setTimeout(res, 2500); };
    requestAnimationFrame(tick); })`);
  await send("Page.stopScreencast");
  await sleep(500);
  // 按真实时间戳写 concat 列表，保持原速
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const dur = i + 1 < frames.length ? frames[i + 1] - frames[i] : 0.04;
    lines.push(`file '${String(i).padStart(5, "0")}.jpg'`, `duration ${Math.max(0.001, dur).toFixed(4)}`);
  }
  writeFileSync(`${dir}/list.txt`, lines.join("\n") + "\n");
  const mp4 = `${out}/background-continuous-${w}x${h}.mp4`;
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", `${dir}/list.txt`, "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", mp4], { cwd: process.cwd(), stdio: "inherit" });
  console.log(`frames ${frames.length}, span ${(frames.at(-1) - frames[0]).toFixed(1)} s → ${mp4} (ffmpeg ${r.status})`);
  rmSync(dir, { recursive: true, force: true });
  ws.close(); chrome.kill();
  process.exit(r.status ?? 0);
}

const report = {};
const fails = [];
for (const [w, h] of sizes) {
  const key = `${w}x${h}`;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  await send("Page.navigate", { url: `${base}/preview/background` });
  await sleep(5000);
  const samples = [];
  const stat = { samples: 0, eggCountBad: 0, eggAfterHandoff: 0, bowlChecks: 0, bowlBad: 0, tableChecks: 0, tableBad: 0, footMin: Infinity, footMax: -Infinity, bgSeq: [] };
  for (let vh = 0; vh <= total; vh += step) {
    await go(vh, 350);
    const m = await evalJs(MEASURE);
    const b = beatOf(vh);
    const bg = m.hud?.match(/后景 (\S+)/)?.[1] ?? "?";
    if (stat.bgSeq.at(-1) !== bg) stat.bgSeq.push(bg);
    stat.samples++;
    if (m.eggCount !== 1) { stat.eggCountBad++; fails.push(`${key} ${vh}vh ${b.id}: ${m.eggCount} egg elements`); }
    if (inTablecall(vh) && m.eggOpacity > 0.05) {
      stat.bowlChecks++;
      const inView = m.egg.x >= 0 && m.egg.x + m.egg.w <= m.vw && m.egg.y >= 0 && m.foot <= m.vh;
      const inBowl = m.bowlOpacity >= 0.9 && m.rimY !== null && m.foot > m.rimY;
      if (!inView || !inBowl) { stat.bowlBad++; fails.push(`${key} ${vh}vh tablecall p${b.p.toFixed(2)}: egg foot ${m.foot}, bowl rim ${m.rimY}, bowl opacity ${m.bowlOpacity}, inView ${inView}`); }
    } else if (afterHandoff(vh) && !inTablecall(vh) && m.eggOpacity > 0.001) { stat.eggAfterHandoff++; fails.push(`${key} ${vh}vh ${b.id} p${b.p.toFixed(2)}: egg visible after handoff (opacity ${m.eggOpacity})`); }
    if (onTable(vh)) {
      stat.tableChecks++;
      // 脚底相对桌面（屏幕 px）：0 = 上沿，1 = 前缘
      const rel = (m.foot - m.topY) / (m.edgeY - m.topY);
      stat.footMin = Math.min(stat.footMin, rel);
      stat.footMax = Math.max(stat.footMax, rel);
      const inView = m.egg.x >= 0 && m.egg.x + m.egg.w <= m.vw && m.egg.y >= 0 && m.foot <= m.vh;
      const onTop = m.topY !== null && m.foot >= m.topY - 1 && m.foot <= m.edgeY + 1;
      if (!inView || !onTop) { stat.tableBad++; fails.push(`${key} ${vh}vh ${b.id}: egg foot ${m.foot} vs table ${m.topY}…${m.edgeY}, egg ${JSON.stringify(m.egg)}, inView ${inView}`); }
    }
    samples.push({ vh, beat: b.id, p: +b.p.toFixed(3), bg, ...m, hud: undefined });
  }
  for (const [name, vh] of Object.entries(SHOTS)) {
    await go(vh - 4, 300);
    await go(vh, 1600);
    const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
    writeFileSync(`${out}/shots/${key}-${name}.jpg`, Buffer.from(shot.result.data, "base64"));
  }
  stat.footMin = +stat.footMin.toFixed(3);
  stat.footMax = +stat.footMax.toFixed(3);
  report[key] = stat;
  writeFileSync(`${out}/samples-${key}.json`, JSON.stringify(samples, null, 1));
  console.log(key, JSON.stringify(stat));
}
writeFileSync(`${out}/check.json`, JSON.stringify({ report, fails }, null, 1));
console.log(fails.length ? `FAIL ${fails.length}\n` + fails.slice(0, 40).join("\n") : "ALL OK");
ws.close(); chrome.kill();
process.exit(fails.length ? 1 : 0);
