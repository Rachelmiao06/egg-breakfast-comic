/**
 * 前景故事：妈妈做荷包蛋早餐，五段（feat/comic-scroll）。
 *
 * 每段占一屏，是一组"带透明留白的不规则漫画"：几张小卡片 + 对话气泡，
 * 组与组之间、卡片之间都能看到后景活动的厨房。坐标全部是组盒（最大 960px 宽、
 * 一屏高、居中）的百分比：x / w 相对组宽，y 相对组高。
 *
 * 现在所有图都是占位（tools/make_placeholders.py 裁的），正式漫画由 ChatGPT 重画后
 * 只需换 `img` 和尺寸，布局/触发/接蛋位置都不用动。
 */
import manifest from "./placeholder-manifest.json";

export const PLACEHOLDER_DIR = "/assets/comic/placeholder/";
export type PlaceholderName = keyof typeof manifest;

export type CardSpec = {
  id: string;
  img: PlaceholderName;
  /** 组盒百分比：左上角 x（组宽）、y（组高）、宽 w（组宽） */
  x: number;
  y: number;
  w: number;
  rotate?: number;
  /** 水平翻转（让占位妈妈朝向正确的方向） */
  flip?: boolean;
  /** 透明底的人物图：不垫纸卡，只加一点投影 */
  cutout?: boolean;
  /** 占位说明（正式图上线后删） */
  label?: string;
};

export type BubbleSpec = {
  text: string;
  x: number;
  y: number;
  /** 最大宽（组宽百分比） */
  w?: number;
  /** 气泡尾巴的位置：bl 左下 / br 右下 / tl 左上 / tr 右上 */
  tail?: "bl" | "br" | "tl" | "tr";
};

export type SectionSpec = {
  /** 1–5，写进 useScene().activePanel */
  n: number;
  title: string;
  /** 这一段里厨房（后景）应该做什么，给集成会话看的备注 */
  kitchenNote: string;
  cards: CardSpec[];
  bubbles: BubbleSpec[];
  /** 第 3 段：妈妈视线的起点（组盒百分比），预览页用它画指向后景蛋的虚线 */
  gaze?: { x: number; y: number };
};

export function imgSize(name: PlaceholderName) {
  return manifest[name];
}

export const SECTIONS: SectionSpec[] = [
  {
    n: 1,
    title: "介绍鸡蛋、吐司、黄油",
    kitchenNote: "厨房继续运转，蛋自主循环跳；progress 已到 1，厨房略暗略虚。",
    cards: [
      { id: "s1-mom", img: "mom-point", x: 3, y: 12, w: 30, rotate: -2, cutout: true, label: "占位：妈妈指着食材" },
      { id: "s1-egg", img: "prop-eggshell", x: 44, y: 18, w: 24, rotate: 2, label: "鸡蛋" },
      { id: "s1-toast", img: "prop-toast", x: 60, y: 44, w: 34, rotate: -1.5, label: "吐司" },
      { id: "s1-butter", img: "prop-butter", x: 40, y: 56, w: 13, rotate: 3, label: "黄油" },
    ],
    bubbles: [{ text: "今天做荷包蛋早餐。鸡蛋、吐司、黄油，就这三样。", x: 28, y: 3, w: 46, tail: "bl" }],
  },
  {
    n: 2,
    title: "放黄油、打蛋，开始煎",
    kitchenNote: "镜头逐渐靠近后景平底锅（厨房按 activePanel=2 做轻推近）。",
    cards: [
      { id: "s2-pan", img: "prop-pan", x: 2, y: 50, w: 54, rotate: 1, label: "占位：锅里化黄油" },
      { id: "s2-butter", img: "prop-butter", x: 34, y: 34, w: 11, rotate: -10, label: "黄油" },
      { id: "s2-mom", img: "mom-wink", x: 64, y: 10, w: 24, rotate: 2, cutout: true, label: "占位：妈妈打蛋" },
    ],
    bubbles: [{ text: "黄油化开，磕一个蛋——开始煎。", x: 56, y: 62, w: 38, tail: "tr" }],
  },
  {
    n: 3,
    title: "发现蛋在跳",
    kitchenNote: "妈妈视线指向后景的蛋；左半屏留空给厨房的蛋。厨房蛋进入「等待起跳」。",
    cards: [{ id: "s3-mom", img: "mom-surprised", x: 58, y: 40, w: 38, rotate: -2, cutout: true, label: "占位：妈妈看向蛋" }],
    bubbles: [{ text: "诶，你怎么还跳起来了？", x: 54, y: 20, w: 40, tail: "bl" }],
    gaze: { x: 68, y: 52 },
  },
  {
    n: 4,
    title: "伸锅铲：好啦，过来",
    kitchenNote: "滚动控制飞行：蛋离开后景，沿弧线放大、越过漫画边缘，落到锅铲接触点（见 catch-point.ts）。",
    cards: [{ id: "s4-mom", img: "mom-board", x: 70, y: 36, w: 30, cutout: true, label: "占位：妈妈伸锅铲（板子=锅铲站位）" }],
    bubbles: [{ text: "好啦，过来。", x: 70, y: 18, w: 28, tail: "bl" }],
  },
  {
    n: 5,
    title: "端出早餐",
    kitchenNote: "蛋已在前景；厨房安静下来（火小、泡少、蒸汽慢）。",
    cards: [
      { id: "s5-breakfast", img: "prop-breakfast", x: 8, y: 24, w: 40, rotate: -1.5, label: "占位：蛋放到吐司上" },
      { id: "s5-mom", img: "mom-rest", x: 58, y: 40, w: 24, rotate: 1, cutout: true, label: "占位：妈妈" },
    ],
    bubbles: [{ text: "来，吃饭啦。", x: 54, y: 22, w: 30, tail: "bl" }],
  },
];
