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
};
export type SlotConfig = {
  scene: { catch: SceneSlot; handoff?: HandoffSlot; bowl?: SceneSlot };
  /** onSpatulaTilt：停在铲面上的倾角（度，负 = 倒向左侧的妈妈，贴合铲面斜度）；flightLean：飞行中途额外前倾 */
  /** faces：表情图（飞行期待 fly / 落稳安心 rest），与 egg.webp 同画布同轮廓；null = 未交付，用原图 */
  egg: { onSpatulaScale: number; inBowlScale: number; onSpatulaTilt?: number; flightLean?: number; faces?: EggFaces };
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
export function handoffBox(cfg: SlotConfig): [number, number, number, number] | null {
  const h = cfg.scene.handoff;
  if (!h) return null;
  const e = landedEgg(cfg);
  const w = e.w / h.eggWidthFrac;
  const hh = (w * h.imageSize[1]) / h.imageSize[0];
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
