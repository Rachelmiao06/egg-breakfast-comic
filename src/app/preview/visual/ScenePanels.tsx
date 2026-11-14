"use client";
/**
 * 场景层的接蛋格（与蛋同一套场景坐标）。图片、位置、铲面落点都来自 slots.json（可替换、可调）。
 * 顺序：后景的蛋先主动起飞 → 飞到 appearFlight 区间时这一格才出现（妈妈惊讶伸铲）→ 蛋越过这一格的框线落到铲面。
 * 层级：格子 z = Z.mom；飞行中的蛋 z = Z.eggFlying 在格子与框线之上（"打破次元"）。
 * 下一段（handoff）进入时，这一格和后景的蛋一起淡出，由画着蛋的下一格漫画接手，全程只有一颗蛋。
 * 锅铲前沿遮挡层（occluderSrc）目前缺图，蛋压在铲面上方。
 */
import { Z } from "@/lib/scene";
import { phaseProgress } from "@/lib/beats";
import { useScene } from "@/lib/scene-context";
import { Placeholder } from "./ComicLayer";
import { landPoint, useSlots } from "./slots";

const out3 = (t: number) => 1 - Math.pow(1 - t, 3);

export default function ScenePanels({ debug = false }: { debug?: boolean }) {
  const { timeline: t, flight } = useScene();
  const { cfg } = useSlots();
  const slot = cfg.scene.catch;
  const [a0, a1] = slot.appearFlight ?? [0.2, 0.45];
  let k = 0;
  if (t.beat.egg === "flight" && flight !== null) k = Math.min(1, Math.max(0, (flight - a0) / (a1 - a0)));
  if (t.beat.id === "handoff") k = 1 - phaseProgress(t, "enter");
  if (k <= 0) return null;
  const [x, y, w, h] = slot.box;
  const lp = landPoint(slot);
  const e = out3(k);
  return (
    <>
      <div
        className="pointer-events-none absolute"
        style={{ left: x, top: y, width: w, height: h, zIndex: Z.mom, opacity: Math.min(1, k * 1.5), transform: `translateY(${(1 - e) * 70}px)` }}
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
      {debug && (
        <div className="pointer-events-none absolute" style={{ left: lp.x - 12, top: lp.y - 12, width: 24, height: 24, zIndex: Z.eggFlying + 2, border: "2px solid #e0442a", borderRadius: "50%" }} />
      )}
    </>
  );
}
