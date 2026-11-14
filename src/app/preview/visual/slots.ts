"use client";
/**
 * 素材槽位（数据在 slots.json）。换图只改 slots.json；比例按图片实际尺寸自动读取。
 * 接蛋 / 饭碗的落点 = 格子 box + 格内相对位置 land，可在 ?debug=1 的定位点编辑器里现场微调。
 */
import { createContext, useContext } from "react";
import type { EggAnchors } from "@/components/kitchen/Egg";
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
export type SlotConfig = { scene: { catch: SceneSlot; bowl?: SceneSlot }; egg: { onSpatulaScale: number; inBowlScale: number } };

export const PANELS = data.panels as PanelSlot[];
export const DEFAULT_SLOTS: SlotConfig = { scene: data.scene as SlotConfig["scene"], egg: data.egg };

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
