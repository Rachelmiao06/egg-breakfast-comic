/**
 * 画格是纸，浮在厨房前面（docs/PAPER-WORLD.md "画框是实物"）：
 * 一层柔和的投影落在厨房上，进场时从略大缩到 1（ENTER_SCALE），整层随鼠标做比桌面更大的视差（ComicLayer 根元素）。
 * 投影用 box-shadow（画格外壳和图片同尺寸），合成器可缓存，不用 drop-shadow 滤镜。
 */
export const PAPER_SHADOW = "0 14px 26px -10px rgba(60,35,15,0.32), 0 2px 5px rgba(60,35,15,0.14)";
export const ENTER_SCALE = 0.035;
/** 画格层的鼠标视差（vw / vh 每单位鼠标偏移，-1…1）：最近的层动得最多，方向与厨房主体层一致 */
export const PAPER_PARALLAX = { x: 0.5, y: 0.3 };
