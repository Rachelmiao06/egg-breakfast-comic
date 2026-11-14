"use client";
/**
 * 📌 备菜停留组（切配菜 → 炒配菜 → 调汁）：一块"食谱桌面"。
 * - 开场段末尾整块桌面随滚动 1:1 从下方滚进来（第一张切菜卡跟着桌面一起到）；
 * - 停住期间：当前卡在中间，进入阶段从右侧轻轻滑入，动作阶段写出说明，退出阶段退到左侧"已完成"栏缩成小卡；
 * - 组结束：带着三张小卡的整块桌面在"发现跳蛋"段被 1:1 推走。
 * 位置全部来自 sheetY(pinState)，内容全部来自 beatPhase(timeline)。
 */
import type { CSSProperties } from "react";
import type { Beat, PinState, Timeline } from "@/lib/beats";
import { MOM_PANELS } from "@/lib/scene";
import { beatPhase, lerp, sheetY, sineInOut } from "./motion";
import { tiltStyle } from "./VelocityTilt";

const CARDS = [
  { id: "chop", label: "① 切胡萝卜，切葱花", panel: MOM_PANELS.chop },
  { id: "stirfry", label: "② 下锅炒配菜", panel: MOM_PANELS.stirfry },
  { id: "sauce", label: "③ 调一碗拌饭酱汁", panel: MOM_PANELS.sauce },
] as const;

/** 已完成栏里三张小卡的位置（相对视口中心，vw / vh）和固定的"别针"角度 */
const RAIL = [
  { x: -36, y: -21, r: -3 },
  { x: -36, y: 1, r: 2 },
  { x: -36, y: 23, r: -1.5 },
];
const CENTER = { x: 7, y: 2 };
const RAIL_SCALE = 0.3;

export default function PrepBoard({ t, beats, pin }: { t: Timeline; beats: Beat[]; pin: PinState }) {
  const y = sheetY(t, beats, "prep", pin.flowVh, pin.releaseVh);
  if (y >= 100 || y <= -100) return null;
  const groupP = pin.group === "prep" ? pin.groupP : y > 0 ? 0 : 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-10" style={{ transform: `translateY(${y}vh)` }} aria-label="备菜">
      {/* 桌面标题 + 组进度线：停住期间每一段滚动都能看到它在走 */}
      <div className="absolute left-[6vw] top-[6vh] w-[30vw] max-w-[420px]">
        <div className="text-[15px] font-medium tracking-[0.3em] text-ink/70">妈妈在备菜</div>
        <div className="mt-2 h-[3px] rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-strawberry/80" style={{ width: `${groupP * 100}%` }} />
        </div>
      </div>

      {/* 左侧已完成栏的空位（虚线），桌面一进来就看得到结构 */}
      {RAIL.map((r, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 grid place-items-center rounded-xl border-2 border-dashed border-ink/15 font-mono text-xs text-ink/30"
          style={{
            width: "min(17vh, 150px)",
            height: "min(19vh, 170px)",
            transform: `translate(-50%, -50%) translate(${r.x}vw, ${r.y}vh)`,
          }}
        >
          {i + 1}
        </div>
      ))}

      {CARDS.map((c, i) => {
        const enter = beatPhase(t, beats, c.id, "enter");
        const action = beatPhase(t, beats, c.id, "action");
        const exit = beatPhase(t, beats, c.id, "exit");
        // 第一张卡随桌面一起滚进来；后两张在自己的进入阶段才出现
        if (i > 0 && enter <= 0) return null;
        const e = sineInOut(enter);
        const x0 = i === 0 ? CENTER.x : CENTER.x + 34;
        const r0 = i === 0 ? 0 : 2.5;
        const s0 = i === 0 ? 0.94 : 1;
        let x = lerp(x0, CENTER.x, e);
        let yy = CENTER.y;
        let s = lerp(s0, 1, e);
        let r = lerp(r0, 0, e);
        const k = sineInOut(exit);
        const rail = RAIL[i];
        x = lerp(x, rail.x, k);
        yy = lerp(yy, rail.y, k);
        s = lerp(s, RAIL_SCALE, k);
        r = lerp(r, rail.r, k);
        const opacity = i === 0 ? 1 : Math.min(1, enter * 1.6);
        const style: CSSProperties = {
          transform: `translate(-50%, -50%) translate(${x}vw, ${yy}vh) rotate(${r}deg) scale(${s})`,
          opacity,
          zIndex: 10 + i,
        };
        return (
          <div key={c.id} className="absolute left-1/2 top-1/2" style={style}>
            {/* 速度余韵只加在"正在读"的卡上，退到栏里的小卡不晃 */}
            <figure
              className="rounded-[22px] bg-cream p-3 shadow-[0_18px_40px_-18px_rgba(60,40,20,0.45)] ring-1 ring-ink/10"
              style={exit < 1 ? tiltStyle() : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.panel.src}
                alt=""
                draggable={false}
                className="block select-none rounded-[14px]"
                style={{ height: "min(56vh, 520px)", width: "auto", aspectRatio: `${c.panel.w}/${c.panel.h}` }}
              />
              <figcaption
                className="mt-2 px-1 text-[17px] font-medium text-ink/80"
                style={{ clipPath: `inset(0 ${(1 - action) * 100}% 0 0)` }}
              >
                {c.label}
              </figcaption>
            </figure>
          </div>
        );
      })}
    </div>
  );
}
