"use client";
/**
 * 后景换场（连续版）。全部数据在 backgrounds.json；正式图到位后只改那里的 src / srcPortrait，不改这个文件。
 *
 * 一条连续的后景，按故事顺序：
 *   厨房分层（KitchenLayers，只读）
 *   → 桌沿 + 纸面：<Paper/>，场景层 z = Z.paper，在近景物件之上、桌沿蛋之下。
 *       一个跟随主体层视差（--kl-mid-x/y，和蛋的 FollowMid 同一组变量）的整体：
 *       B1 桌沿带（table）在下，纸面（paper）在上，纸面下沿羽化到桌面上。蛋和桌沿因此锁在一起。
 *   → 饭桌：蛋交给漫画之后（curves.dinner），纸面 + 桌沿整体上移几十场景像素，露出更多桌面。
 *   → 寻找段外围：<HallwayBackdrop/> 里的 SearchSurround，页面层（fixed z-5，漫画之下），横版 / 竖版两张，
 *       进场时从右往左持续漂移（curves.hallwayDrift），像镜头转到家里另一处；淡出后露回饭桌。
 *   → 收尾：<HallwayBackdrop/> 里的 EndingSheet，干净暖米白平涂，盖住一切（含桌沿）。
 *
 * 规则：只改不透明度和位移；不卸载任何角色层（各层自己在不透明度≈0 时返回 null，蛋不受影响）；
 * 不画第二只蛋或锅；占位只用平涂色块，说明文字只在 ?debug=1 显示。
 * 导出名 Paper / HallwayBackdrop 不变，preview/visual/page.tsx 不需要改。
 */
