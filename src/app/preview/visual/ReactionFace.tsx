"use client";
/**
 * 结尾特写 p6f（妈妈听完"没事，是我拉肚子了"）的反应表演。素材：tools/prepare_p6f_reaction.py → public/assets/comic-v5/p6f/。
 * 六个表情是同一张底图只换脸部，所以底图（wide，瞪大）整格不动，其余表情只是脸部框里的不透明补丁，硬切（不淡入淡出），不会重影：
 *   瞪大 → 眼神下瞥看碗 → 偏向观众 → 半闭眼（死鱼眼）→ 慢眨眼 → 嘴角抽动 → 半闭眼 → 慢眨眼 → 半闭眼 → 又看一下观众（共 13.45 s，取自 p6f-delivery/timeline.txt）
 * 符号：额头黑线 0.2 s 淡入、4.6 s 淡出；汗滴 3.4 s 淡入后以 4px/秒（966 画布）慢慢往下滑，9 s 起淡出。
 * 13.45 s 之后进入长循环（半闭眼为主，不规则地慢眨、嘴角抽动、偶尔看观众），一直停在"愣住"里，不再回到瞪大。
 * 稳定后开始、回滚离开就收起（回到瞪大的底图），再次稳定重新播。减少动态效果 / ?perf=0：只显示底图（瞪大的静帧），没有符号。
 */
import gsap from "gsap";
import { useEffect, useRef } from "react";

const P = "/assets/comic-v5/p6f/";
const W = 966, H = 682;
const BOX = { x: 270, y: 150, w: 375, h: 340 }; // 脸部补丁框（966×682 画布像素）
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
const FACES = ["down", "viewer", "half", "closed", "twitch"] as const;
type Face = "wide" | (typeof FACES)[number];
/** 首段（p6f-delivery/timeline.txt）：[表情, 秒]，共 13.45 s */
const INTRO: [Face, number][] = [["wide", 1.2], ["down", 0.8], ["viewer", 1.3], ["half", 1.8], ["closed", 0.3], ["half", 2], ["twitch", 0.3], ["half", 1.6], ["closed", 0.35], ["half", 3], ["viewer", 0.8]];
/** 长循环：停在半闭眼里，不规则地慢眨、抽动、偶尔看一下观众（各段不同长，重复不容易被看出来） */
const LOOP: [Face, number][] = [["half", 2.4], ["closed", 0.32], ["half", 3.1], ["twitch", 0.3], ["half", 1.9], ["closed", 0.36], ["half", 2.7], ["viewer", 0.9], ["half", 3.4]];

export default function ReactionFace({ active }: { active: boolean }) {
  const els = useRef<Record<string, HTMLImageElement | null>>({});
  useEffect(() => {
    const show = (f: Face) => FACES.forEach((n) => { const el = els.current[n]; if (el) el.style.opacity = n === f ? "1" : "0"; });
    const rest = () => { show("wide"); ["stress", "sweat"].forEach((n) => { const el = els.current[n]; if (el) gsap.set(el, { opacity: 0, y: 0 }); }); };
    rest();
    if (!active) return;
    const tl = gsap.timeline();
    let at = 0;
    INTRO.forEach(([f, d]) => { tl.call(() => show(f), [], at); at += d; });
    const loop = gsap.timeline({ repeat: -1 });
    let l = 0;
    LOOP.forEach(([f, d]) => { loop.call(() => show(f), [], l); l += d; });
    loop.set({}, {}, l); // 补满一圈的时长
    tl.add(loop, at);
    // 符号（时间同 build_animation.py）：黑线淡入淡出；汗滴淡入、慢慢下滑、淡出
    const stress = els.current.stress, sweat = els.current.sweat;
    if (stress) { tl.to(stress, { opacity: 1, duration: 0.6, ease: "none" }, 0.2); tl.to(stress, { opacity: 0, duration: 1, ease: "none" }, 4.6); }
    if (sweat) {
      const dropPx = (24 / H) * (els.current.base?.parentElement?.clientHeight ?? 400); // 6 s × 4px（966×682 画布）
      tl.to(sweat, { opacity: 1, duration: 0.8, ease: "none" }, 3.4);
      tl.to(sweat, { y: dropPx, duration: 6, ease: "none" }, 3.4);
      tl.to(sweat, { opacity: 0, duration: 1.2, ease: "none" }, 9);
    }
    return () => { tl.kill(); loop.kill(); rest(); };
  }, [active]);
  const img = "absolute block select-none pointer-events-none";
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={(el) => { els.current.base = el; }} src={`${P}base.webp`} alt="" draggable={false} className="block h-full w-full select-none object-contain" />
      {FACES.map((n) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={n} ref={(el) => { els.current[n] = el; }} src={`${P}${n}.webp`} alt="" draggable={false} aria-hidden className={img}
          style={{ left: pct(BOX.x, W), top: pct(BOX.y, H), width: pct(BOX.w, W), height: pct(BOX.h, H), opacity: 0 }} />
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={(el) => { els.current.stress = el; }} src={`${P}stress.webp`} alt="" draggable={false} aria-hidden className={img}
        style={{ left: pct(410, W), top: pct(145, H), width: pct(64, W), height: pct(80, H), opacity: 0 }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={(el) => { els.current.sweat = el; }} src={`${P}sweat.webp`} alt="" draggable={false} aria-hidden className={img}
        style={{ left: pct(648, W), top: pct(240, H), width: pct(70, W), height: pct(100, H), opacity: 0 }} />
    </>
  );
}
