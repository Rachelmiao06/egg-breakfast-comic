"use client";
/**
 * 集成预览替身（只在 /dev/beats 用）：在 comic-scroll 交付正式组件前，用用户的妈妈图按节拍表演出前景，
 * 让我们能先调滚动长度。所有显隐、位移都只读 useScene().timeline，不自己计时。
 */
import { envelope, phaseProgress } from "@/lib/beats";
import { MOM_PANELS, MOM_SERVE, MOM_SPATULA, Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";

const Tag = ({ text }: { text: string }) => (
  <span className="absolute left-2 top-2 rounded bg-ink/70 px-1.5 py-0.5 font-mono text-[10px] text-cream">{text}</span>
);

/** 页面层：节拍 1–3 的前景画格替身 */
export function PanelStandIns() {
  const { timeline: t } = useScene();
  return (
    <>
      {(["chop", "stirfry", "sauce"] as const).map((id) => {
        const env = envelope(t, id);
        if (env <= 0) return null;
        const m = MOM_PANELS[id];
        const rise = t.beat.id === id && t.phase === "enter" ? (1 - t.phaseP) * 40 : t.beat.id === id && t.phase === "exit" ? -t.phaseP * 40 : 0;
        return (
          <div key={id} className="pointer-events-none fixed inset-0 z-10 grid place-items-center">
            <div className="relative w-[min(520px,80vw)] rounded-3xl bg-cream/85 p-4 shadow-lg ring-1 ring-ink/10" style={{ opacity: env, transform: `translateY(${rise}px)` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.src} alt="" className="h-auto w-full" style={{ aspectRatio: `${m.w}/${m.h}` }} />
              <Tag text={`替身 · ${id}`} />
            </div>
          </div>
        );
      })}
    </>
  );
}

/** 场景层：伸锅铲妈妈、端碗妈妈的替身（用正式摆放 MOM_SPATULA / MOM_SERVE） */
export function MomStandIn() {
  const { timeline: t } = useScene();
  const id = t.beat.id;
  // 锅铲妈妈：伸锅铲段的进入+动作阶段从右下滑入；接蛋段保持；入碗段的进入阶段淡出
  let spatulaIn = 0;
  if (id === "spatula") spatulaIn = t.phase === "enter" ? t.phaseP * 0.4 : t.phase === "action" ? 0.4 + 0.6 * t.phaseP : 1;
  if (id === "catch") spatulaIn = 1;
  const spatulaOpacity = id === "spatula" ? Math.min(1, spatulaIn * 2.5) : id === "catch" ? 1 : id === "serve" ? 1 - phaseProgress(t, "enter") : 0;
  const slide = (1 - spatulaIn) * 420;
  const serveOpacity = id === "serve" ? phaseProgress(t, "enter") : id === "ending" ? 1 : 0;
  const place = (m: typeof MOM_SPATULA | typeof MOM_SERVE, opacity: number, dx = 0, dy = 0) =>
    opacity > 0 ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={m.src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute select-none"
        style={{ left: m.x, top: m.y, width: m.w * m.scale, height: m.h * m.scale, zIndex: Z.mom, opacity, transform: `translate(${dx}px, ${dy}px)` }}
      />
    ) : null;
  return (
    <>
      {place(MOM_SPATULA, spatulaOpacity, slide, slide * 0.4)}
      {place(MOM_SERVE, serveOpacity)}
    </>
  );
}

/** 页面层：结尾近景替身（静态图未到前的标注占位） */
export function EndingStandIn() {
  const { timeline: t } = useScene();
  const op = t.beat.id === "ending" ? phaseProgress(t, "enter") : 0;
  if (op <= 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-20 grid place-items-center bg-paper/90" style={{ opacity: op }}>
      <div className="grid h-[70vh] w-[min(92vw,1100px)] place-items-center rounded-3xl border-4 border-dashed border-ink/40 font-mono text-ink/60">
        占位：结尾近景（完整荷包蛋在饭中央 → 淋酱汁 → 划开流黄）· 静态图到后替换
      </div>
    </div>
  );
}
