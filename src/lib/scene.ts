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
  /** 蛋静止落在锅里时的脚底中心。x=720 处锅沿遮挡线 y=657，脚底在其下 13px，被 pan-rim 层挡住（kitchen-layers 实测） */
  eggRest: { x: 720, y: 670 },
  /** 蛋图（public/assets/scene/egg.webp）在场景里的显示尺寸 */
  eggSize: { w: 388, h: 388 },
  /** 锅内可见锅底区域（内沿椭圆的外接框），油泡和影子在这里 */
  panBox: [360, 502, 1109, 661] as const,
  /** 锅底椭圆（kitchen-layers 实测）。下半弧就是锅沿遮挡线：y = cy + ry·√(1−((x−cx)/rx)²) */
  panInner: { cx: 743, cy: 579, rx: 398, ry: 77 },
  /** pan-rim 遮挡层包围盒 */
  panRimBox: [358, 601, 1119, 747] as const,
  /** 锅底火苗（动画锚点区域） */
  flameBox: [580, 729, 879, 800] as const,
  /** flame.webp 在场景里的摆放框：tools/extract_fx.py 把透明画布裁到不透明包围盒外扩 4px 后打印的坐标 */
  flameSprite: [573, 708, 887, 812] as const,
  /** oil.webp 的摆放框，同上 */
  oilSprite: [446, 569, 1057, 668] as const,
  /** 水壶嘴，蒸汽起点 */
  kettleSpout: { x: 1192, y: 312 },
  /** 吐司盘（前层）：故事已改为拌饭，吐司**待替换**（docs/ASSET-REQUESTS.md 第四版 K1），不作为任何终点 */
  toastBox: [0, 805, 440, 1024] as const,
  /** 蛋从锅里起跳的点（脚底中心），与 eggRest 一致 */
  panLaunch: { x: 720, y: 670 },
  /** 前景妈妈锅铲铲面上蛋的落点（脚底中心），由 MOM_SPATULA 摆放 + 铲面实测算出（tools/prepare_mom.py） */
  spatulaLand: { x: 537, y: 773 },
  /** 蛋落在锅铲上时的缩放（相对 eggSize），按铲面长度算 */
  eggOnSpatula: 0.578,
  /** 端碗图里饭碗中央米饭的中心（场景像素），由 MOM_SERVE 摆放 + 米饭区实测算出 */
  bowlCenter: { x: 761, y: 775 },
  /** 蛋放进饭碗中央时的脚底中心 */
  bowlLand: { x: 761, y: 852 },
  /** 蛋在饭碗里的缩放（相对 eggSize），按米饭区宽度算 */
  eggInBowl: 0.441,
  /** 前景妈妈（伸锅铲）占据的区域，kitchen-layers 在这里给她让位 */
  momZone: [420, 324, 1536, 1024] as const,
} as const;

export type Box = readonly [number, number, number, number];
export const boxStyle = (b: Box) => ({
  position: "absolute" as const,
  left: b[0],
  top: b[1],
  width: b[2] - b[0],
  height: b[3] - b[1],
});

/**
 * 场景内的前后顺序（z-index，越大越靠前）。所有放进 <SceneStage> 的层都必须用这里的值。
 * 蛋在锅里时在锅沿遮挡层后面；起飞后升到最上层，落到妈妈的锅铲上时盖在铲面上。
 */
export const Z = {
  back: 10, // 墙、瓷砖、黄锅、瓶罐、水壶（layers）
  mid: 20, // 木桌、灶台、红锅锅身（layers）
  fx: 30, // 火苗、油、油泡（kitchen-scene）
  steam: 35, // 水壶蒸汽（kitchen-scene）
  eggInPan: 40, // 锅里循环跳的蛋 + 影子（kitchen-scene）
  paper: 62, // 后景换场：浅纸面（盖住厨房，保留桌沿），在近景物件之上
  eggOnTable: 63, // 桌沿等待的蛋（在纸面之上、漫画之下）
  catchPanel: 62, // 接蛋格（场景里的漫画格）：在纸面之上（同层、DOM 在后）、桌沿蛋之下，升起时不会盖住等待的蛋
  bowlFront: 64, // 环境段饭桌上碗的前沿遮挡层（后景会话提供），挡住碗里蛋的下半
  panRim: 50, // 红锅前沿遮挡层（layers）
  frontLeft: 60, // 吐司盘（layers）
  frontRight: 61, // 蛋壳、格纹布；妈妈出场时可淡出让位（layers）
  mom: 70, // 前景妈妈 + 锅铲（comic-scroll，经 KitchenScene 的 foreground 插槽）
  eggFlying: 80, // 起飞后的蛋（kitchen-scene）
} as const;

/**
 * 妈妈前景图在厨房画布里的摆放（场景像素）。图片由 tools/prepare_mom.py 从用户素材裁出。
 * 场景坐标 = (x + 图片像素 * scale, y + 图片像素 * scale)。改这里会改变 spatulaLand / bowlLand，
 * 改完重跑 tools/prepare_mom.py 的计算或手动同步上面的锚点。
 */
export const MOM_SPATULA = { src: "/assets/mom/spatula.webp", w: 1446, h: 974, scale: 0.78, x: 420, y: 324 } as const;
export const MOM_SERVE = { src: "/assets/mom/serve.webp", w: 643, h: 481, scale: 1.5, x: 286, y: 303 } as const;
/** 前景漫画画格用的三组妈妈图（页面层，不用场景像素） */
export const MOM_PANELS = {
  chop: { src: "/assets/mom/chop.webp", w: 494, h: 555 },
  stirfry: { src: "/assets/mom/stirfry.webp", w: 515, h: 561 },
  sauce: { src: "/assets/mom/sauce.webp", w: 627, h: 479 },
} as const;
