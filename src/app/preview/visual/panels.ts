/**
 * 每段前景漫画的版位（试验值，1440×900 为基准，单位 vw / vh）。
 * kind "img" = 已有完整漫画（public/assets/comic-v2，原图未改，只是按格切出的副本）；
 * kind "ph"  = 明确标记的占位格（缺图）。
 * from = 进入方向；"seam" = 接缝转场小样。
 */
export type PanelSpec = {
  key: string;
  beat: string;
  kind: "img" | "ph" | "head";
  src?: string;
  label?: string;
  x: number; // vw
  y: number; // vh
  w: number; // vw
  aspect: number; // 宽 / 高
  from: "left" | "right" | "top" | "bottom" | "seam";
  /** 原图没有画框的完整漫画：网页补一圈纸白 + 墨线框，和其他格一致 */
  frame?: boolean;
};

const C = "/assets/comic-v2/";
export const PANELS: PanelSpec[] = [
  { key: "bag", beat: "bag", kind: "ph", label: "占位 B1 · 取买菜袋，有点累\n妈妈提着买菜袋进门，略显疲惫", x: 6, y: 11, w: 40, aspect: 4 / 3, from: "seam" },
  { key: "prepare", beat: "prepare", kind: "ph", label: "占位 B2 · 准备配菜饭\n妈妈盛饭、摆好配菜", x: 54, y: 12, w: 40, aspect: 4 / 3, from: "right" },
  // 普通阅读：已有完整漫画，中景在上、手部近景在下偏右，两格错落叠放，把锅和跳蛋整块挡住（不半露）；
  // 厨房在左右两侧和底部露出，水壶蒸汽仍在动
  { key: "chop-medium", beat: "chop", kind: "img", src: C + "p1d-chop-medium.webp", x: 17, y: 3, w: 58, aspect: 1066 / 494, from: "left" },
  { key: "chop-hands", beat: "chop", kind: "img", src: C + "closeup-chop.webp", x: 31, y: 44, w: 41, aspect: 1536 / 1024, from: "bottom", frame: true },
  { key: "stirfry", beat: "stirfry", kind: "ph", label: "占位 B3 · 炒菜\n妈妈翻炒配菜", x: 61, y: 8, w: 35, aspect: 4 / 3, from: "top" },
  { key: "sauce", beat: "sauce", kind: "ph", label: "占位 B4 · 调汁\n妈妈在碗里调酱汁", x: 4, y: 48, w: 34, aspect: 4 / 3, from: "bottom" },
  { key: "missing", beat: "missing", kind: "ph", label: "占位 B5 · 觉得饭少点什么\n妈妈看着饭碗想\"好像少了点什么\"", x: 3, y: 9, w: 30, aspect: 4 / 3, from: "left" },
  // 发现跳蛋：肩后看空锅的宽条 + 抬眼惊讶，后景真锅里的蛋在跳
  { key: "notice-strip", beat: "notice", kind: "img", src: C + "notice-pan-strip.webp", x: 3, y: 6, w: 38, aspect: 2172 / 724, from: "left", frame: true },
  { key: "notice-head", beat: "notice", kind: "head", src: C + "head-up-surprised.webp", x: 5, y: 33, w: 22, aspect: 0.92, from: "bottom" },
  { key: "ending", beat: "ending", kind: "ph", label: "占位 B6 · \"宝宝，来吃饭啦\"\n妈妈端饭招呼女儿（不画婴儿）", x: 20, y: 12, w: 60, aspect: 16 / 9, from: "bottom" },
];
