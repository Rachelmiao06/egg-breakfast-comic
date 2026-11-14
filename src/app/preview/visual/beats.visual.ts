/**
 * 预览路由的节拍表（新情节，试验值）。仍由唯一的 <ScrollDriver> 驱动，不是第二套节奏。
 * camera 是本路由的试验镜头参数（zoom / 焦点），不是标准。
 */
import type { Beat } from "@/lib/beats";

export type Cam = { x: number; y: number; zoom: number; at: { x: number; y: number } };
type VBeat = Beat & { camera: Cam };

const FULL: Cam = { x: 768, y: 560, zoom: 1, at: { x: 0.5, y: 0.55 } };
const mk = (b: Partial<VBeat> & Pick<VBeat, "id" | "n" | "title" | "lengthVh">): VBeat => ({
  pin: "prep",
  phases: { enter: 0.25, action: 0, hold: 0.6, exit: 0.15 },
  kitchenDim: [0.2, 0.2, 0.2],
  foreground: "",
  egg: "loop",
  audio: { loops: { room: 0.22, sizzle: 0.1 }, fades: [], oneshots: [] },
  seconds: {},
  camera: FULL,
  ...b,
});

export const VISUAL_BEATS: VBeat[] = [
  mk({ id: "opening", n: 0, title: "开场：活着的厨房", lengthVh: 120, pin: null, phases: { enter: 0, action: 0, hold: 0.7, exit: 0.3 }, kitchenDim: [0, 0, 0.15], audio: { loops: { room: 0.2, sizzle: 0.45 }, fades: [], oneshots: [] } }),
  mk({ id: "bag", n: 1, title: "取买菜袋，有点累", lengthVh: 150, phases: { enter: 0.3, action: 0, hold: 0.55, exit: 0.15 }, kitchenDim: [0.15, 0.2, 0.2] }),
  mk({ id: "prepare", n: 2, title: "准备配菜饭", lengthVh: 130 }),
  mk({ id: "chop", n: 3, title: "切菜", lengthVh: 150, audio: { loops: { room: 0.2, chop: 0.5, sizzle: 0.06 }, fades: [], oneshots: [] } }),
  mk({ id: "stirfry", n: 4, title: "炒菜", lengthVh: 130, audio: { loops: { room: 0.2, stirfry: 0.5, sizzle: 0.08 }, fades: [], oneshots: [{ sound: "stirfryIn", at: 0.25 }] } }),
  mk({ id: "sauce", n: 5, title: "调汁", lengthVh: 130, audio: { loops: { room: 0.2, sauce: 0.4, sizzle: 0.06 }, fades: [], oneshots: [] } }),
  mk({ id: "missing", n: 6, title: "觉得饭少点什么", lengthVh: 130 }),
  mk({
    id: "notice", n: 7, title: "听见跳蛋", lengthVh: 170, pin: "catch",
    phases: { enter: 0.2, action: 0.3, hold: 0.4, exit: 0.1 }, kitchenDim: [0.2, 0, 0],
    audio: { loops: { room: 0.18, sizzle: 0.6 }, fades: [{ sound: "sizzle", from: 0.1, to: 0.6, phase: "action" }], oneshots: [] },
    camera: { x: 735, y: 600, zoom: 1.25, at: { x: 0.6, y: 0.62 } },
  }),
  mk({
    id: "catch", n: 8, title: "伸铲接住", lengthVh: 200, pin: "catch", egg: "flight",
    phases: { enter: 0.2, action: 0.65, hold: 0.15, exit: 0 }, kitchenDim: [0, 0.06, 0.06],
    audio: { loops: { room: 0.18, sizzle: 0.3 }, fades: [{ sound: "sizzle", from: 0.3, to: 0.08, phase: "action" }], oneshots: [{ sound: "catch", at: 0.85 }] },
    seconds: { landSquash: 0.7 },
    camera: { x: 640, y: 690, zoom: 1.08, at: { x: 0.5, y: 0.6 } },
  }),
  mk({
    id: "bowl", n: 9, title: "放到饭上、淋汁、流黄", lengthVh: 160, pin: "bowl", egg: "serve",
    phases: { enter: 0.2, action: 0.5, hold: 0.3, exit: 0 }, kitchenDim: [0.06, 0.15, 0.15],
    audio: { loops: { room: 0.2 }, fades: [{ sound: "sizzle", from: 0.08, to: 0, phase: "enter" }], oneshots: [{ sound: "bowlDown", at: 0.7 }] },
    seconds: { bowlSettle: 0.6 },
    camera: { x: 761, y: 790, zoom: 1.1, at: { x: 0.5, y: 0.6 } },
  }),
  mk({ id: "ending", n: 10, title: "宝宝，来吃饭啦", lengthVh: 140, pin: "bowl", egg: "bowl", phases: { enter: 0.3, action: 0, hold: 0.7, exit: 0 }, kitchenDim: [0.15, 0.25, 0.25], audio: { loops: { room: 0.2 }, fades: [], oneshots: [] } }),
];

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
/** 当前镜头：进入阶段从上一段镜头缓入本段（sine.inOut），其余阶段停在本段 */
export function cameraAt(index: number, phase: string, phaseP: number): Cam {
  const cur = VISUAL_BEATS[index].camera;
  const prev = index > 0 ? VISUAL_BEATS[index - 1].camera : cur;
  const k = phase === "enter" ? ease(phaseP) : 1;
  const lerp = (a: number, b: number) => a + (b - a) * k;
  return { x: lerp(prev.x, cur.x), y: lerp(prev.y, cur.y), zoom: lerp(prev.zoom, cur.zoom), at: { x: lerp(prev.at.x, cur.at.x), y: lerp(prev.at.y, cur.at.y) } };
}
