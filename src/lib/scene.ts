/**
 * 场景坐标约定（所有分支共用）。
 * 厨房主图是 1536×1024，页面上所有厨房元素都用这个“场景像素”定位，
 * 由 <SceneStage> 统一做 cover 缩放。不要在组件里自己换算视口尺寸。
 */
export const SCENE_W = 1536;
export const SCENE_H = 1024;
/** cover 裁切时尽量保持在视口约 55% 高度处的那条线（锅和蛋附近）。 */
export const FOCUS_Y = 600;

/**
 * 主图里关键区域（场景像素）。kitchen-clean.png 与原画逐像素对齐（已验证位移 0,0），
 * 所以这些坐标对两张图都成立。2026-11-13 按新底图校准。
 */
export const ANCHORS = {
  /** 荷包蛋在原画中的包围盒 [x0, y0, x1, y1] */
  eggBox: [525, 150, 915, 525] as const,
  /** 蛋静止落在锅底时的脚底中心（锅底中心 y≈590，锅前沿 y≈648） */
  eggRest: { x: 720, y: 618 },
  /** 蛋图（public/assets/scene/egg.webp）在场景里的显示尺寸 */
  eggSize: { w: 388, h: 388 },
  /** 锅内可见锅底区域（内沿椭圆的外接框），油泡和影子在这里 */
  panBox: [370, 505, 1105, 648] as const,
  /** 锅底火苗 */
  flameBox: [600, 735, 830, 790] as const,
  /** 水壶嘴，蒸汽起点 */
  kettleSpout: { x: 1200, y: 330 },
  /** 吐司盘（前层） */
  toastBox: [0, 805, 440, 1024] as const,
  /** 蛋飞向吐司时的落点（脚底中心，吐司面黄油附近） */
  toastLand: { x: 185, y: 905 },
} as const;

export type Box = readonly [number, number, number, number];
export const boxStyle = (b: Box) => ({
  position: "absolute" as const,
  left: b[0],
  top: b[1],
  width: b[2] - b[0],
  height: b[3] - b[1],
});
