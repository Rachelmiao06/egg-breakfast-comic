"use client";
/**
 * 场景层（场景像素，经 KitchenScene 的 foreground 插槽，随镜头一起缩放）：
 * - 发现跳蛋段：锅里蛋旁边一个很小的"！"视线引导（跟着蛋，不随文档流动）；
 * - 📌 接蛋组：锅铲妈妈在伸锅铲的进入 + 动作阶段从右下柔和滑入，接蛋段保持；
 * - 📌 饭碗组：入碗段进入阶段像翻一页食谱换成端碗妈妈，之后保持到结尾。
 * 妈妈图是合并插画：只做整张的进入、翻页换人，不晃身体；速度余韵不作用在这里。
 */
import type { Beat, Timeline } from "@/lib/beats";
import { MOM_SERVE, MOM_SPATULA, SCENE_H, SCENE_W, Z } from "@/lib/scene";
import { beatPhase, isBeat, lerp, sineInOut } from "./motion";

type Placement = typeof MOM_SPATULA | typeof MOM_SERVE;

/** clip：只显示场景 x 在 [from, to) 之间的部分（换人翻页用） */
function Mom({ m, opacity, dx = 0, dy = 0, label, from = -Infinity, to = Infinity }: { m: Placement; opacity: number; dx?: number; dy?: number; label: string; from?: number; to?: number }) {
  const w = m.w * m.scale;
  const left = Math.max(0, from - m.x);
  const right = Math.max(0, m.x + w - to);
  if (opacity <= 0 || left + right >= w) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={m.src}
      alt={label}
      draggable={false}
      className="pointer-events-none absolute select-none"
      style={{
        left: m.x,
        top: m.y,
        width: w,
        height: m.h * m.scale,
        zIndex: Z.mom,
        opacity,
        transform: `translate(${dx}px, ${dy}px)`,
        clipPath: left || right ? `inset(0 ${right}px 0 ${left}px)` : undefined,
      }}
    />
  );
}

export default function MomLayer({ t, beats }: { t: Timeline; beats: Beat[] }) {
  const g = (id: string, ph: "enter" | "action" | "hold" | "exit") => beatPhase(t, beats, id, ph);

  // 锅铲妈妈：进入 + 动作阶段合成一条 0→1 的滑入（sine 缓动，不弹）
  const sp = beats.find((b) => b.id === "spatula")!;
  const enterShare = sp.phases.enter / (sp.phases.enter + sp.phases.action);
  const slideIn = g("spatula", "enter") * enterShare + g("spatula", "action") * (1 - enterShare);
  const e = sineInOut(slideIn);
  // 换人：像翻一页食谱。一条纸边从右往左扫过，纸边右侧已是端碗妈妈、左侧还是锅铲妈妈。
  // 两张合并插画对半溶解会出现"双影"，错开淡化又会让蛋悬空，所以用翻页。纸边最后停在铲面左端之外，
  // 蛋所在的铲面最后才被翻走，紧接着动作阶段蛋跳进碗里。
  const swap = g("serve", "enter");
  const wipeX = lerp(SCENE_W + 40, MOM_SERVE.x - 30, sineInOut(swap));
  const swapping = swap > 0 && swap < 1;
  const spatulaOpacity = Math.min(1, slideIn * 3);

  // 发现跳蛋："！"在进入阶段浮现，动作阶段轻轻放大一次，退出阶段淡去
  const noticeOn = isBeat(t, "notice");
  const bang = noticeOn ? Math.min(1, g("notice", "enter") * 1.2) * (1 - g("notice", "exit")) : 0;
  const pop = 0.85 + 0.15 * sineInOut(g("notice", "action"));

  return (
    <>
      {bang > 0 && (
        <div
          className="pointer-events-none absolute grid place-items-center rounded-full bg-cream font-black text-strawberry shadow-lg ring-4 ring-ink/80"
          style={{ left: 905, top: 170, width: 92, height: 92, fontSize: 64, zIndex: Z.eggFlying, opacity: bang, transform: `scale(${pop}) rotate(8deg)` }}
        >
          ！
        </div>
      )}
      <Mom m={MOM_SPATULA} opacity={spatulaOpacity} dx={(1 - e) * 460} dy={(1 - e) * 300} to={swap > 0 ? wipeX : Infinity} label="妈妈伸出锅铲" />
      <Mom m={MOM_SERVE} opacity={swap > 0 ? 1 : 0} from={swap < 1 ? wipeX : -Infinity} label="妈妈端着饭碗" />
      {swapping && (
        // 翻页的纸边：一条带阴影的米白竖条，跟着 wipeX 走
        <div
          aria-hidden
          className="pointer-events-none absolute bg-cream"
          style={{ left: wipeX - 6, top: 0, width: 12, height: SCENE_H, zIndex: Z.mom + 1, boxShadow: "6px 0 18px rgba(80,50,20,0.25), -2px 0 0 rgba(107,74,43,0.5)" }}
        />
      )}
    </>
  );
}
