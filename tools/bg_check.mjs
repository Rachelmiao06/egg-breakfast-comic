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
//   RECORD=1 DUR=85 node tools/bg_check.mjs <outDir> [base] 1440x900   → 连续滚动录屏（screencast 帧 → ffmpeg mp4）
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
// SHOTS_ONLY="名字:节拍:p,..."：只截这些点（不做全程采样），用来逐帧看换场
const SHOTS_ONLY = process.env.SHOTS_ONLY ? Object.fromEntries(process.env.SHOTS_ONLY.split(",").map((t) => { const [n, b, p] = t.split(":"); return [n, at(b, +p)]; })) : null;

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
  const img=eggs[0]; let wrap=img&&img.parentElement; if(wrap&&wrap.classList.contains('inset-0')) wrap=wrap.parentElement; // 蛋图外面多了一层表演用的 div，取真正带站点位移的外层
  let op=1; for(let e=wrap;e&&e!==document.body;e=e.parentElement){op*=+getComputedStyle(e).opacity;}
  const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1)}};
  const W=r(wrap);
  const top=document.querySelector('[data-bg-line="top"]'), edge=document.querySelector('[data-bg-line="edge"]');
  const table=document.querySelector('[data-bg="table"]');
  const rim=document.querySelector('[data-bg-line="bowl-rim"]'), bowl=document.querySelector('[data-bg="bowl"]');
  const hud=document.querySelector('[data-hud]');
  const actors=[...document.querySelectorAll('[data-actor]')].map(e=>e.style.transform);
  const egg2=[...document.images].filter(i=>i.src.includes('egg.webp')).length;
  return {eggCount:eggs.length, eggOpacity:+op.toFixed(3), egg:W, foot:W&&+(W.y+W.h).toFixed(1), cx:W&&+(W.x+W.w/2).toFixed(1),
    topY:top?+top.getBoundingClientRect().y.toFixed(1):null, edgeY:edge?+edge.getBoundingClientRect().y.toFixed(1):null,
    tableOpacity:table?+getComputedStyle(table).opacity:0, actors, rimY:rim?+rim.getBoundingClientRect().y.toFixed(1):null, bowlOpacity:bowl?+getComputedStyle(bowl).opacity:0, hud:hud?hud.innerText.replace(/\\n/g,' | '):null, vw:innerWidth, vh:innerHeight, vhNow:+(scrollY/innerHeight*100).toFixed(1)};
})()`;

const go = async (vh, settle = 700) => {
  await evalJs(`window.scrollTo(0, ${vh / 100} * innerHeight)`);
  await sleep(settle);
};
const beatOf = (vh) => { let b = beats[0]; for (const x of beats) if (vh >= starts[x.id]) b = x; return { id: b.id, p: (vh - starts[b.id]) / b.lengthVh }; };
// 蛋在桌沿：drop 落定（动作阶段 0.15+0.6 = 0.75 之后，留 0.05 余量）→ catch 起跳（enter 0.22）之前
// 蛋在桌沿且应在画面里：drop 落桌 → hear 中段，以及 catch 18% → 起跳；hear 结尾到 catch 开头是 listen 停顿，镜头故意让蛋出画
const onTable = (vh) => (vh >= at("drop", 0.8) && vh <= at("hear", 0.5)) || (vh >= at("catch", 0.18) && vh <= at("catch", 0.2));
const afterHandoff = (vh) => vh >= at("handoff", 0.36);
const inTablecall = (vh) => vh >= starts.tablecall && vh < starts.search;

if (process.env.RECORD) {
  const [w, h] = sizes[0];
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${base}/preview/background?clean=1` });
  await sleep(5000);
  // FROM / TO（vh）：只录一段（TO < FROM 为倒滚）；先跳到起点再开始录
  const FROM = process.env.FROM !== undefined ? +process.env.FROM : 0;
  const TO = process.env.TO !== undefined ? +process.env.TO : total;
  if (FROM > 0) { await evalJs(`window.scrollTo(0, ${FROM / 100} * innerHeight)`); await sleep(2500); }
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
  const seconds = +(process.env.DUR ?? 80);
  await evalJs(`new Promise(res => { const toPx = ${TO} / 100 * innerHeight, fromPx = ${FROM} / 100 * innerHeight; const dir = toPx >= fromPx ? 1 : -1;
    const pxPerMs = Math.abs(toPx - fromPx) / ${seconds * 1000}; let last = performance.now();
    const tick = (now) => { const dt = now - last; last = now; window.dispatchEvent(new WheelEvent('wheel', { deltaY: dir * pxPerMs * dt / 0.9, bubbles: true, cancelable: true }));
      if (dir > 0 ? scrollY < toPx - 2 : scrollY > toPx + 2) requestAnimationFrame(tick); else setTimeout(res, 2000); };
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
  const mp4 = `${out}/${process.env.NAME ?? `background-continuous-${w}x${h}`}.mp4`;
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", `${dir}/list.txt`, "-vf", "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "26", mp4], { cwd: process.cwd(), stdio: "inherit" });
  console.log(`frames ${frames.length}, span ${(frames.at(-1) - frames[0]).toFixed(1)} s → ${mp4} (ffmpeg ${r.status})`);
  rmSync(dir, { recursive: true, force: true });
  ws.close(); chrome.kill();
  process.exit(r.status ?? 0);
}

if (process.env.FLIGHT) {
  // 接蛋飞行逐帧检查：catch 动作阶段 p 0.22–0.80 = 飞行 0–1。每帧量蛋（中心、外接框）和接蛋格 p3e 的位置，
  // 换算成格内比例，检查：起跳在铲面右侧、x 不往回折、最后 30% 向左下落、蛋身不碰气泡、格内蛋身在 keepRightOf 以右、蛋在画面里。
  const bgj = JSON.parse(readFileSync(new URL("../src/app/preview/visual/backgrounds.json", import.meta.url), "utf8"));
  const PM = bgj.eggPath.panel;
  const ts = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1];
  const named = { 0: "1-launch", 0.3: "2-cross", 0.6: "2b-apex", 0.85: "3-descend", 1: "4-land" };
  const FM = `(() => { const egg=document.querySelector('img[data-active-egg]'); const pan=[...document.images].find(i=>i.src.includes('p3e'));
    const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}};
    let wrap=egg&&egg.parentElement; if(wrap&&wrap.classList.contains('inset-0')) wrap=wrap.parentElement;
    let op=1; for(let e=wrap;e&&e!==document.body;e=e.parentElement){op*=+getComputedStyle(e).opacity;}
    // 场景舞台（SceneStage 内层 1536×1024，transform = translate + scale）：屏幕坐标 → 场景坐标，排除镜头移动的影响
    const st=[...document.querySelectorAll('div')].find(d=>d.style.width==='1536px'&&d.style.transform.includes('scale('));
    const M=new DOMMatrix(getComputedStyle(st).transform); const toS=(b)=>b&&({x:(b.x-M.e)/M.a,y:(b.y-M.f)/M.a,w:b.w/M.a,h:b.h/M.a});
    // 脚底点精确值：wrap 以 (50%, 100%) 为变换原点，所以脚底 = 布局位置 (left + w/2, top + h) + 变换平移 + FollowMid 的 translate
    const WM=new DOMMatrix(getComputedStyle(wrap).transform); const fm=(getComputedStyle(wrap.parentElement).translate||'0px 0px').split(' ').map(parseFloat);
    const foot={x:wrap.offsetLeft+wrap.offsetWidth/2+WM.e+(fm[0]||0), y:wrap.offsetTop+wrap.offsetHeight+WM.f+(fm[1]||0)};
    // 蛋身（不含旋转后图片外接框的透明角）：以脚底为基准、宽 = 388 × 当前缩放，取 80% 宽、85% 高
    const sc=Math.hypot(WM.a,WM.b), bw=388*sc; const body={x:foot.x-bw*0.4,y:foot.y-bw*0.85,w:bw*0.8,h:bw*0.85};
    const panelZ=pan?+getComputedStyle(pan.parentElement).zIndex:0, eggZ=+getComputedStyle(wrap.parentElement).zIndex;
    return {foot, body, panelZ, eggZ, egg:toS(r(egg)), wrap:toS(r(wrap)), panel:toS(r(pan)), eggScreen:r(egg), panelOp: pan?+getComputedStyle(pan).opacity:0, eggOp:op, eggs:document.querySelectorAll('img[src*="egg.webp"]').length, vw:innerWidth, vh:innerHeight}; })()`;
  const all = {};
  const ffails = [];
  for (const [w, h] of sizes) {
    const key = `${w}x${h}`;
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
    await send("Page.navigate", { url: `${base}/preview/background?guides=1` });
    await sleep(5000);
    await go(at("hear", 0.6), 1200);
    // 起跳前（catch 进入阶段，格子正在升起）：蛋可见、不被格子盖住
    const pre = [];
    for (const p of [0.05, 0.1, 0.15, 0.2]) {
      await go(at("catch", p), 700);
      const m = await evalJs(FM);
      const P0 = m.panel;
      const b = m.body; const covered = P0 && m.panelOp > 0.05 && m.panelZ > m.eggZ && b.x + b.w > P0.x && b.x < P0.x + P0.w && b.y + b.h > P0.y && b.y < P0.y + P0.h;
      pre.push({ p, covered: !!covered, eggOp: m.eggOp });
      if (p === 0.1) { const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 72 }); writeFileSync(`${out}/shots/flight-${key}-0-ready.jpg`, Buffer.from(shot.result.data, "base64")); }
    }
    const frames = [];
    for (const t of ts) {
      const vh = at("catch", 0.22 + 0.58 * t);
      await go(vh, t === 0 ? 1500 : 900);
      const m = await evalJs(FM);
      // 脚底中心 = wrap 底边中点（wrap 以脚底为缩放原点）；全部换算成场景坐标
      const c = m.foot;
      const P = m.panel; // 落铲前用最终位置的格子（格子在飞行 0.22–0.45 滑入，之前位置不稳定）
      frames.push({ t, foot: c, body: m.body, egg: m.egg, eggScreen: m.eggScreen, panel: P, panelOp: m.panelOp, eggOp: m.eggOp, eggs: m.eggs });
      if (named[t] !== undefined) {
        const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 72 });
        writeFileSync(`${out}/shots/flight-${key}-${named[t]}.jpg`, Buffer.from(shot.result.data, "base64"));
      }
    }
    const P = frames.at(-1).panel; // 落铲时格子已到位
    const fx = (x) => (x - P.x) / P.w, fy = (y) => (y - P.y) / P.h;
    const bub = { x0: P.x + PM.bubble[0] * P.w, x1: P.x + PM.bubble[1] * P.w, y0: P.y + PM.bubble[2] * P.h, y1: P.y + PM.bubble[3] * P.h };
    const res = { hiddenBeforeLaunch: pre.some((q) => q.covered || q.eggOp < 0.99), launchRightOfLand: frames[0].foot.x > frames.at(-1).foot.x + 1, monotonic: true, lateDownLeft: true, bubbleHit: false, minFx: 9, inView: true, eggCount: frames.every((f) => f.eggs === 1) };
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i], e = f.body;
      if (i > 0 && f.foot.x > frames[i - 1].foot.x + 2) res.monotonic = false;
      const ix0 = e.x, ix1 = e.x + e.w, iy0 = e.y, iy1 = e.y + e.h;
      const inPanel = f.t >= 0.2 && ix1 > P.x && ix0 < P.x + P.w && iy1 > P.y && iy0 < P.y + P.h;
      if (inPanel) { res.minFx = Math.min(res.minFx, fx(ix0)); if (ix1 > bub.x0 && ix0 < bub.x1 && iy1 > bub.y0 && iy0 < bub.y1) res.bubbleHit = true; }
      const es = f.eggScreen;
      if (es.x < -2 || es.x + es.w > w + 2 || es.y < -2 || es.y + es.h > h + 2) res.inView = false;
      f.fx = +fx(f.foot.x).toFixed(3); f.fy = +fy(f.foot.y).toFixed(3);
    }
    // 上升段（最高点之前）蛋身不压过铲面
    const BL = { x0: P.x + PM.blade[0] * P.w, x1: P.x + PM.blade[1] * P.w, y0: P.y + PM.blade[2] * P.h, y1: P.y + PM.blade[3] * P.h };
    const iap = frames.reduce((m, f, i) => (f.foot.y < frames[m].foot.y ? i : m), 0);
    res.ascentHitsBlade = frames.slice(0, iap).some((f) => { const e = f.body; return e.x + e.w > BL.x0 && e.x < BL.x1 && e.y + e.h > BL.y0 && e.y < BL.y1; });
    // 最高点之后：每帧向下且不向右（容差 2 场景像素）；整体下降方向来自右上方
    const ia = frames.reduce((m, f, i) => (f.foot.y < frames[m].foot.y ? i : m), 0);
    for (let i = ia + 1; i < frames.length; i++) if (frames[i].foot.y < frames[i - 1].foot.y - 2 || frames[i].foot.x > frames[i - 1].foot.x + 2) res.lateDownLeft = false;
    res.descentSlope = +((frames[ia].foot.x - frames.at(-1).foot.x) / Math.max(1, frames.at(-1).foot.y - frames[ia].foot.y)).toFixed(2);
    if (res.descentSlope < bgj.eggPath.minSlope) res.lateDownLeft = false;
    res.minFx = +res.minFx.toFixed(3);
    res.ok = !res.hiddenBeforeLaunch && !res.ascentHitsBlade && res.launchRightOfLand && res.monotonic && res.lateDownLeft && !res.bubbleHit && res.minFx >= PM.keepRightOf && res.inView && res.eggCount;
    if (!res.ok) ffails.push(`${key} ${JSON.stringify(res)}`);
    res.path = frames.map((f) => `${f.t}:${f.fx},${f.fy}`).join(" ");
    res.frames = frames.map((f) => ({ t: f.t, foot: [Math.round(f.foot.x), Math.round(f.foot.y)], body: [Math.round(f.body.x), Math.round(f.body.y), Math.round(f.body.w), Math.round(f.body.h)] }));
    res.blade = [Math.round(BL.x0), Math.round(BL.y0), Math.round(BL.x1), Math.round(BL.y1)];
    all[key] = res;
    console.log(key, JSON.stringify(res));
  }
  writeFileSync(`${out}/flight-check.json`, JSON.stringify(all, null, 1));
  console.log(ffails.length ? `FLIGHT FAIL ${ffails.length}\n${ffails.join("\n")}` : "FLIGHT OK");
  ws.close(); chrome.kill();
  process.exit(ffails.length ? 1 : 0);
}

const report = {};
const fails = [];
for (const [w, h] of sizes) {
  const key = `${w}x${h}`;
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  // REDUCED=1：模拟“减少动态效果”
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: process.env.REDUCED ? "reduce" : "no-preference" }] });
  await send("Page.navigate", { url: `${base}${process.env.ROUTE || "/preview/background"}${process.env.QUERY ? "?" + process.env.QUERY : ""}` });
  await sleep(5000);
  if (SHOTS_ONLY) {
    for (const [name, vh] of Object.entries(SHOTS_ONLY)) {
      await go(vh - 3, 300); await go(vh, 1400);
      const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
      writeFileSync(`${out}/shots/${key}-${name}.jpg`, Buffer.from(shot.result.data, "base64"));
    }
    console.log(key, "shots", Object.keys(SHOTS_ONLY).length);
    continue;
  }
  const samples = [];
  const stat = { samples: 0, eggCountBad: 0, eggAfterHandoff: 0, bowlChecks: 0, bowlBad: 0, tableChecks: 0, tableBad: 0, footMin: Infinity, footMax: -Infinity, bgSeq: [] };
  // REVERSE=1：从结尾往开头倒着滚；JUMPS=n：在全程随机跳 n 次（快速跳段）
  let order = [];
  for (let vh = 0; vh <= total; vh += step) order.push(vh);
  if (process.env.REVERSE) order.reverse();
  if (process.env.JUMPS) { let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); order = Array.from({ length: +process.env.JUMPS }, () => Math.round(rnd() * total)); }
  for (const vh of order) {
    await go(vh, 350);
    const m = await evalJs(MEASURE);
    const b = beatOf(vh);
    const bg = m.hud?.match(/后景 (\S+)/)?.[1] ?? "?";
    if (stat.bgSeq.at(-1) !== bg) stat.bgSeq.push(bg);
    stat.samples++;
    if (process.env.REDUCED && m.actors.some((t) => !/rotate\(0(\.00)?deg\)/.test(t))) fails.push(`${key} ${vh}vh: actor moves under reduced motion ${m.actors.join(" ")}`);
    if (m.eggCount !== 1) { stat.eggCountBad++; fails.push(`${key} ${vh}vh ${b.id}: ${m.eggCount} egg elements`); }
    if (inTablecall(vh) && m.eggOpacity > 0.05) {
      stat.bowlChecks++;
      const inView = m.egg.x >= 0 && m.egg.x + m.egg.w <= m.vw && m.egg.y >= 0 && m.foot <= m.vh;
      // 碗和碗里的蛋一起淡入淡出（curves.bowl 与 Egg inBowl 同步）：碗至少和蛋一样实（差 ≤ 0.15），且蛋脚在碗前沿之下
      const inBowl = m.bowlOpacity >= m.eggOpacity - 0.15 && m.rimY !== null && m.foot > m.rimY;
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
  for (const [name, vh] of Object.entries(process.env.REVERSE || process.env.JUMPS || process.env.REDUCED ? {} : SHOTS)) {
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
