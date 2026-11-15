/**
 * 读格门（2026-11-15 用户：格内动画不能被跳过，滚动要"逼"读者看完）。
 * 带格内动画的格子开始表演时 holdScroll(id, 秒)；ScrollDriver 在 scrollHeld() 期间不让故事越过当前段的"停留结束点"，
 * 动画播完（到时间自动放开，或格子被收住 / 复位 / 卸载时 releaseScroll）才放行。
 * 往回滚永远放行（回去会收住表演并放开门）。有超时（秒数 + 0.4）兜底，不会卡死。
 */
const held = new Map<string, number>();
export function holdScroll(id: string, seconds: number) {
  held.set(id, performance.now() + (seconds + 0.4) * 1000);
}
export function releaseScroll(id: string) {
  held.delete(id);
}
export function scrollHeld() {
  const now = performance.now();
  for (const [id, until] of held) if (until <= now) held.delete(id);
  return held.size > 0;
}
