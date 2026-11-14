"use client";
/**
 * 前景漫画的滚动区（comic-scroll 分支，第四版：妈妈的荷包蛋拌饭）。
 *
 * 页面层（z-10）里按节拍切成 8 个滚动区（开场一屏由 page.tsx 放在前面）：
 *   1 切配菜 130vh   chop 画格；前 60vh scrub progress 0→1
 *   2 炒配菜 130vh   stirfry 画格接替
 *   3 调汁   130vh   sauce 画格接替
 *   4 发现跳蛋 110vh 画格散去，progress 回到 0.1，后景的蛋重新清晰
 *   5 伸锅铲  90vh   MomForeground 的锅铲妈妈从右下滑入（mom-store.enter scrub）；进入时 flight=0，回滚离开时 flight=null
 *   6 接蛋   180vh   scrub flight 0→1
 *   7 放进饭碗 150vh 锅铲妈妈交叉淡化为端碗妈妈（mom-store.cross）；scrub serve 0→1；回滚离开时 serve=null
 *   8 结尾近景 150vh 静态结尾图（或占位）全屏淡入，页面结束
 * 每个区的 activePanel 在"区的范围跨过视口中线"时生效。本组件不渲染蛋，也不播放声音。
 * 画格是合并插画，只做整格淡入/上浮和 ±3px 的轻漂浮，不冒充动作。reducedMotion：只淡入，flight/serve 直接到 1。
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MOM_PANELS } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import { setMomState } from "./mom-store";

gsap.registerPlugin(ScrollTrigger);
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  // 开发预览用：隐藏的浏览器面板里 rAF 被节流，脚本可以手动 __ScrollTrigger.update() 同步求值
  (window as unknown as { __ScrollTrigger?: typeof ScrollTrigger }).__ScrollTrigger = ScrollTrigger;
}

/** 用户的结尾近景图到了填路径（例如 "/assets/comic/ending.webp"），null 时显示明确标注的占位。 */
const ENDING_SRC: string | null = null;

type Beat = {
  n: number;
  title: string;
  /** 滚动区高度（vh） */
  vh: number;
  /** 节拍 1–3 的画格 */
  panel?: { key: keyof typeof MOM_PANELS; className: string };
};

const BEATS: Beat[] = [
  { n: 1, title: "切配菜", vh: 130, panel: { key: "chop", className: "left-[8%] bottom-[8%] sm:left-[12%]" } },
  { n: 2, title: "炒配菜", vh: 130, panel: { key: "stirfry", className: "right-[6%] bottom-[10%] sm:right-[12%]" } },
  { n: 3, title: "调汁", vh: 130, panel: { key: "sauce", className: "left-[6%] bottom-[12%] sm:left-[10%]" } },
  { n: 4, title: "发现跳蛋", vh: 110 },
  { n: 5, title: "伸锅铲", vh: 90 },
  { n: 6, title: "接蛋", vh: 180 },
  { n: 7, title: "放进饭碗", vh: 150 },
  { n: 8, title: "结尾近景", vh: 150 },
];

