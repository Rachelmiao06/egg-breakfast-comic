/**
 * 接蛋位置：第 4 段妈妈锅铲的接触点（feat/comic-scroll 提供，蛋的跨景飞行由集成会话控制）。
 *
 * 约定：
 * - ComicScroll 在第 4 段的组盒里渲染一个 `[data-egg-catch]` 元素：左上角就是接触点
 *   （蛋落地时脚底中心对齐这里），宽度 = 蛋落在锅铲上时应有的宽度（px），高度 0。
 * - 同一位置渲染 `catchSlot`（ComicScroll 的 prop）：集成会话把飞行末段 / 落定后的蛋
 *   放进这个 slot，它的 z 顺序在卡片之上、锅铲前沿（`[data-egg-occluder]`）之下，
 *   这样蛋的下缘会被铲面前沿挡住一点，看起来是"落在铲子上"而不是贴在上面。
 * - 飞行途中的蛋不在 slot 里（它跨越后景 fixed 层和前景），集成会话用 getEggCatch()
 *   读接触点的视口坐标做终点即可。
 */

/** 组盒百分比里的接触点和铲面角度（占位值，正式图出来后按锅铲实测改）。 */
export const EGG_CATCH = {
  /** 接触点 x（组宽 %）、y（组高 %） */
  x: 66,
  y: 60,
  /** 铲面相对水平的角度（deg，负值 = 铲尖朝左下抬起） */
  angle: -8,
  /** 蛋落定后的宽度（组宽 %），比厨房里的蛋大一圈，表示"靠近观众" */
  eggWidth: 24,
  /** 铲面从接触点向右延伸的长度（组宽 %），只是占位锅铲的尺寸 */
  bladeLength: 16,
};

export type EggCatch = {
  /** 视口像素：蛋脚底中心的落点 */
  x: number;
  y: number;
  /** 蛋落定后的宽度（px） */
  eggWidth: number;
  /** 铲面角度（deg） */
  angle: number;
};

/** 读取当前接触点的视口坐标；第 4 段还没挂载时返回 null。滚动时每帧调用也没问题。 */
export function getEggCatch(): EggCatch | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>("[data-egg-catch]");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, eggWidth: r.width, angle: EGG_CATCH.angle };
}
