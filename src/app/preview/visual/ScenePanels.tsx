"use client";
/**
 * 场景层的漫画格（和蛋用同一套场景坐标，蛋才能准确越过框线、落到铲面/饭上）。
 * 接蛋格：底图（占位 A1，无蛋）z=Z.mom；框线层（A2）z=Z.mom+1；飞行中的蛋 z=Z.eggFlying 在框线之上 → "打破次元"。
 * 饭碗格：底图（占位 A4，饭中央留空）。锅铲前沿/碗前沿遮挡层（A3/A5）缺图，先用虚线标出位置。
 */
import { ANCHORS, Z } from "@/lib/scene";
import { phaseProgress } from "@/lib/beats";
import { useScene } from "@/lib/scene-context";
import { Placeholder } from "./ComicLayer";

type Box = [number, number, number, number];
const CATCH_BOX: Box = [250, 470, 900, 1000];
const BOWL_BOX: Box = [470, 600, 1070, 1010];

function Frame({ box, z, opacity }: { box: Box; z: number; opacity: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: box[0], top: box[1], width: box[2] - box[0], height: box[3] - box[1], zIndex: z, opacity, outline: "4px solid #2b2118", outlineOffset: "-4px" }}
    />
  );
}

function Mark({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <div className="pointer-events-none absolute" style={{ left: x - 110, top: y - 14, width: 220, height: 28, zIndex: Z.mom + 2 }}>
      <div className="h-full w-full rounded-[50%] border-2 border-dashed border-[#b4532a]" />
      <span className="absolute left-1/2 top-8 -translate-x-1/2 whitespace-nowrap font-mono text-[18px] text-[#b4532a]">{label}</span>
    </div>
  );
}

export default function ScenePanels() {
  const { timeline: t } = useScene();
  const id = t.beat.id;
  const catchIn = id === "catch" ? phaseProgress(t, "enter") : id === "bowl" ? 1 - phaseProgress(t, "enter") : 0;
  const bowlIn = id === "bowl" ? phaseProgress(t, "enter") : id === "ending" ? 1 - phaseProgress(t, "enter") : 0;
  const place = (box: Box, label: string, op: number, slide: number) =>
    op > 0 ? (
      <div className="pointer-events-none absolute" style={{ left: box[0], top: box[1], width: box[2] - box[0], height: box[3] - box[1], zIndex: Z.mom, opacity: op, transform: `translateY(${slide}px)` }}>
        <Placeholder label={label} align="bottom" />
      </div>
    ) : null;
  const slideIn = (k: number) => (1 - (1 - Math.pow(1 - k, 3))) * 60;
  return (
    <>
      {place(CATCH_BOX, "占位 A1 · 接蛋格（无蛋底图）\n\"来，我接着\"：妈妈伸出空锅铲\n（框线 A2 单独一层，蛋从框外飞进来）", catchIn, slideIn(catchIn))}
      {catchIn > 0 && <Frame box={CATCH_BOX} z={Z.mom + 1} opacity={catchIn} />}
      {catchIn > 0.6 && <Mark x={ANCHORS.spatulaLand.x} y={ANCHORS.spatulaLand.y + 6} label="铲面落点（A3 锅铲前沿层缺图）" />}
      {place(BOWL_BOX, "占位 A4 · 饭碗格（饭中央留空）\n放到饭上、淋汁、流黄", bowlIn, slideIn(bowlIn))}
      {bowlIn > 0 && <Frame box={BOWL_BOX} z={Z.mom + 1} opacity={bowlIn} />}
      {bowlIn > 0.6 && <Mark x={ANCHORS.bowlLand.x} y={ANCHORS.bowlLand.y + 6} label="饭中央（A5 碗前沿层缺图）" />}
    </>
  );
}