const q = (v: number) => Math.round(v * 200) / 200;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function ComicScroll() {
  const { setProgress, setActivePanel, setFlight, setServe, reducedMotion } = useScene();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const beat = (n: number) => root.querySelector<HTMLElement>(`[data-beat="${n}"]`)!;

    const ctx = gsap.context(() => {
      // ---- activePanel：区的范围跨过视口中线时生效（按节拍顺序创建，跳页时回调按顺序触发） ----
      BEATS.forEach(({ n }) => {
        ScrollTrigger.create({
          trigger: beat(n),
          start: "top 50%",
          end: "bottom 50%",
          onEnter: () => setActivePanel(n),
          onEnterBack: () => setActivePanel(n),
          onLeaveBack: () => setActivePanel(n - 1),
        });
      });

      // ---- progress：节拍 1 前 60vh 0→1；节拍 4 前 50vh 1→0.1 ----
      ScrollTrigger.create({
        trigger: beat(1),
        start: "top bottom",
        end: "top 40%",
        scrub: true,
        onUpdate: (self) => setProgress(q(self.progress)),
      });
      ScrollTrigger.create({
        trigger: beat(4),
        start: "top 60%",
        end: "top 10%",
        scrub: true,
        onUpdate: (self) => setProgress(q(1 - 0.9 * self.progress)),
      });

      // ---- 画格 1–3：淡入上浮 / 淡出，整格 ±3px 轻漂浮 ----
      BEATS.filter((b) => b.panel).forEach(({ n }) => {
        const section = beat(n);
        const panel = section.querySelector<HTMLElement>("[data-panel]")!;
        const floatEl = section.querySelector<HTMLElement>("[data-panel-float]")!;
        gsap.fromTo(
          panel,
          { autoAlpha: 0, y: reducedMotion ? 0 : 28 },
          { autoAlpha: 1, y: 0, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "top 55%", scrub: true } },
        );
        gsap.to(panel, {
          autoAlpha: 0,
          y: reducedMotion ? 0 : -16,
          ease: "none",
          immediateRender: false,
          scrollTrigger: { trigger: section, start: "bottom 70%", end: "bottom 30%", scrub: true },
        });
        if (!reducedMotion) {
          gsap.fromTo(floatEl, { y: -3 }, { y: 3, duration: 2.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
        }
      });

      // ---- 节拍 4 的小"！"引导 ----
      const hint = beat(4).querySelector<HTMLElement>("[data-hint]");
      if (hint) {
        gsap.fromTo(
          hint,
          { autoAlpha: 0, scale: 0.8 },
          { autoAlpha: 1, scale: 1, ease: "none", scrollTrigger: { trigger: beat(4), start: "top 45%", end: "top 15%", scrub: true } },
        );
        gsap.to(hint, {
          autoAlpha: 0,
          ease: "none",
          immediateRender: false,
          scrollTrigger: { trigger: beat(4), start: "bottom 100%", end: "bottom 75%", scrub: true },
        });
      }

      // ---- 节拍 5：锅铲妈妈滑入；flight 0 / null ----
      ScrollTrigger.create({
        trigger: beat(5),
        start: "top 50%",
        end: "bottom 50%",
        scrub: true,
        onUpdate: (self) => setMomState({ enter: q(self.progress) }),
        onEnter: (self) => {
          setMomState({ enter: q(self.progress) });
          setFlight(reducedMotion ? 1 : 0);
        },
        onEnterBack: (self) => {
          setMomState({ enter: q(self.progress) });
          setFlight(reducedMotion ? 1 : 0);
        },
        onLeaveBack: () => {
          setFlight(null);
          setMomState({ enter: 0 });
        },
      });

      // ---- 节拍 6：flight 0→1 ----
      ScrollTrigger.create({
        trigger: beat(6),
        start: "top 50%",
        end: "bottom 50%",
        scrub: true,
        onUpdate: (self) => setFlight(reducedMotion ? 1 : q(self.progress)),
      });

      // ---- 节拍 7：交叉淡化 + serve 0→1 / null ----
      // 注意：ScrollTrigger 在同一次 update 里先调 onUpdate 再调 onEnter/onEnterBack，
      // 所以进入回调也要按当前 progress 算，不能写死 0（否则从节拍 8 跳回节拍 7 中段会被覆盖成 0）。
      const serveOf = (p: number) => (reducedMotion ? 1 : q(clamp01((p - 0.3) / 0.7)));
      const applyServe = (self: ScrollTrigger) => {
        setMomState({ cross: q(clamp01(self.progress / 0.4)) });
        setServe(serveOf(self.progress));
      };
      ScrollTrigger.create({
        trigger: beat(7),
        start: "top 50%",
        end: "bottom 50%",
        scrub: true,
        onUpdate: applyServe,
        onEnter: applyServe,
        onEnterBack: applyServe,
        onLeaveBack: () => {
          setServe(null);
          setMomState({ cross: 0 });
        },
      });

      // ---- 节拍 8：结尾近景全屏淡入 ----
      const ending = beat(8).querySelector<HTMLElement>("[data-ending]")!;
      gsap.fromTo(
        ending,
        { autoAlpha: 0 },
        { autoAlpha: 1, ease: "none", scrollTrigger: { trigger: beat(8), start: "top 80%", end: "top 10%", scrub: true } },
      );
    }, root);

    return () => ctx.revert();
  }, [setProgress, setActivePanel, setFlight, setServe, reducedMotion]);

  return (
    <div ref={rootRef} aria-label="comic" className="relative w-full">
      {BEATS.map((b) => (
        <section key={b.n} data-beat={b.n} aria-label={b.title} className="relative w-full" style={{ height: `${b.vh}vh` }}>
          {b.panel && <MomPanel panel={b.panel} />}
          {b.n === 4 && (
            <div className="sticky top-0 h-screen">
              <div
                data-hint
                aria-hidden
                className="absolute left-[58%] top-[42%] grid h-12 w-12 place-items-center rounded-full bg-cream text-2xl font-bold text-ink shadow-[0_6px_14px_-6px_rgba(107,74,43,0.5)] ring-2 ring-ink/70"
                style={{ fontFamily: '"PingFang SC","Hiragino Sans GB",system-ui,sans-serif' }}
              >
                ！
              </div>
            </div>
          )}
          {b.n === 8 && <Ending />}
        </section>
      ))}
    </div>
  );
}

/** 节拍 1–3 的画格：透明人物图 + 很淡的纸卡衬底，sticky 在区里跟着走。 */
function MomPanel({ panel }: { panel: NonNullable<Beat["panel"]> }) {
  const img = MOM_PANELS[panel.key];
  return (
    <div className="sticky top-0 h-screen">
      <div data-panel className={`absolute ${panel.className} max-w-[min(88vw,620px)]`} style={{ height: "min(70svh, 620px)" }}>
        <div data-panel-float className="relative h-full">
          <div
            aria-hidden
            className="absolute -inset-[4%] bg-cream/55 shadow-[0_18px_40px_-18px_rgba(107,74,43,0.5)]"
            style={{ borderRadius: "22px 16px 26px 14px / 16px 26px 14px 22px", backdropFilter: "blur(1px)" }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.src}
            width={img.w}
            height={img.h}
            alt=""
            draggable={false}
            className="relative block h-full w-auto select-none object-contain"
          />
        </div>
      </div>
    </div>
  );
}

/** 节拍 8：静态结尾近景；没有图时是明确标注的占位（米白底 + 虚线框 + 文字）。 */
function Ending() {
  return (
    <div className="sticky top-0 h-screen">
      <div data-ending className="absolute inset-0 bg-paper">
        {ENDING_SRC ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ENDING_SRC} alt="结尾近景：淋酱汁，划开流黄" draggable={false} className="h-full w-full select-none object-cover" />
        ) : (
          <div className="absolute inset-[6%] grid place-items-center rounded-2xl border-[3px] border-dashed border-ink/50">
            <p
              className="px-6 text-center text-[clamp(18px,3vw,32px)] font-semibold leading-relaxed text-ink/80"
              style={{ fontFamily: '"PingFang SC","Hiragino Sans GB",system-ui,sans-serif' }}
            >
              占位：结尾近景
              <br />
              （完整荷包蛋在饭中央 → 淋酱汁 → 勺子划开流黄）
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