import { useSyncExternalStore, type CSSProperties } from "react";
import { Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import { BG, curve, gNow } from "./motion.v2";
import { useViewport } from "./viewport";

type Keys = [string, number, number][];
type CurveName = keyof typeof BG.curves;
/** 读一条后景曲线（backgrounds.json curves） */
export const bgCurve = (name: CurveName, g: number) => curve(BG.curves[name] as Keys, g);

/** 当前各后景层的状态（预览 HUD 和无头检查也读它） */
export function backgroundState(g: number) {
  const paper = bgCurve("paper", g);
  const table = bgCurve("table", g);
  const hallway = bgCurve("hallway", g);
  const ending = bgCurve("ending", g);
  const name = ending > 0.5 ? "ending" : hallway > 0.5 ? "search" : table > 0.5 ? (bgCurve("dinner", g) < -1 ? "dinner-table" : "table-edge") : "kitchen";
  return { paper, table, hallway, ending, lift: bgCurve("dinner", g), drift: bgCurve("hallwayDrift", g) * BG.hallway.driftPct, name };
}

const SHOW = 0.001;

/** 纸面 + B1 桌沿带（场景层）。名字沿用 Paper，页面不用改。 */
export function Paper() {
  const { timeline: t } = useScene();
  const debug = useDebugFlag();
  const s = backgroundState(gNow(t));
  if (s.paper <= SHOW && s.table <= SHOW) return null;
  return (
    <div
      aria-hidden
      data-bg="table-group"
      className="pointer-events-none absolute left-0 top-0 h-full w-full"
      style={{ zIndex: Z.paper, translate: `var(--kl-mid-x, 0px) calc(var(--kl-mid-y, 0px) + ${s.lift.toFixed(2)}px)` }}
    >
      {s.table > SHOW && <TableBand opacity={s.table} debug={debug} />}
      {s.paper > SHOW && <PaperSheet opacity={s.paper} />}
    </div>
  );
}

/** 纸面：盖住厨房（灶台、锅、墙），下沿在 paper.edgeY 处羽化，露出桌面 */
function PaperSheet({ opacity }: { opacity: number }) {
  const { edgeY, feather, color } = BG.paper;
  return (
    <div
      data-bg="paper"
      className="absolute"
      style={{
        left: -400,
        top: -400,
        width: 1536 + 800,
        height: edgeY + 400,
        opacity,
        background: `linear-gradient(to bottom, ${color} 0, ${color} calc(100% - ${feather}px), ${transparent(color)} 100%)`,
      }}
    />
  );
}

/**
 * B1 桌沿带。正式图：table.src 铺满 table.showBox（场景像素）。占位：平涂色块。
 * 两条零高度标记线（data-bg-line="top" / "edge"）给无头检查量“蛋脚底是否在桌面上”。
 */
function TableBand({ opacity, debug }: { opacity: number; debug: boolean }) {
  const T = BG.table;
  const [x, y, w, h] = T.showBox;
  const P = T.placeholder;
  const band = (y0: number, y1: number, color: string): CSSProperties => ({ position: "absolute", left: 0, width: w, top: y0 - y, height: y1 - y0, background: color });
  return (
    <div data-bg="table" className="absolute" style={{ left: x, top: y, width: w, height: h, opacity }}>
      {T.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={T.src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" style={{ objectFit: "fill" }} />
      ) : (
        <>
          <div style={band(y, T.topY, P.paper)} />
          <div style={band(T.topY, T.edgeY, P.top)} />
          <div style={band(T.edgeY, T.faceY, P.face)} />
          <div style={band(T.faceY, y + h, P.below)} />
        </>
      )}
      <div data-bg-line="top" className="absolute left-0 h-0" style={{ top: T.topY - y, width: w }} />
      <div data-bg-line="edge" className="absolute left-0 h-0" style={{ top: T.edgeY - y, width: w, borderTop: debug ? "2px dashed rgba(180,60,40,.6)" : undefined }} />
      {debug && !T.src && (
        <span className="absolute rounded bg-white/75 px-2 py-1 font-mono text-[18px] text-[#5b4632]" style={{ left: 232 + 700, top: T.edgeY - y + 12 }}>
          {T.label}
        </span>
      )}
    </div>
  );
}

/** 寻找段外围 + 收尾（页面层，漫画之下）。名字沿用 HallwayBackdrop，页面不用改。 */
export function HallwayBackdrop() {
  const { timeline: t } = useScene();
  const debug = useDebugFlag();
  const s = backgroundState(gNow(t));
  return (
    <>
      {s.hallway > SHOW && <SearchSurround opacity={s.hallway} driftPct={s.drift} debug={debug} />}
      {s.ending > SHOW && <EndingSheet opacity={s.ending} />}
    </>
  );
}

/** B2 寻找段外围：浅色墙面 + 局部门框 + 纸白。横版 / 竖版按视口选；占位是平涂 */
function SearchSurround({ opacity, driftPct, debug }: { opacity: number; driftPct: number; debug: boolean }) {
  const H = BG.hallway;
  const vp = useViewport();
  // 视口宽高比低于 portraitBelow（竖屏、窄窗口 860×1000）用竖版，否则横版
  const portrait = vp.w / vp.h < H.portraitBelow;
  const src = portrait ? (H.srcPortrait ?? H.src) : H.src;
  const pad = H.driftPct;
  return (
    <div aria-hidden data-bg="search" className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" style={{ opacity, background: H.color }}>
      {/* 比视口左右各宽 driftPct%，漂移时不露边 */}
      <div className="absolute inset-y-0" style={{ left: `-${pad}%`, right: `-${pad}%`, transform: `translateX(${driftPct.toFixed(3)}vw)` }}>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" style={{ objectPosition: `${H.focus[0] * 100}% ${H.focus[1] * 100}%` }} />
        )}
      </div>
      {debug && !src && (
        <span className="absolute bottom-6 left-6 rounded bg-white/70 px-2 py-1 font-mono text-[12px] text-[#5b4632]">
          {H.label}（{portrait ? "竖版" : "横版"}，{H.status}）
        </span>
      )}
    </div>
  );
}

/** 收尾：干净暖米白平涂，盖住桌腿和木纹横带 */
function EndingSheet({ opacity }: { opacity: number }) {
  return <div aria-hidden data-bg="ending" className="pointer-events-none fixed inset-0 z-[5]" style={{ opacity, background: BG.ending.color }} />;
}

function transparent(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
}

function useDebugFlag() {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).has("debug"),
    () => false,
  );
}
