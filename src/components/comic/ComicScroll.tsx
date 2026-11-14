"use client";
/**
 * 前景漫画的滚动阅读区（feat/comic-scroll）。
 *
 * 结构（自上而下）：
 *   1. 100vh 导入段：scrub 把 useScene().setProgress 从 0 推到 1（厨房据此变暗变虚）。
 *   2. 五段故事（story.ts），每段一屏高，组盒最大 960px 居中，里面是带透明留白的卡片组。
 *      段中心进入视口中部 35% 区域时激活一次：卡片淡入 + 上浮 12px，依次错开；
 *      离开不重放、回滚不闪；激活第 n 段时 setActivePanel(n)，回滚到上一段时 setActivePanel(n-1)。
 *   3. 第 4 段额外提供：接蛋点 `[data-egg-catch]`、`catchSlot`、铲面前沿 `[data-egg-occluder]`，
 *      以及 scrub 的 onFlightProgress(t)（0 = 妈妈刚伸出锅铲，1 = 蛋应该落定）。
 *   4. 结尾留约 30vh 空白。
 *
 * reducedMotion 时只做淡入。它渲染在厨房之上（z-10），自己决定总高度。
 */
import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useScene } from "@/lib/scene-context";
import { ComicCard, PlaceholderSpatula, SpeechBubble } from "./ComicCard";
import { EGG_CATCH } from "./catch-point";
import { SECTIONS } from "./story";

gsap.registerPlugin(ScrollTrigger);

export type ComicScrollProps = {
  /** 放在第 4 段接触点上的内容（落定后的蛋），z 顺序在卡片之上、铲面前沿之下。 */
  catchSlot?: ReactNode;
  /** 第 4 段的滚动飞行进度 0–1（scrub），集成会话用它驱动蛋的跨景弧线。 */
  onFlightProgress?: (t: number) => void;
};

/** 段中心进入视口中部 35% 区域 = center 在 32.5%–67.5% 之间。 */
const BAND_START = "center 67.5%";
const BAND_END = "center 32.5%";

export default function ComicScroll({ catchSlot, onFlightProgress }: ComicScrollProps) {
  const { setProgress, setActivePanel, reducedMotion } = useScene();
  const rootRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef(onFlightProgress);
  useEffect(() => {
    flightRef.current = onFlightProgress;
  }, [onFlightProgress]);

  useEffect(() => {
    const root = rootRef.current;
    const lead = leadRef.current;
    if (!root || !lead) return;

    const ctx = gsap.context(() => {
      // 1) 导入段：progress 0 → 1
      let lastP = -1;
      ScrollTrigger.create({
        trigger: lead,
        start: "top bottom",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const p = Math.round(self.progress * 200) / 200; // 量化，少触发几次 React 更新
          if (p !== lastP) {
            lastP = p;
            setProgress(p);
          }
        },
      });

      // 2) 五段：各自激活一次
      const sections = Array.from(root.querySelectorAll<HTMLElement>("[data-comic-section]"));
      const played = new Set<number>();

      const reveal = (section: HTMLElement, n: number, instant: boolean) => {
        if (played.has(n)) return;
        played.add(n);
        const cards = Array.from(section.querySelectorAll<HTMLElement>("[data-comic-card]"));
        const bubbles = Array.from(section.querySelectorAll<HTMLElement>("[data-comic-bubble]"));
        const extras = Array.from(section.querySelectorAll<HTMLElement>("[data-comic-extra]"));
        const targets = [...cards, ...extras, ...bubbles];
        if (instant || reducedMotion) {
          gsap.to(targets, { autoAlpha: 1, y: 0, duration: instant ? 0 : 0.6, stagger: instant ? 0 : 0.12, overwrite: true });
          return;
        }
        gsap.to(cards, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out", stagger: 0.16, overwrite: true });
        if (extras.length) gsap.to(extras, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out", delay: 0.2, overwrite: true });
        if (bubbles.length) gsap.to(bubbles, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out", delay: 0.3 + cards.length * 0.16, stagger: 0.12, overwrite: true });
      };

      sections.forEach((section) => {
        const n = Number(section.dataset.comicSection);
        gsap.set(section.querySelectorAll("[data-comic-card],[data-comic-bubble],[data-comic-extra]"), { autoAlpha: 0, y: 12 });
        ScrollTrigger.create({
          trigger: section,
          start: BAND_START,
          end: BAND_END,
          onEnter: () => {
            reveal(section, n, false);
            setActivePanel(n);
          },
          onEnterBack: () => setActivePanel(n),
          onLeaveBack: () => setActivePanel(n - 1),
        });
      });

      // 刷新时已经在页中：上面的段直接显示为完成态，不重放
      sections.forEach((section) => {
        const n = Number(section.dataset.comicSection);
        if (section.getBoundingClientRect().top + section.offsetHeight / 2 < window.innerHeight * 0.675) {
          reveal(section, n, true);
        }
      });

      // 3) 第 4 段的飞行 scrub
      const s4 = sections.find((s) => s.dataset.comicSection === "4");
      if (s4) {
        ScrollTrigger.create({
          trigger: s4,
          start: "center 70%",
          end: "center 30%",
          scrub: true,
          onUpdate: (self) => flightRef.current?.(self.progress),
        });
      }
    }, root);

    return () => ctx.revert();
  }, [setProgress, setActivePanel, reducedMotion]);

  return (
    <div ref={rootRef} aria-label="comic" className="relative w-full">
      <div ref={leadRef} aria-hidden className="h-screen" />

      {SECTIONS.map((sec) => (
        <section
          key={sec.n}
          data-comic-section={sec.n}
          aria-label={sec.title}
          className="relative mx-auto h-[100svh] w-full max-w-[960px] max-sm:flex max-sm:h-auto max-sm:min-h-[100svh] max-sm:flex-col max-sm:justify-center max-sm:px-4 max-sm:py-12"
        >
          {/* 卡片层 */}
          {sec.cards.map((card) => (
            <ComicCard key={card.id} card={card} />
          ))}

          {/* 第 4 段：锅铲 + 接蛋点。层序：铲面 < catchSlot < 铲面前沿 < 气泡 */}
          {sec.n === 4 && (
            <>
              <div data-comic-extra className="absolute inset-0 z-[1]">
                <PlaceholderSpatula layer="blade" />
              </div>
              <div
                data-egg-catch
                className="absolute z-[2] h-0"
                style={{ left: `${EGG_CATCH.x}%`, top: `${EGG_CATCH.y}%`, width: `${EGG_CATCH.eggWidth}%` }}
              >
                {catchSlot}
              </div>
              <div data-comic-extra className="absolute inset-0 z-[3]">
                <PlaceholderSpatula layer="lip" />
              </div>
            </>
          )}

          {/* 气泡层 */}
          <div className="absolute inset-0 z-[4] max-sm:contents">
            {sec.bubbles.map((b, i) => (
              <SpeechBubble key={i} bubble={b} />
            ))}
          </div>

          {/* 第 3 段：妈妈视线起点，预览页画虚线用 */}
          {sec.gaze && <span data-gaze-origin className="absolute h-0 w-0" style={{ left: `${sec.gaze.x}%`, top: `${sec.gaze.y}%` }} />}
        </section>
      ))}

      <div aria-hidden className="h-[30vh]" />
    </div>
  );
}
