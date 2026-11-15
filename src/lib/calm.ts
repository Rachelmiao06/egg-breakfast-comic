/**
 * 厨房"安静度" 0–1（= 阅读弱化 dim）：有漫画格在读时 → 大，厨房的配角和氛围运动按它压低，主角（格子）不被抢。
 * KitchenScene 每次 dim 变化时写入；Steam、KitchenLayers（鼠标与景深视差）每帧读取。
 * 规则（docs/SCROLL-DESIGN.md 第 8 节）：配角（视差）最多压到 50%，氛围（蒸汽）最多压到 40%。
 */
let calm = 0;
export const setCalm = (v: number) => { calm = Math.min(1, Math.max(0, v)); };
export const getCalm = () => calm;
export const parallaxGain = () => 1 - 0.5 * calm;
export const ambientGain = () => 1 - 0.6 * calm;
