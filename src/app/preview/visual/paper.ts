/**
 * 画格是纸，浮在厨房前面（docs/PAPER-WORLD.md "画框是实物"）：
 * 一层柔和的投影落在厨房上，进场时从略大缩到 1（ENTER_SCALE），整层随鼠标做比桌面更大的视差（ComicLayer 根元素）。
 * 投影用 drop-shadow 滤镜而不是 box-shadow：画格图片的墨线框外面留有 5–6 px 的透明边，
 * box-shadow 沿图片矩形画，会在墨线外露出第二圈边；drop-shadow 沿画面的 alpha 走，贴着墨线。
 * （滤镜的模糊参数是标准差，约等于 box-shadow 模糊值的一半。）
 */
export const PAPER_SHADOW = "drop-shadow(0 10px 10px rgba(60,35,15,0.30)) drop-shadow(0 1px 2px rgba(60,35,15,0.16))";
export const ENTER_SCALE = 0.035;
/** 画格层的鼠标视差（vw / vh 每单位鼠标偏移，-1…1）：最近的层动得最多，方向与厨房主体层一致 */
export const PAPER_PARALLAX = { x: 0.5, y: 0.3 };
