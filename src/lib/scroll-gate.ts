/**
 * 读格门（2026-11-15 用户：格内动画不能被跳过，滚动要"逼"读者看完）。
 * 带格内动画的格子开始表演时 holdScroll(id, 秒)；ScrollDriver 在 scrollHeld() 期间不让故事越过当前段的"停留结束点"，
 * 动画播完（到时间自动放开，或格子被收住 / 复位 / 卸载时 releaseScroll）才放行。
 * 往回滚永远放行（回去会收住表演并放开门）。有超时（秒数 + 0.4）兜底，不会卡死。
 */
const held = new Map<string, number>();
export function holdScroll(id: string, seconds: number) {
  waiting.delete(id);
  held.set(id, performance.now() + (seconds + 0.4) * 1000);
}
export function releaseScroll(id: string) {
  held.delete(id);
  waiting.delete(id);
}
export function scrollHeld() {
  const now = performance.now();
  for (const [id, until] of held) if (until <= now) held.delete(id);
  return held.size > 0;
}

/**
 * 表演排队（2026-11-15 用户：两个格子的动画有先后顺序时，要一个播完再播下一个）。
 * 想开始表演的格子先 requestTurn(id, seq)：当前没有别的表演在播、也没有序号更小的格子在等，才轮到它；否则它继续等
 * （PanelPerf.useStage 每 120 ms 再问一次）。轮到并 holdScroll 之后自动从等待名单里去掉。seq 用格子的 order（同段里先读的在前）。
 */
const waiting = new Map<string, number>();
export function requestTurn(id: string, seq: number): boolean {
  waiting.set(id, seq);
  const now = performance.now();
  for (const [other, until] of held) if (other !== id && until > now) return false;
  for (const [other, s] of waiting) if (other !== id && s < seq) return false;
  return true;
}
export function cancelTurn(id: string) {
  waiting.delete(id);
}
