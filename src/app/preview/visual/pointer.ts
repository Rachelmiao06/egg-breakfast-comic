/**
 * 鼠标位置（屏幕像素）。只由 PanelHover 那一个全局 pointermove 写入，其他逐帧效果（格内弹簧）在自己的 ticker 里直接读。
 * on 为 false（触屏 / 鼠标离开页面 / 窗口失焦）时，读的一方应当把目标当作"没有鼠标"。
 */
export const pointer = { x: 0, y: 0, on: false };
