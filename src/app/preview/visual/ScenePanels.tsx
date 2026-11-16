"use client";
/**
 * 场景层的接蛋格（与蛋同一套场景坐标）。图片、位置、铲面落点都来自 slots.json（可替换、可调）。
 * 顺序：后景的蛋先主动起飞 → 飞到 appearFlight 区间时这一格才出现（妈妈惊讶伸铲）→ 蛋越过这一格的框线落到铲面。
 * 层级：新版（flow）格子 z = Z.catchPanel（纸面之上、桌沿蛋之下，升起时不盖住等待的蛋），旧版 z = Z.mom；飞行中的蛋 z = Z.eggFlying 在格子与框线之上（"打破次元"）。
 * 下一段（handoff）进入时，这一格和后景的蛋一起淡出，由画着蛋的下一格漫画接手，全程只有一颗蛋。
 * 锅铲前沿遮挡层（occluderSrc）目前缺图，蛋压在铲面上方。
 */
import { useEffect } from "react";
import { HANDOFF } from "@/components/kitchen/Egg";
import { SCENE_H, SCENE_W, Z } from "@/lib/scene";
import { phaseProgress } from "@/lib/beats";
import { useScene } from "@/lib/scene-context";
import { Placeholder } from "./ComicLayer";
import { BG, cameraV2, gNow } from "./motion.v2";
import { useViewport } from "./viewport";
import { BubbleText } from "./BubbleText";
import { handoffBox, landedEgg, landPoint, useSlots } from "./slots";

const out3 = (t: number) => 1 - Math.pow(1 - t, 3);

