"use client";
/**
 * 前景漫画（comic-scroll 分支，第五版：只读统一节拍表）。
 *
 * 本组件不定义滚动长度、不注册滚动监听：页面长度由全站唯一的 <ScrollDriver> 决定，
 * 这里 position: fixed 浮在厨房上，只读 useScene().timeline（src/lib/beats.json 的段 / 阶段 / 进度）：
 *   chop / stirfry / sauce 画格：envelope(t, id) 给 0–1 显隐（进入 0→1、动作和停留 1、退出 1→0），
 *                               进入阶段上浮、退出阶段上飘；整格只做 ±3px 的 CSS 轻漂浮，不冒充动作。
 *   notice（发现跳蛋）：画格都已散去，只留一个很小的"！"视线引导，跟 envelope 显隐。
 *   ending（结尾近景）：静态结尾图（或明确标注的占位）在进入阶段淡入全屏，之后停住。
 * activePanel / progress / flight / serve 由 derive(timeline) 推导，本组件不写任何共享状态，也不播放声音。
 * reducedMotion：只淡入淡出，不位移、不漂浮。
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { envelope, phaseProgress } from "@/lib/beats";
import { getScrollVelocity } from "@/lib/scroll-velocity";
import { MOM_PANELS } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";

/** 用户的结尾近景图到了填路径（例如 "/assets/comic/ending.webp"），null 时显示明确标注的占位。 */
const ENDING_SRC: string | null = null;

/** 节拍 1–3 画格的摆放（视口相对；图本身来自 scene.ts 的 MOM_PANELS） */
const PANELS: { id: keyof typeof MOM_PANELS; className: string }[] = [
  { id: "chop", className: "left-[8%] bottom-[8%] sm:left-[12%]" },
  { id: "stirfry", className: "right-[6%] bottom-[10%] sm:right-[12%]" },
  { id: "sauce", className: "left-[6%] bottom-[12%] sm:left-[10%]" },
];

/** 缓动：进入减速（power3.out），退出加速（power2.in）——对应 docs/SCROLL-DESIGN.md 3.2 */
const easeOut3 = (x: number) => 1 - Math.pow(1 - x, 3);
const easeIn2 = (x: number) => x * x;

const FONT = '"PingFang SC","Hiragino Sans GB",system-ui,sans-serif';

export default function ComicScroll() {
  const { timeline: t, reducedMotion } = useScene();
  const root = useRef<HTMLDivElement>(null);

  // 跟手余韵：滚动速度映射成最多 ±0.8° 的倾角，停手后随速度衰减回正；直接写 DOM，不触发 React 重渲染
  useEffect(() => {
    if (reducedMotion) return;
    const tilt = (time: number) => {
      void time;
      const el = root.current;
      if (!el) return;
      const deg = Math.max(-0.8, Math.min(0.8, getScrollVelocity() * 0.012));
      el.style.setProperty("--tilt", `${deg.toFixed(3)}deg`);
    };
    gsap.ticker.add(tilt);
    return () => gsap.ticker.remove(tilt);
  }, [reducedMotion]);

  return (
    <div ref={root} aria-label="comic" className="pointer-events-none fixed inset-0 z-10">
      <style>{`@keyframes comic-panel-float{from{transform:translateY(-3px)}to{transform:translateY(3px)}}`}</style>

      {PANELS.map(({ id, className }) => {
        const raw = envelope(t, id);
        if (raw <= 0) return null;
        const entering = t.beat.id === id && t.phase === "enter";
        const exiting = t.beat.id === id && t.phase === "exit";
        // 进入：先快后慢；退出：先慢后快
        const env = entering ? easeOut3(raw) : exiting ? 1 - easeIn2(1 - raw) : raw;
        const img = MOM_PANELS[id];
        // 进入阶段从下方 28px 上浮到位；退出阶段再上飘 16px
        const inP = entering ? 1 - easeOut3(t.phaseP) : 0; // 1 → 0
        const outP = exiting ? easeIn2(t.phaseP) : 0; // 0 → 1
        const rise = reducedMotion ? 0 : inP * 56 - outP * 40;
        const scale = reducedMotion ? 1 : 1 - inP * 0.06 + outP * 0.03;
        const blur = reducedMotion ? 0 : inP * 6 + outP * 4;
        const rot = reducedMotion ? 0 : inP * (id === "stirfry" ? 1.6 : -1.6) + outP * (id === "stirfry" ? -0.8 : 0.8);
        return (
          <div
            key={id}
            data-panel={id}
            className={`absolute ${className} max-w-[min(88vw,620px)]`}
            style={{
              height: "min(70svh, 620px)",
              opacity: env,
              transform: `translate3d(0, ${rise.toFixed(2)}px, 0) rotate(calc(${rot.toFixed(3)}deg + var(--tilt, 0deg))) scale(${scale.toFixed(4)})`,
              filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
              willChange: "opacity, transform, filter",
            }}
          >
            <div
              data-panel-float
              className="relative h-full"
              style={reducedMotion ? undefined : { animation: "comic-panel-float 2.8s ease-in-out infinite alternate" }}
            >
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
        );
      })}

      <NoticeHint opacity={envelope(t, "notice")} scale={reducedMotion ? 1 : 0.8 + 0.2 * phaseProgress(t, "enter")} />

      <Ending opacity={t.beat.id === "ending" ? phaseProgress(t, "enter") : 0} />
    </div>
  );
}

/** 节拍 4：画格散去后一个很小的"！"，把视线引回后景锅里的蛋。 */
function NoticeHint({ opacity, scale }: { opacity: number; scale: number }) {
  if (opacity <= 0) return null;
  return (
    <div
      data-hint
      aria-hidden
      className="absolute left-[58%] top-[42%] grid h-12 w-12 place-items-center rounded-full bg-cream text-2xl font-bold text-ink shadow-[0_6px_14px_-6px_rgba(107,74,43,0.5)] ring-2 ring-ink/70"
      style={{ fontFamily: FONT, opacity, transform: `scale(${scale})` }}
    >
      ！
    </div>
  );
}

/** 节拍 8：静态结尾近景；没有图时是明确标注的占位（米白底 + 虚线框 + 文字）。 */
function Ending({ opacity }: { opacity: number }) {
  if (opacity <= 0) return null;
  return (
    <div data-ending className="absolute inset-0 z-20 bg-paper" style={{ opacity }}>
      {ENDING_SRC ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ENDING_SRC} alt="结尾近景：淋酱汁，划开流黄" draggable={false} className="h-full w-full select-none object-cover" />
      ) : (
        <div className="absolute inset-[6%] grid place-items-center rounded-2xl border-[3px] border-dashed border-ink/50">
          <p className="px-6 text-center text-[clamp(18px,3vw,32px)] font-semibold leading-relaxed text-ink/80" style={{ fontFamily: FONT }}>
            占位：结尾近景
            <br />
            （完整荷包蛋在饭中央 → 淋酱汁 → 勺子划开流黄）
          </p>
        </div>
      )}
    </div>
  );
}
