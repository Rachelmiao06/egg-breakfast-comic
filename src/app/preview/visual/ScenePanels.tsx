"use client";
/**
 * 场景层的接蛋格（与蛋同一套场景坐标）。图片、位置、铲面落点都来自 slots.json（可替换、可调）。
 * 顺序：后景的蛋先主动起飞 → 飞到 appearFlight 区间时这一格才出现（妈妈惊讶伸铲）→ 蛋越过这一格的框线落到铲面。
 * 层级：新版（flow）格子 z = Z.catchPanel（纸面之上、桌沿蛋之下，升起时不盖住等待的蛋），旧版 z = Z.mom；飞行中的蛋 z = Z.eggFlying 在格子与框线之上（"打破次元"）。
 * 下一段（handoff）进入时，这一格和后景的蛋一起淡出，由画着蛋的下一格漫画接手，全程只有一颗蛋。
 * 锅铲前沿遮挡层（occluderSrc）目前缺图，蛋压在铲面上方。
 */
import { HANDOFF } from "@/components/kitchen/Egg";
import { Z } from "@/lib/scene";
import { phaseProgress } from "@/lib/beats";
import { useScene } from "@/lib/scene-context";
import { Placeholder } from "./ComicLayer";
import { handoffBox, landedEgg, landPoint, useSlots } from "./slots";

const out3 = (t: number) => 1 - Math.pow(1 - t, 3);

export default function ScenePanels({ debug = false, flow = false }: { debug?: boolean; flow?: boolean }) {
  const { timeline: t, flight } = useScene();
  const { cfg } = useSlots();
  const slot = cfg.scene.catch;
  const [a0, a1] = slot.appearFlight ?? [0.2, 0.45];
  let k = 0;
  if (flow) {
    // 新版：蛋在桌沿等着时，妈妈这一格先从下方升起；蛋随后起跳飞进来
    if (t.beat.egg === "flight") k = t.phase === "enter" ? t.phaseP : 1;
  } else if (t.beat.egg === "flight" && flight !== null) k = Math.min(1, Math.max(0, (flight - a0) / (a1 - a0)));
  const handIn = t.beat.id === "handoff" ? phaseProgress(t, "enter") : 0;
  // 交接：接蛋格先较快淡出，交接格稍后淡入，减少两格重叠的时间
  if (t.beat.id === "handoff") k = 1 - Math.min(1, handIn * 1.6);
  // 交接格在活动蛋下方淡入，画里的蛋被活动蛋整颗盖住；交接格不透明后活动蛋在 HANDOFF.swap 瞬时消失（Egg.tsx），不出现两张脸
  const handOp = Math.min(1, Math.max(0, (handIn - HANDOFF.panelIn[0]) / (HANDOFF.panelIn[1] - HANDOFF.panelIn[0])));
  const hb = handoffBox(cfg);
  const hand = cfg.scene.handoff;
  // 交叉淡化完成后（只剩画里的蛋），交接格平滑移到画面内完整可读的位置
  if (hb && t.beat.id === "handoff" && (t.phase === "hold" || t.phase === "exit")) {
    // 以接蛋镜头下实际可见的范围为界（page.tsx 按视口算出；没有时退回 1440×900 的右边界 1340）
    const v = cfg.view ?? { x0: 0, x1: 1340 };
    const m = 16;
    const target = Math.max(v.x0 + m, Math.min(hb[0], v.x1 - m - hb[2]));
    const k2 = t.phase === "hold" ? Math.min(1, t.phaseP / 0.35) : 1;
    hb[0] = Math.round(hb[0] + (target - hb[0]) * (k2 * k2 * (3 - 2 * k2)));
  }
  const handNode =
    hand && hb && handIn > 0 && t.beat.id === "handoff" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={hand.src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute select-none"
        style={{ left: hb[0], top: hb[1], width: hb[2], height: hb[3], zIndex: Z.mom + 2, opacity: handOp }}
      />
    ) : null;
  if (k <= 0) return handNode;
  const [x, y, w, h] = slot.box;
  const lp = landPoint(slot);
  const e = out3(k);
  return (
    <>
      <div
        className="pointer-events-none absolute"
        style={{ left: x, top: y, width: w, height: h, zIndex: flow ? Z.catchPanel : Z.mom, opacity: flow ? 1 : Math.min(1, k * 1.5), transform: `translateY(${(1 - e) * (flow ? 560 : 70)}px)` }}
      >
        {slot.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slot.src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
        ) : (
          <Placeholder label={slot.label} align="bottom" />
        )}
      </div>
      {slot.occluderSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slot.occluderSrc} alt="" className="pointer-events-none absolute" style={{ left: x, top: y, width: w, height: h, zIndex: Z.eggFlying + 1, opacity: Math.min(1, k * 1.5) }} />
      )}
      {/* 落在铲面的接触影子：蛋接近铲面时出现、变小变深，与落点同步（铲面本身不下沉：素材不支持） */}
      {flight !== null && flight > 0.82 && t.beat.id === "catch" && (() => {
        const e = landedEgg(cfg);
        const near = Math.min(1, (flight - 0.82) / 0.18);
        const w = e.w * (1.05 - 0.25 * near);
        return (
          <div
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              left: lp.x - w / 2,
              top: lp.y - w * 0.09,
              width: w,
              height: w * 0.18,
              zIndex: Z.eggFlying - 1,
              borderRadius: "50%",
              background: "radial-gradient(ellipse at center, rgba(60,36,14,0.42), rgba(60,36,14,0) 70%)",
              opacity: 0.2 + 0.8 * near,
            }}
          />
        );
      })()}
      {debug && (
        <div className="pointer-events-none absolute" style={{ left: lp.x - 12, top: lp.y - 12, width: 24, height: 24, zIndex: Z.eggFlying + 2, border: "2px solid #e0442a", borderRadius: "50%" }} />
      )}
      {handNode}
    </>
  );
}
