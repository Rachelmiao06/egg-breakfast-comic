/**
 * 统一重置入口（“再看一次”）。集成会话维护。
 *
 * replayStory() 先派发 window 事件 REPLAY_EVENT，各模块收到后清掉自己的真实时间状态：
 *   - 混音器（useKitchenAudio）：停掉正在响的单次音效和动作声，清空动作 / 格子定时器；循环声跟随新的时间轴回到开场电平。
 *     声音开关保持用户的选择，不新建播放器。
 *   - 滚动驱动（ScrollDriver）：立即回到页面顶部（Lenis immediate，不平滑滚过整段故事），时间轴同步到开场。
 * 漫画格、格内表演和蛋都只由时间轴推导：回到顶部后，格子卸载时 useStage 自动复位（复位信号照常派发，蛋的起跳状态随之复位），
 * 蛋回到锅里的开场状态。回到顶部是倒着走，混音器不会补播任何越过的单次音效。
 */
export const REPLAY_EVENT = "story:replay";

export function replayStory() {
  window.dispatchEvent(new CustomEvent(REPLAY_EVENT));
}
