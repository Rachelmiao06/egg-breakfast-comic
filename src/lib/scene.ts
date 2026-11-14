/**
 * 场景坐标约定（所有分支共用）。
 * 厨房主图是 1536×1024，页面上所有厨房元素都用这个“场景像素”定位，
 * 由 <SceneStage> 统一做 cover 缩放。不要在组件里自己换算视口尺寸。
 */
export const SCENE_W = 1536;
export const SCENE_H = 1024;
/** cover 裁切时尽量保持在视口约 55% 高度处的那条线（锅和蛋附近）。 */
export const FOCUS_Y = 600;

/** 主图里关键区域（场景像素，feat/kitchen-layers 按分层结果实测，tools/split_scene.py 会打印这些值）。 */
export const ANCHORS = {
  /** 原画里跳起的荷包蛋包围盒 [x0, y0, x1, y1]（分层里已不含蛋，仅作姿态参考） */
  eggBox: [530, 148, 915, 522] as const,
  /** 锅内起跳点：蛋站在锅里时的脚底中心。比锅沿线低约 8px，脚会被 pan-rim 层挡住，看起来在锅里 */
  eggRest: { x: 742, y: 666 },
  /** 锅内可见的煎面（深色油面）包围盒，油泡和影子在这里 */
  panBox: [360, 502, 1109, 661] as const,
  /** 煎面椭圆：中心与半轴。下半弧就是 pan-rim 遮挡层的上沿：y = cy + ry·√(1-((x-cx)/rx)²) */
  panInner: { cx: 743, cy: 579, rx: 398, ry: 78 },
  /** pan-rim 遮挡层（锅前沿 + 红色锅身前半）包围盒 */
  panRimBox: [358, 601, 1119, 747] as const,
  /** 锅底火苗 */
  flameBox: [580, 729, 879, 800] as const,
  /** 水壶嘴，蒸汽起点 */
  kettleSpout: { x: 1192, y: 312 },
  /** 吐司盘（前景层） */
  toastBox: [0, 808, 450, 1024] as const,
} as const;

export type Box = readonly [number, number, number, number];
export const boxStyle = (b: Box) => ({
  position: "absolute" as const,
  left: b[0],
  top: b[1],
  width: b[2] - b[0],
  height: b[3] - b[1],
});
