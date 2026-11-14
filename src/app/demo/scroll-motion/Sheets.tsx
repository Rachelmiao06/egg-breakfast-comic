"use client";
/**
 * 页面层（视口单位）的流动内容与两块停留版面：
 * - OpeningTitle：开场流动段，标题随滚动 1:1 上移；
 * - NoticeCaption：发现跳蛋流动段，一句旁白像下一段文字一样 1:1 滚过（组前的备菜桌面同时被推走）；
 * - CatchFrame：📌 接蛋组，漫画边框在伸锅铲的进入阶段合拢，动作阶段被妈妈撑开（边界打开）；
 * - EndingCard：📌 饭碗组，结尾近景（占位）在结尾段进入阶段从饭碗处放大淡入；释放段 1:1 上移；
 * - EndCard：释放段里从下方滚入的"完"。
 */
import type { Beat, PinState, Timeline } from "@/lib/beats";
import { beatPhase, isBeat, lerp, sineInOut } from "./motion";
import { tiltStyle } from "./VelocityTilt";

type Props = { t: Timeline; beats: Beat[]; pin: PinState };

export function OpeningTitle({ t, pin }: Props) {
  if (!isBeat(t, "opening")) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-10 h-screen" style={{ transform: `translateY(${-pin.flowVh}vh)` }}>
      <div className="absolute inset-x-0 top-[66vh] flex flex-col items-center gap-3">
        <h1 className="rounded-full bg-cream/90 px-7 py-3 text-[clamp(22px,3.2vw,40px)] font-bold tracking-wide text-ink shadow-md ring-1 ring-ink/10" style={tiltStyle(0.6)}>
          妈妈的荷包蛋拌饭
        </h1>
        <p className="rounded-full bg-cream/70 px-3 py-1 text-sm text-ink/70">往下滚动 ↓</p>
      </div>
    </div>
  );
}

export function NoticeCaption({ t, pin }: Props) {
  if (!isBeat(t, "notice")) return null;
  // 顶边 = 100 − (已滚 + 10)vh：段开始时在屏幕底下，段结束时完全滚出顶部，绝不会被接蛋组"冻"在半路
  const top = 100 - (pin.flowVh + 10);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-10" style={{ transform: `translateY(${top}vh)` }}>
      <div className="mx-auto w-fit max-w-[80vw] rounded-[20px] bg-cream/95 px-6 py-4 text-[clamp(18px,2vw,26px)] text-ink shadow-lg ring-1 ring-ink/10" style={tiltStyle()}>
        咦？锅里那颗荷包蛋……又跳起来了！
      </div>
    </div>
  );
}

export function CatchFrame({ t, beats }: Props) {
  const close = beatPhase(t, beats, "spatula", "enter");
  const open = beatPhase(t, beats, "spatula", "action");
  if (close <= 0 || open >= 1) return null;
  // 边框内缩量（vmin）：-8 = 在视口外；4 = 合拢成一格漫画
  const inset = lerp(lerp(-8, 5.5, sineInOut(close)), -10, sineInOut(open));
  const label = 1 - Math.min(1, open * 2.5);
  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute rounded-[22px] border-4 border-ink/85"
        style={{ inset: `${inset}vmin`, boxShadow: "0 0 0 100vmax var(--paper)" }}
      />
      <div
        className="absolute rounded-full bg-cream px-4 py-1.5 text-[15px] font-semibold text-ink ring-2 ring-ink/80"
        style={{ left: `${inset + 3}vmin`, top: `${Math.max(inset, 0) + 2}vmin`, opacity: label * Math.min(1, close * 1.5) }}
      >
        就是现在——接住它！
      </div>
    </div>
  );
}

const ENDING_STEPS = ["完整的荷包蛋落在饭中央", "淋上妈妈调的酱汁", "筷子一划，蛋黄流下来"];

export function EndingCard({ t, beats, pin }: Props) {
  const enter = beatPhase(t, beats, "ending", "enter");
  if (enter <= 0) return null;
  const hold = beatPhase(t, beats, "ending", "hold");
  const y = isBeat(t, "outro") ? -pin.releaseVh : 0;
  if (y <= -100) return null;
  const e = sineInOut(enter);
  return (
    <div className="pointer-events-none fixed inset-0 z-20 grid place-items-center" style={{ transform: `translateY(${y}vh)` }}>
      <div className="absolute inset-0 bg-paper" style={{ opacity: 0.92 * e }} />
      <div
        className="relative grid h-[72vh] w-[min(92vw,1100px)] place-items-center rounded-[28px] border-4 border-dashed border-ink/40 bg-cream/80 text-center"
        style={{ opacity: e, transform: `translateY(${(1 - e) * 10}vh) scale(${lerp(0.7, 1, e)})`, transformOrigin: "50% 80%", ...tiltStyle(0.6) }}
      >
        <div>
          <div className="font-mono text-sm text-ink/50">占位 · 结尾近景静态图（未到）</div>
          <div className="mt-6 space-y-3 text-[clamp(18px,2.2vw,28px)] text-ink/80">
            {ENDING_STEPS.map((s, i) => {
              // 停留阶段里三句依次浮现，避免长停留变成空滚；正式版是一张静态图，这里只验证节奏
              const k = sineInOut((hold - i * 0.22) / 0.2);
              return (
                <p key={s} style={{ opacity: i === 0 ? Math.max(e, 0) : k, transform: `translateY(${(1 - (i === 0 ? 1 : k)) * 8}px)` }}>
                  {s}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EndCard({ t, pin }: Props) {
  if (!isBeat(t, "outro")) return null;
  const top = 100 - pin.flowVh;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 grid h-screen place-items-center bg-paper" style={{ transform: `translateY(${top}vh)` }}>
      <div className="text-center text-ink">
        <div className="text-[clamp(40px,7vw,96px)] font-black">完</div>
        <div className="mt-2 text-lg text-ink/70">妈妈的荷包蛋拌饭</div>
        <div className="mt-8 text-sm text-ink/50">往回滚动，倒带再看一遍 ↑</div>
      </div>
    </div>
  );
}

