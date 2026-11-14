/**
 * 漫画页数据（comic-scroll 分支）：一页 = 一张纸面，格子几何、框线、气泡、旁白、拟声、占位全部由数据描述，
 * <ComicPage> 只负责画。版式规格见 docs/COMIC-PAGES.md，新图路径见 docs/ASSET-REQUESTS.md 第五版。
 *
 * 几何：一页分若干行，每行里的格子按 flex 比例分宽，格子高度由自己的 ratio 决定（同一行的格子比例要凑成等高）。
 * 文字：caption 贴在格角的旁白框；bubble 对白气泡（tail 指向说话的人）；sfx 手写拟声词。
 * 图片：src 为 null 时显示明确标注的占位（景别、内容、比例、建议出图尺寸）；有图时 object-fit: contain，不拉伸、不裁切。
 */

export type Corner = "tl" | "tr" | "bl" | "br";

export type PanelText =
  | { kind: "caption"; text: string; corner: Corner }
  | {
      kind: "bubble";
      text: string;
      /** 气泡左上角在格内的位置（百分比）和最大宽度 */
      left: string;
      top: string;
      maxWidth: string;
      /** 尾巴：从气泡边缘哪一点伸出（相对气泡的百分比）、朝哪个角度（度，0 = 向右，90 = 向下） */
      tail: { x: string; y: string; angle: number };
    }
  | { kind: "sfx"; text: string; left: string; top: string; rotate: number; size: number };

export type Panel = {
  /** P1、P2… */
  id: string;
  /** 景别 */
  shot: string;
  /** 画面内容（占位说明，也是给画师的描述） */
  content: string;
  /** 宽:高 */
  ratio: [number, number];
  /** 建议出图尺寸，例如 "1600×900" */
  size: string;
  /** 行内宽度比例 */
  flex: number;
  /** 手绘框线；none = 这一格不画框，用留白呼吸 */
  frame: "drawn" | "none";
  /** 框线抖动的随机种子，让每格略有不同 */
  seed: number;
  /** 网页用图片路径；null = 占位 */
  src: string | null;
  texts: PanelText[];
};

export type ComicPage = {
  id: string;
  title: string;
  /** 对应节拍 id */
  beat: string;
  rows: { panels: Panel[] }[];
};

/** 第一页：切配菜（节拍 1，停留组 prep 的第一页）。几何和文字按 docs/COMIC-PAGES.md。 */
export const CHOP_PAGE: ComicPage = {
  id: "chop",
  title: "切配菜",
  beat: "chop",
  rows: [
    {
      panels: [
        {
          id: "P1",
          shot: "横向中景",
          content: "妈妈站在砧板前切胡萝卜，完整人物（至少到腰）和道具：砧板、刀、胡萝卜、葱、旁边的碗；身后是薄荷绿瓷砖的厨房一角",
          ratio: [16, 9],
          size: "1600×900",
          flex: 2,
          frame: "drawn",
          seed: 11,
          src: null,
          texts: [{ kind: "caption", text: "星期天早上，妈妈先备菜。", corner: "tl" }],
        },
        {
          id: "P2",
          shot: "手部近景",
          content: "一只手扶着胡萝卜，另一只手握刀切下，切好的胡萝卜丁和葱花在砧板上",
          ratio: [8, 9],
          size: "800×900",
          flex: 1,
          frame: "none",
          seed: 23,
          src: null,
          texts: [{ kind: "sfx", text: "哒、哒、哒", left: "10%", top: "8%", rotate: -9, size: 30 }],
        },
      ],
    },
    {
      panels: [
        {
          id: "P3",
          shot: "表情特写",
          content: "妈妈的脸，低头专注、嘴角带笑，耳边黄色耳坠",
          ratio: [14, 15],
          size: "720×780",
          flex: 28,
          frame: "drawn",
          seed: 37,
          src: null,
          texts: [
            {
              kind: "bubble",
              text: "胡萝卜切小丁，葱花也备好啦～",
              left: "7%",
              top: "6%",
              maxWidth: "86%",
              tail: { x: "38%", y: "100%", angle: 112 },
            },
          ],
        },
        {
          id: "P4",
          shot: "锅内近景",
          content: "红色平底锅里，荷包蛋小人正在油里蹦（为后面「发现跳蛋」埋伏笔），油泡、热气",
          ratio: [12, 5],
          size: "1680×700",
          flex: 72,
          frame: "drawn",
          seed: 53,
          src: null,
          texts: [{ kind: "caption", text: "锅里，有一颗蛋已经等不及了。", corner: "br" }],
        },
      ],
    },
  ],
};