export default function ScenePanels({ debug = false, flow = false }: { debug?: boolean; flow?: boolean }) {
  const { timeline: t, flight } = useScene();
  const { cfg } = useSlots();
  const vp = useViewport();
  const slot = cfg.scene.catch;
  // 预先解码接蛋格、交接格（含遮罩）和蛋的表情图：这些图到接蛋段才第一次挂载，首次解码会在伸铲格出现那一帧卡顿约 0.3 秒
  const warm = [slot.src, ...(slot.frames ?? []), cfg.scene.handoff?.src, cfg.scene.handoff?.eggHoleMask, cfg.egg.faces?.fly, cfg.egg.faces?.rest].filter(Boolean).join("|");
  useEffect(() => {
    for (const src of warm.split("|")) {
      if (!src) continue;
      const im = new Image();
      im.src = src;
      im.decode?.().catch(() => {});
    }
  }, [warm]);
  const [a0, a1] = slot.appearFlight ?? [0.2, 0.45];
  let k = 0;
  if (flow) {
    // 新版：蛋在桌沿等着时，妈妈这一格先从下方升起，在进入阶段的 62% 处就落定；
    // 剩下约 17vh 格子静止、铲面留空，镜头拉回让右侧等待的蛋入画，动作阶段开始蛋才起跳（不会先飞向空白）
    if (t.beat.egg === "flight") k = t.phase === "enter" ? Math.min(1, t.phaseP / 0.62) : 1;
  } else if (t.beat.egg === "flight" && flight !== null) k = Math.min(1, Math.max(0, (flight - a0) / (a1 - a0)));
  const handIn = t.beat.id === "handoff" ? phaseProgress(t, "enter") : 0;
  // 交接（Egg.tsx HANDOFF）：活动蛋先在接蛋格的铲面上回正、以脚底为轴缩到画里那颗蛋的外轮廓宽度；
  // 交接格只在 swap 前很短的区间（约 1vh）淡入，正好在 swap 点完全不透明，活动蛋同时瞬时消失；接蛋格在 swap 之后才离开，
  // 交接前蛋始终站在接蛋格的铲面上。两颗蛋外轮廓同宽、蛋黄重合（slots.ts handoffBox）。
  const span = (v: number, [a, b]: readonly [number, number]) => Math.min(1, Math.max(0, (v - a) / (b - a)));
  if (t.beat.id === "handoff") k = 1 - span(handIn, HANDOFF.catchOut);
  const handOp = span(handIn, HANDOFF.panelIn);
  const hb = handoffBox(cfg);
  const hand = cfg.scene.handoff;
  // 交叉淡化完成后（只剩画里的蛋），交接格平滑移到画面内完整可读的位置
  // 2026-11-16 用户：交接格停在蛋的位置（右边被切掉、还压着上一格）太久：swap 一过（进入阶段后半）就开始往画面内滑，不再等到停留阶段
  if (hb && t.beat.id === "handoff" && (t.phase === "hold" || t.phase === "exit" || (t.phase === "enter" && handIn > HANDOFF.swap + 0.02))) {
    // 以接蛋镜头下实际可见的范围为界（page.tsx 按视口算出；没有时退回 1440×900 的右边界 1340）
    const v = cfg.view ?? { x0: 0, x1: 1340 };
    const m = 16;
    const target = Math.max(v.x0 + m, Math.min(hb[0], v.x1 - m - hb[2]));
    const k2 = t.phase === "enter" ? Math.min(1, (handIn - HANDOFF.swap - 0.02) / (1 - HANDOFF.swap - 0.02)) : 1;
    hb[0] = Math.round(hb[0] + (target - hb[0]) * (k2 * k2 * (3 - 2 * k2)));
  }
  // swap 之前交接格里画的蛋（连手脚）用剪影遮罩挖掉（tools/make_egg_hole.py 生成，不改原图），透出下面接蛋格自己的铲面，
  // 交接格淡入的那约 1vh 里也只看得到活动蛋；swap 起去掉遮罩，画里的蛋接手
  const holeSrc = hand?.eggHoleMask;
  const eggHole = holeSrc && handIn < HANDOFF.swap
    ? { maskImage: `url(${holeSrc})`, WebkitMaskImage: `url(${holeSrc})`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" }
    : {};
  const handNode =
    hand && hb && handIn > 0 && t.beat.id === "handoff" ? (
      <div
        className="panel-frame pointer-events-none absolute"
        style={{ left: hb[0], top: hb[1], width: hb[2], height: hb[3], zIndex: Z.mom + 2, opacity: handOp, containerType: "inline-size" }}
      >
        {/* 挖蛋遮罩只作用在图片上，纸边和纸纹始终完整 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hand.src} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none" style={eggHole} />
        <BubbleText k="handoff" progress={t.phase === "enter" ? 0 : t.phase === "hold" ? Math.min(1, t.phaseP / 0.5) : 1} />
      </div>
    ) : null;
  if (k <= 0) return handNode;
  const [x0, y, w, h] = slot.box;
  // 接蛋格进场时镜头还在从高处往左下落（x 902 → 810），格子是场景里的东西，会被一起带到屏幕左边之外（4:3 窗口左边被切，2026-11-15 检查）。
  // 这里按当前镜头算出左边界，格子的左缘不小于它；镜头落定后（静止阅读）边界已在格子左边，不再起作用。
  let x = x0;
  if (flow && t.beat.id === "catch") {
    const cam = cameraV2(gNow(t));
    const sc = Math.max(vp.w / SCENE_W, vp.h / SCENE_H) * cam.zoom;
    const tx = Math.min(0, Math.max(vp.w - SCENE_W * sc, vp.w * cam.at.x - cam.x * sc));
    x = Math.max(x0, -tx / sc + BG.eggPath.boxMargin);
  }
  const lp = landPoint(slot);
  const e = out3(k);
  return (
    <>
      <div
        className="panel-frame pointer-events-none absolute"
        style={{ left: x, top: y, width: w, height: h, zIndex: flow ? Z.catchPanel : Z.mom, opacity: flow ? 1 : Math.min(1, k * 1.5), transform: `translateY(${(1 - e) * (flow ? 560 : 70)}px)`, containerType: "inline-size" }}
      >
        {slot.frames && slot.frames.length > 1 ? (() => {
          // 伸手序列：妈妈随接蛋段进度把手臂伸出去（交叉淡化），末帧 = 接蛋姿势；其它段（交接）一直是末帧
          const n = slot.frames.length;
          const u = t.beat.id === "catch" ? Math.min(1, Math.max(0, (t.p - 0.06) / 0.36)) : 1;
          // 硬切、不交叉淡化（2026-11-16 用户：手一会儿弯一会儿直）：交叉淡化时相邻两帧的手臂叠在一起，看着是"又弯又直"。
          // 手臂姿势单调：先弯着（第 1 帧）→ 逐渐伸直（第 4 帧 = 接蛋姿势），按进度单向走，不回头。
          const i0 = Math.min(n - 1, Math.floor(u * n));
          const op = (i: number) => (i === i0 ? 1 : 0);
          const prog = t.beat.id === "catch" ? Math.min(1, Math.max(0, (t.p - 0.25) / 0.2)) : 1;
          return (
            <>
              {slot.frames.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" draggable={false} className="absolute inset-0 block h-full w-full select-none object-contain" style={{ opacity: op(i) }} />
              ))}
              <BubbleText k="catch" progress={prog} />
            </>
          );
        })() : slot.src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slot.src} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
            <BubbleText k="catch" progress={t.beat.id === "catch" ? Math.min(1, Math.max(0, (t.p - 0.25) / 0.2)) : 1} />
          </>
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
