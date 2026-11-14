"use client";
/**
 * 素材槽位（数据在 slots.json）。换图只改 slots.json；比例按图片实际尺寸自动读取。
 * 接蛋 / 饭碗的落点 = 格子 box + 格内相对位置 land，可在 ?debug=1 的定位点编辑器里现场微调。
 */
import { createContext, useContext } from "react";
import type { EggAnchors, EggFaces } from "@/components/kitchen/Egg";
import { ANCHORS } from "@/lib/scene";
import data from "./slots.json";

export type PanelSlot = {
  key: string;
  beat: string;
  kind?: "img" | "head";
  src?: string;
  source?: string;
  label?: string;
  dialogueInImage: boolean | null;
  frame?: boolean;
  x: number;
  y: number;
  w: number;
  aspect: number;
  from: "left" | "right" | "top" | "bottom" | "seam";
  /** 同一段里的进场先后（0 起），错开进入 */
  order?: number;
  /** 新版流动排版里不显示（例如 p5d：会提前揭示蛋，改由独立拟声字表达“妈！这里！”）；旧版 v1 照常 */
  hideInFlow?: boolean;
  /** 主次：hero 主镜头 / support 次要 / insert 过渡小格 / closeup 结尾独立特写 */
  role?: "hero" | "support" | "insert" | "closeup";
};
export type SceneSlot = {
  label: string;
  source?: string;
  dialogueInImage?: boolean;
  box: [number, number, number, number]; // x, y, w, h（场景像素）
  land: { fx: number; fy: number };
  src: string | null;
  frameSrc: string | null;
  occluderSrc: string | null;
  appearFlight?: [number, number];
};
/** 交接格：位置不写死，由活动蛋的位置和大小算出，让格里画的蛋与活动蛋重合 */
export type HandoffSlot = {
  label: string;
  src: string;
  source?: string;
  imageSize: [number, number];
  eggCenter: { fx: number; fy: number };
  eggWidthFrac: number;
  /** 画里那颗蛋的外轮廓宽 / 本格宽（含描边金边，不含手脚） */
  eggOutlineWidthFrac?: number;
  /** 画里那颗蛋的蛋黄中心（本格内比例）；配合 egg.yolkCenter 和交接缩放，让两颗蛋的蛋黄在交接点重合 */
  eggYolk?: { fx: number; fy: number };
};
export type SlotConfig = {
  scene: { catch: SceneSlot; handoff?: HandoffSlot; bowl?: SceneSlot };
  /** onSpatulaTilt：停在铲面上的倾角（度，负 = 倒向左侧的妈妈，贴合铲面斜度）；flightLean：飞行中途额外前倾 */
  /** faces：表情图（飞行期待 fly / 落稳安心 rest），与 egg.webp 同画布同轮廓；null = 未交付，用原图 */
  /** outlineWidthFrac：活动蛋外轮廓（含金边，不含伸出的手脚）宽 / 画布宽；yolkCenter：蛋黄中心在画布内的比例（都从 egg.webp 量出） */
  egg: { onSpatulaScale: number; inBowlScale: number; onSpatulaTilt?: number; flightLean?: number; faces?: EggFaces; outlineWidthFrac?: number; yolkCenter?: { fx: number; fy: number } };
  /** 运行时（page.tsx 按视口算）：接蛋镜头下可见的场景范围，交接格滑动以它为界 */
  view?: { x0: number; x1: number; y0: number; y1: number };
  /** 运行时：横版接蛋格放不下，已缩到可见宽度内（竖屏、窄窗口） */
  narrow?: boolean;
};

/** 活动蛋落在铲面上时的中心与宽度（场景像素）。蛋图 388×388，脚底在 land 点。 */
export function landedEgg(cfg: SlotConfig) {
  const lp = landPoint(cfg.scene.catch);
  const size = 388 * cfg.egg.onSpatulaScale;
  return { cx: lp.x, cy: lp.y - size / 2, w: size };
}
/** 交接段活动蛋要缩到的比例：外轮廓宽度与画里的蛋一致（交接点前后宽度不跳） */
export function handoffShrinkFor(cfg: SlotConfig): number | undefined {
  const h = cfg.scene.handoff;
  if (!h?.eggOutlineWidthFrac || !cfg.egg.outlineWidthFrac) return undefined;
  return h.eggOutlineWidthFrac / (h.eggWidthFrac * cfg.egg.outlineWidthFrac);
}
export function handoffBox(cfg: SlotConfig): [number, number, number, number] | null {
  const h = cfg.scene.handoff;
  if (!h) return null;
  const e = landedEgg(cfg);
  const w = e.w / h.eggWidthFrac;
  const hh = (w * h.imageSize[1]) / h.imageSize[0];
  const k = handoffShrinkFor(cfg);
  const yc = cfg.egg.yolkCenter;
  if (k !== undefined && yc && h.eggYolk) {
    // 交接时活动蛋以脚底（铲面落点）为轴缩到 k：此时它的蛋黄位置 = 脚底 + 缩小后的蛋黄偏移；让画里的蛋黄落在这里
    const lp = landPoint(cfg.scene.catch);
    const ew = e.w * k; // 缩小后的画布宽（画布近似正方形）
    const yx = lp.x + (yc.fx - 0.5) * ew, yy = lp.y - (1 - yc.fy) * ew;
    return [Math.round(yx - h.eggYolk.fx * w), Math.round(yy - h.eggYolk.fy * hh), Math.round(w), Math.round(hh)];
  }
  return [Math.round(e.cx - h.eggCenter.fx * w), Math.round(e.cy - h.eggCenter.fy * hh), Math.round(w), Math.round(hh)];
}

export const PANELS = data.panels as PanelSlot[];
export const DEFAULT_SLOTS: SlotConfig = { scene: data.scene as unknown as SlotConfig["scene"], egg: data.egg };

export const landPoint = (s: SceneSlot) => ({ x: Math.round(s.box[0] + s.land.fx * s.box[2]), y: Math.round(s.box[1] + s.land.fy * s.box[3]) });

export function eggAnchorsFrom(cfg: SlotConfig): Partial<EggAnchors> {
  return {
    panLaunch: ANCHORS.panLaunch,
    spatulaLand: landPoint(cfg.scene.catch),
    ...(cfg.scene.bowl ? { bowlLand: landPoint(cfg.scene.bowl) } : {}),
    eggOnSpatula: cfg.egg.onSpatulaScale,
    eggInBowl: cfg.egg.inBowlScale,
  };
}

export const SlotContext = createContext<{ cfg: SlotConfig; setCfg: (c: SlotConfig) => void }>({ cfg: DEFAULT_SLOTS, setCfg: () => {} });
export const useSlots = () => useContext(SlotContext);
