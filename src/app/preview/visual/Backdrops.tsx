"use client";
/**
 * 后景换场（连续版）。全部数据在 backgrounds.json；正式图到位后只改那里的 src / srcPortrait，不改这个文件。
 *
 * 一条连续的后景，按故事顺序：
 *   厨房分层（KitchenLayers，只读）
 *   → 桌沿 + 纸面：<Paper/>，场景层 z = Z.paper，在近景物件之上、桌沿蛋之下。
 *       一个跟随主体层视差（--kl-mid-x/y，和蛋的 FollowMid 同一组变量）的整体：
 *       B1 桌沿带（table）在下，纸面（paper）在上，纸面下沿羽化到桌面上。蛋和桌沿因此锁在一起。
 *   → 环境段 prejump（桌沿上的蛋准备起跳）：纸面降到半透明（curves.paper），活着的厨房从桌沿后面透出来，
 *       这一段没有漫画格，后景就是画面主体。
 *   → 饭桌：蛋交给漫画之后（curves.dinner），纸面 + 桌沿整体下移 22 场景像素（饭桌更近，桌面让出碗的底座）。
 *   → （旧）环境段 tablecall 和 B3 背景饭碗：2026-11-15 饭碗方案 B 删除，curves.bowl 恒为 0，TableBowl 不再显示；
 *       接住之后蛋只在漫画里。
 *   → 寻找段外围：<SearchBackdrop/> 里的 SearchSurround，页面层（fixed z-5，漫画之下），横版 / 竖版两张，
 *       进场时从右往左持续漂移（curves.doorwayDrift），像镜头转到家里另一处；淡出后露回饭桌。
 *   → 收尾：<SearchBackdrop/> 里的 EndingSheet，干净暖米白平涂，盖住一切（含桌沿）。
 *
 * 规则：只改不透明度和位移；不卸载任何角色层（各层自己在不透明度≈0 时返回 null，蛋不受影响）；
 * 不画第二只蛋或锅；占位只用平涂色块，说明文字只在 ?debug=1 显示。
 * 导出名 Paper / SearchBackdrop。
 */
import gsap from "gsap";
import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { KITCHEN_ONESHOT_EVENT } from "@/components/kitchen/useKitchenAudio";
import type { Beat, Timeline } from "@/lib/beats";
import { Z } from "@/lib/scene";
import { useScene } from "@/lib/scene-context";
import { BG, curve, gNow } from "./motion.v2";
import { HEAR_EVENT } from "./PanelPerf";
import { useViewport } from "./viewport";
import { PANELS, useSlots } from "./slots";
import { eggAtTableFor, tableWaitFor } from "./eggPath";

type Keys = [string, number, number][];
type CurveName = keyof typeof BG.curves;
/** 读一条后景曲线（backgrounds.json curves） */
export const bgCurve = (name: CurveName, g: number) => curve(BG.curves[name] as Keys, g);

/** 当前各后景层的状态（预览 HUD 和无头检查也读它） */
export function backgroundState(g: number) {
  const paper = bgCurve("paper", g);
  const table = bgCurve("table", g);
  const doorway = bgCurve("doorway", g);
  const ending = bgCurve("ending", g);
  const bowl = bgCurve("bowl", g);
  const lift = bgCurve("dinner", g);
  const reading = BG.reading.src ? bgCurve("reading", g) : 0;
  const name =
    ending > 0.5
      ? "ending"
      : doorway > 0.5
        ? "search"
        : bowl > 0.5
          ? "table-call"
          : reading > 0.5
            ? "kitchen-friends"
            : table > 0.5
              ? lift > 1
                ? "dinner-table"
                : paper < 0.9
                  ? "table-edge+kitchen"
                  : "table-edge"
              : "kitchen";
  const listen = bgCurve("listenFocus", g);
  return { paper, table, doorway, ending, bowl, lift, reading, listen, listenPush: bgCurve("listenPush", g), drift: bgCurve("doorwayDrift", g) * BG.doorway.driftPct, name: name === "kitchen-friends" && listen > 0.5 ? "listen-corner" : name };
}

const SHOW = 0.001;

/** 纸面 + B1 桌沿带 + B3 饭桌上的碗（场景层）。名字沿用 Paper，页面不用改。 */
export function Paper() {
  const { timeline: t } = useScene();
  const debug = useDebugFlag();
  const s = backgroundState(gNow(t));
  return (
    <>
      {BG.reading.src ? (
        (s.reading > SHOW || s.paper > SHOW) && (
          <div
            aria-hidden
            data-bg="table-group"
            className="pointer-events-none absolute left-0 top-0 h-full w-full"
            style={{ zIndex: Z.paper, translate: `var(--kl-mid-x, 0px) calc(var(--kl-mid-y, 0px) + ${s.lift.toFixed(2)}px)` }}
          >
            {/* 新厨房直接叠化盖过旧厨房（drop 0.3–0.6，不经过整屏米白的纸面）；纸面只在新厨房未满时作底 */}
            {s.paper > SHOW && s.reading < 0.999 && <PaperSheet opacity={s.paper} />}
            {s.reading > SHOW && <ReadingKitchen reveal={s.reading} />}
          </div>
        )
      ) : (s.paper > SHOW || s.table > SHOW) && (
        <div
          aria-hidden
          data-bg="table-group"
          className="pointer-events-none absolute left-0 top-0 h-full w-full"
          style={{ zIndex: Z.paper, translate: `var(--kl-mid-x, 0px) calc(var(--kl-mid-y, 0px) + ${s.lift.toFixed(2)}px)` }}
        >
          {s.table > SHOW && <TableBand opacity={s.table} debug={debug} />}
          {s.paper > SHOW && <PaperSheet opacity={s.paper} />}
        </div>
      )}
      {s.bowl > SHOW && <TableBowl opacity={s.bowl} debug={debug} />}
    </>
  );
}

/**
 * 阅读段主后景：家里厨房里偷偷活过来的食材和调料（new pics 素材，backgrounds.json reading）。
 * 按原比例铺在 reading.box（场景像素），台面前缘对齐桌沿线，台面就是蛋站立和放碗的桌面；竖屏用竖版。
 * 两条零高度标记线（data-bg-line="top" / "edge"）= 台面后缘 / 前缘，给无头检查量“蛋脚底在桌面上”。
 */
/**
 * 围观群众：酱油瓶、糖罐、葱听见前景的动静，半拍之后各自"一惊"——以脚底（原有的旋转支点）为原点短暂放大约 4% 再回落。
 * 只放大不位移，所以不会露出被补过的底图；用单独的 scale 属性做，不碰滚动在控制的 rotate。
 * 听的是：切菜每一刀（chopHit）→ 葱；"啵"（点蛋，或 hear 格妈妈抬眼 / 蛋起跳）→ 糖罐、酱油瓶；
 * 接蛋前画外的轻跳 / 结尾三个点的嗒（hopTap）→ 酱油瓶。没有声音，也不加对白。减少动态效果时不做。
 */
function useFriendReactions(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const ids: number[] = [];
    const startle = (id: string, delay: number) => {
      ids.push(window.setTimeout(() => {
        document.querySelector<HTMLElement>(`[data-actor="${id}"]`)?.animate(
          [{ scale: "1" }, { scale: "1.045", offset: 0.3 }, { scale: "0.992", offset: 0.65 }, { scale: "1" }],
          { duration: 340, easing: "ease-out" },
        );
      }, delay));
    };
    const onShot = (e: Event) => {
      const s = (e as CustomEvent<{ sound?: string }>).detail?.sound ?? "";
      if (s === "chopHit") startle("scallion-leaves", 140);
      else if (s === "pop") { startle("jar", 100); startle("soy", 210); }
      else if (/^hopTap[123]$/.test(s)) startle("soy", 120);
    };
    const onHear = (e: Event) => {
      if ((e as CustomEvent<{ phase?: string }>).detail?.phase === "start") { startle("jar", 420); startle("soy", 560); }
    };
    window.addEventListener(KITCHEN_ONESHOT_EVENT, onShot);
    window.addEventListener(HEAR_EVENT, onHear);
    return () => {
      ids.forEach((id) => window.clearTimeout(id));
      window.removeEventListener(KITCHEN_ONESHOT_EVENT, onShot);
      window.removeEventListener(HEAR_EVENT, onHear);
    };
  }, [enabled]);
}

/** 画格在场的程度（远景软化用）：本段有画格为 1、没有为 0；只在与"没有画格的段"相邻的进入 / 退出阶段渐变，两个有画格的段之间保持 1 */
function panelPresence(t: Timeline, beats: Beat[]) {
  const has = (b: Beat | undefined) => !!b && PANELS.some((p) => p.beat === b.id && !p.hideInFlow && p.role !== "closeup");
  if (!has(t.beat)) return 0;
  if (t.phase === "enter" && !has(beats[t.index - 1])) return t.phaseP;
  if (t.phase === "exit" && !has(beats[t.index + 1])) return 1 - t.phaseP;
  return 1;
}

/** 阅读厨房图上沿之上补的天花板高度（场景像素，够镜头抬到最高处） */
const CEILING_H = 700;
/** 阅读厨房图往上的延伸（2026-11-15 用户送来的 kitchen-upper.png，1672×760，底部 140px 和原图顶部 140px 逐像素一致）：
 *  放在远景层里（和墙一起动），图片像素 y = -(760 - 140) = -620 起；它之上再用原来的拉伸渐隐补一条（镜头抬到最高处才用得上） */
const UPPER = { src: "/assets/bg/kitchen-upper.webp", w: 1672, h: 760, overlap: 140 };

function ReadingKitchen({ reveal }: { reveal: number }) {
  const R = BG.reading;
  const vp = useViewport();
  const { timeline: t, reducedMotion, beats } = useScene();
  const { cfg } = useSlots();
  useFriendReactions(!reducedMotion);
  const portrait = !!R.srcPortrait && vp.w / vp.h < R.portraitBelow;
  const [x, y, w, h] = portrait ? R.boxPortrait : R.box;
  const c = portrait ? R.counterPortrait : R.counter;
  // 横版有拆好的小角色层：底图换成补好的那张，角色和遮挡物叠在上面（角度 0 时与原图一致）
  const actors = !portrait && R.srcBase ? R.actors : [];
  const src = portrait ? R.srcPortrait : actors.length ? R.srcBase : R.src;
  const [iw, ih] = R.size;
  const pct = (b: number[]) => ({ left: `${(b[0] / iw) * 100}%`, top: `${(b[1] / ih) * 100}%`, width: `${(b[2] / iw) * 100}%`, height: `${(b[3] / ih) * 100}%` });
  const g = gNow(t);
  // drop 换场：新厨房从蛋的落点（eggPath 按当前布局算出的桌沿等待点，蛋身中部）以软边圆形向外扩开，盖过旧厨房。
  // 进度就是 curves.reading（滚动驱动、可逆）；只改 CSS mask 的半径，不重绘图片。半径到 1 时覆盖整张图的最远角，之后去掉 mask。
  // 减少动态效果：不做扩散，改成很短的叠化（reading 0.4 → 0.6）。
  const wait = tableWaitFor(cfg);
  const cx = wait.x - x, cy = wait.y - 388 * eggAtTableFor(cfg) * 0.5 - y;
  const rMax = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy));
  const soft = rMax * 0.22;
  const radius = reveal * (rMax + soft);
  const opacity = reducedMotion ? Math.min(1, Math.max(0, (reveal - 0.4) / 0.2)) : reveal > 0.001 ? 1 : 0;
  const mask = !reducedMotion && reveal < 0.999 ? `radial-gradient(circle at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, #000 ${Math.max(0, radius - soft).toFixed(1)}px, transparent ${radius.toFixed(1)}px)` : undefined;
  // listen（接蛋前的声音停顿）：段内整张图缓慢推近，台面前沿多推一点（纵深），墙上暖光和窗光带；减少动态效果时只留静止的光
  const LS = R.listen;
  const lf = bgCurve("listenFocus", g);
  const lp = reducedMotion ? 0 : bgCurve("listenPush", g);
  const lq = lf * lf * (3 - 2 * lf);
  const lfoc = portrait ? LS.focusPortrait : LS.focus;
  const [liw, lih] = portrait ? R.sizePortrait : R.size;
  const near = portrait ? LS.nearPortrait : LS.near;
  const L = portrait ? LS.lightPortrait : LS.light;
  const lx = L.from[0] + (L.to[0] - L.from[0]) * lp, ly = L.from[1] + (L.to[1] - L.from[1]) * lp;
  const lpct = (b: number[]) => ({ left: `${(b[0] / liw) * 100}%`, top: `${(b[1] / lih) * 100}%`, width: `${(b[2] / liw) * 100}%`, height: `${(b[3] / lih) * 100}%` });
  // 纵深（reading.planes，横版拆层时）：远景层（墙、瓷砖、吊柜、窗）比主体层少动；近景层（整条台面加站在台面上的
  // 层板架、罐子、盆栽、菜篮、葱，连同小角色）是一块刚体跟主体层走，盖在远景层上：台面后沿和物件的轮廓在墙上滑动。
  // 画格在场时远景软化（预烘的软化版叠化进来，小角色和窗玻璃加一点模糊）。竖版没有拆层，保持单张。
  const PL = !portrait && actors.length ? R.planes : null;
  const farSoft = PL && !reducedMotion ? panelPresence(t, beats) : 0;
  const farRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!PL) return;
    const root = document.documentElement.style;
    const num = (name: string) => parseFloat(root.getPropertyValue(name)) || 0;
    const tick = () => {
      const far = farRef.current;
      if (!far) return;
      const dx = num("--kl-mouse-x") * PL.far.mouse + num("--kl-depth-x") * PL.far.depth;
      const dy = num("--kl-mouse-y") * PL.far.mouseY + num("--kl-depth-y") * PL.far.depthY + num("--kl-drift") * PL.far.drift;
      far.style.translate = `${dx.toFixed(2)}px ${dy.toFixed(2)}px`;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [PL]);
  const blur = (px: number): CSSProperties | undefined => (PL && farSoft > 0.01 ? { filter: `blur(${(px * farSoft).toFixed(2)}px)` } : undefined);
  const actorEls = actors.map((a) => {
    const deg = reducedMotion ? 0 : Math.min(a.range[1], Math.max(a.range[0], bgCurve(a.curve as CurveName, g)));
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={a.id}
        data-actor={a.id}
        src={a.src}
        alt=""
        draggable={false}
        className="absolute select-none"
        style={{ ...pct(a.img), ...blur(PL?.soft.friendsBlur ?? 0), transform: `rotate(${deg.toFixed(2)}deg)`, transformOrigin: `${((a.pivot[0] - a.img[0]) / a.img[2]) * 100}% ${((a.pivot[1] - a.img[1]) / a.img[3]) * 100}%` }}
      />
    );
  });
  // 远景：窗外的树比墙面慢一点（横向），阅读停留时镜头不动，它也不动；减少动态效果时不做
  const windowEls =
    !portrait &&
    !reducedMotion &&
    R.window.panes.map((p, i) => {
      const pw = p[2] - p[0], ph = p[3] - p[1];
      return (
        <div key={i} data-window-pane={i} className="absolute overflow-hidden" style={pct([p[0], p[1], pw, ph])}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{
              left: `${(-p[0] / pw) * 100}%`,
              top: `${(-p[1] / ph) * 100}%`,
              width: `${(iw / pw) * 100}%`,
              height: `${(ih / ph) * 100}%`,
              transformOrigin: `${((p[0] + pw / 2) / iw) * 100}% ${((p[1] + ph / 2) / ih) * 100}%`,
              transform: `scale(${R.window.scale})`,
              // 拆层时窗在远景平面里，只再多一点横向鼠标视差；未拆层时按厨房中景与主体层的差值
              translate: PL ? `calc(var(--kl-mouse-x, 0) * ${PL.windowMouse}px) 0px` : `calc((var(--kl-counter-x, 0px) - var(--kl-mid-x, 0px)) * ${R.window.parallax}) 0px`,
              ...blur(PL?.soft.windowBlur ?? 0),
            }}
          />
        </div>
      );
    });
  const occluderEls =
    actors.length > 0 &&
    R.occluders.map((o) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img key={o.id} data-occluder={o.id} src={o.src} alt="" draggable={false} className="absolute select-none" style={{ ...pct(o.img), ...blur(PL?.soft.friendsBlur ?? 0) }} />
    ));
  return (
    <div
      data-bg="reading"
      data-variant={portrait ? "portrait" : "landscape"}
      className="absolute"
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        opacity,
        maskImage: mask,
        WebkitMaskImage: mask,
        transformOrigin: `${(lfoc[0] / liw) * 100}% ${(lfoc[1] / lih) * 100}%`,
        transform: lq > 0.001 ? `scale(${(1 + LS.push * lp * lq).toFixed(4)})` : undefined,
      }}
    >
      {/* 天花板（2026-11-15 用户：飞起来时镜头抬高，背景穿帮——这张图的上沿之上没画天花板，露出了旧厨房的墙）：
          图的最上面几行往上拉伸、渐隐，再铺一层奶油色的天花板底；只在横版画（竖版的 box 本来就伸出画面）。
          底图盖在远景层之下、多垫 8px，远景层的小幅视差不会露缝。 */}
      {!portrait && (
        <div aria-hidden data-bg="ceiling" className="pointer-events-none absolute" style={{ left: 0, top: -CEILING_H - ((UPPER.h - UPPER.overlap) / ih) * h, width: "100%", height: CEILING_H + 8, background: "linear-gradient(to bottom, #f7e4c4, #fbe9cb)" }}>
          <div className="absolute left-0 w-full overflow-hidden" style={{ bottom: 0, height: 120, filter: "blur(9px)", WebkitMaskImage: "linear-gradient(to top, #000 5%, transparent 85%)", maskImage: "linear-gradient(to top, #000 5%, transparent 85%)" }}>
            <div className="absolute left-0 w-full overflow-hidden" style={{ bottom: 0, height: 6, transform: "scaleY(27)", transformOrigin: "bottom" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PL ? UPPER.src : src} alt="" draggable={false} className="absolute left-0 top-0 max-w-none select-none" style={{ width: w, height: PL ? (h * UPPER.h) / ih : h }} />
            </div>
          </div>
        </div>
      )}
      {PL ? (
        <>
          {/* 远景层：墙、瓷砖、吊柜、窗；比主体层少动（ticker 写 translate）。台面后沿以下多画了几十行墙，往上走时不露底 */}
          <div ref={farRef} data-plane="far" className="absolute inset-0" style={{ willChange: "translate" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={UPPER.src} alt="" draggable={false} className="absolute select-none" style={pct([0, -(UPPER.h - UPPER.overlap), UPPER.w, UPPER.h])} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PL.far.src} alt="" draggable={false} className="absolute select-none" style={pct(PL.far.img)} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img data-plane-soft src={PL.soft.src} alt="" draggable={false} className="absolute select-none" style={{ ...pct(PL.far.img), opacity: farSoft }} />
            {windowEls}
          </div>
          {/* 近景层：整条台面（蛋站的地方）加站在台面上的东西，和小角色、遮挡物一起跟主体层走，不拉伸，盖住远景层 */}
          <div data-plane="near" className="absolute inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PL.near.src} alt="" draggable={false} className="absolute select-none" style={pct(PL.near.img)} />
            {/* 道具切片（层板架、葱身子、菜篮）：蛋的支点，独立图片 */}
            {PL.props.items.map((it) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={it.id} data-prop={it.id} src={it.src} alt="" draggable={false} className="absolute select-none" style={pct(it.img)} />
            ))}
            {actorEls}
            {occluderEls}
          </div>
        </>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
          {actorEls}
          {windowEls}
          {occluderEls}
        </>
      )}
      {lq > 0.001 && (
        <>
          {/* 台面前沿近景层：以底边中点为原点再多推近一点，只往外长、盖住台面 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-listen-near
            src={near.src}
            alt=""
            draggable={false}
            className="absolute select-none"
            style={{ ...lpct(near.img), transformOrigin: "50% 100%", transform: `scale(${(1 + LS.nearPush * lp * lq).toFixed(4)})` }}
          />
          <div
            data-listen-light
            className="absolute"
            style={{
              ...lpct([lx - L.r[0], ly - L.r[1], 2 * L.r[0], 2 * L.r[1]]),
              background: `radial-gradient(closest-side, ${L.color}, rgba(255,232,186,0))`,
              mixBlendMode: "screen",
              opacity: lq * 0.9,
            }}
          />
          <div
            data-listen-band
            className="absolute inset-y-0"
            style={{
              left: `${LS.band.from + (LS.band.to - LS.band.from) * lp}%`,
              width: `${LS.band.width}%`,
              background: `linear-gradient(90deg, rgba(255,244,214,0), ${LS.band.color}, rgba(255,244,214,0))`,
              transform: `skewX(${LS.band.angle}deg)`,
              transformOrigin: "50% 100%",
              mixBlendMode: "screen",
              opacity: lq,
            }}
          />
        </>
      )}
      <div data-bg-line="top" className="absolute left-0 h-0 w-full" style={{ top: c.backY - y }} />
      <div data-bg-line="edge" className="absolute left-0 h-0 w-full" style={{ top: c.frontY - y }} />
    </div>
  );
}

/**
 * B3 饭桌上的碗：两层，夹住碗里的蛋（Z.eggOnTable 63）。
 *   碗身 / 碗内（data-bg="bowl"）z = Z.paper，DOM 在纸面组之后，所以画在纸面之上、蛋之下；
 *   前沿遮挡层（data-bg="bowl-front"）z = Z.bowlFront，挡住蛋的下部。
 * 坐标全部相对 anchors.tableBowl；只跟随主体层视差（和蛋的 FollowMid 一样），不跟随饭桌位移。
 * 图片：bowl.src（碗身）和 bowl.srcFront（前沿遮挡层，透明底）都铺满 bowl.box。现在接的是复用素材（第 3 页 p3b 的碗，tools/prepare_bowl.py）；
 * 两个 src 都为 null 时退回平涂 SVG 占位，无纹理。
 */
function TableBowl({ opacity, debug }: { opacity: number; debug: boolean }) {
  const B = BG.bowl;
  const a = BG.anchors.tableBowl;
  const [bx, by, bw, bh] = B.box;
  const cx = a.x;
  const rimY = a.y + B.rim.dy;
  const { rx, ry } = B.rim;
  const baseY = a.y + B.baseDy;
  const footY = a.y + B.footDy;
  const hw = B.baseHalfW;
  const P = B.placeholder;
  const follow = { translate: "var(--kl-mid-x, 0px) var(--kl-mid-y, 0px)" } as const;
  const layer = "pointer-events-none absolute left-0 top-0 h-full w-full";
  // 碗身外轮廓（前半）：前沿下弧 → 右侧弧线到底座 → 底座 → 左侧弧线回到碗沿
  const body = `M ${cx - rx} ${rimY} A ${rx} ${ry} 0 0 0 ${cx + rx} ${rimY} C ${cx + rx - 6} ${rimY + 55}, ${cx + hw + 30} ${baseY}, ${cx + hw} ${baseY} L ${cx - hw} ${baseY} C ${cx - hw - 30} ${baseY}, ${cx - rx + 6} ${rimY + 55}, ${cx - rx} ${rimY} Z`;
  const img = (src: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" draggable={false} className="absolute select-none" style={{ left: cx + bx, top: a.y + by, width: bw, height: bh }} />
  );
  return (
    <>
      <div aria-hidden data-bg="bowl" className={layer} style={{ zIndex: Z.paper, opacity, ...follow }}>
        {/* 接触阴影（代码画，平涂）：正式图和占位都用 */}
        <svg className="absolute left-0 top-0 overflow-visible" width={1} height={1}>
          <ellipse cx={cx} cy={footY + 2} rx={rx * 0.62} ry={9} fill={P.shadow} />
          {!B.src && <ellipse cx={cx} cy={rimY} rx={rx} ry={ry} fill={P.inside} stroke={P.line} strokeWidth={3} />}
        </svg>
        {B.src && img(B.src)}
      </div>
      <div aria-hidden data-bg="bowl-front" className={layer} style={{ zIndex: Z.bowlFront, opacity, ...follow }}>
        {B.srcFront ? (
          img(B.srcFront)
        ) : (
          <svg className="absolute left-0 top-0 overflow-visible" width={1} height={1}>
            <path d={body} fill={P.body} stroke={P.line} strokeWidth={3} strokeLinejoin="round" />
            <path d={`M ${cx - hw + 8} ${baseY} L ${cx - hw + 14} ${footY} L ${cx + hw - 14} ${footY} L ${cx + hw - 8} ${baseY} Z`} fill={P.body} stroke={P.line} strokeWidth={3} strokeLinejoin="round" />
          </svg>
        )}
        <div data-bg-line="bowl-rim" className="absolute h-0" style={{ left: cx - rx, top: rimY + ry, width: rx * 2 }} />
        {debug && !B.srcFront && (
          <span className="absolute whitespace-nowrap rounded bg-white/75 px-2 py-1 font-mono text-[16px] text-[#5b4632]" style={{ left: cx - rx, top: footY + 18 }}>
            {B.label}
          </span>
        )}
      </div>
    </>
  );
}

/** 纸面：盖住厨房（灶台、锅、墙），下沿在 paper.edgeY 处羽化，露出桌面 */
function PaperSheet({ opacity }: { opacity: number }) {
  const { edgeY, feather, color } = BG.paper;
  return (
    <div
      data-bg="paper"
      className="absolute"
      style={{
        left: -400,
        top: -400,
        width: 1536 + 800,
        height: edgeY + 400,
        opacity,
        background: `linear-gradient(to bottom, ${color} 0, ${color} calc(100% - ${feather}px), ${transparent(color)} 100%)`,
      }}
    />
  );
}

/**
 * B1 桌沿带。正式图：table.src 铺满 table.showBox（场景像素）。占位：平涂色块。
 * 两条零高度标记线（data-bg-line="top" / "edge"）给无头检查量“蛋脚底是否在桌面上”。
 */
function TableBand({ opacity, debug }: { opacity: number; debug: boolean }) {
  const T = BG.table;
  const [x, y, w, h] = T.showBox;
  const P = T.placeholder;
  const fade = `linear-gradient(to bottom, transparent 0, #000 ${T.fadeTop}px)`;
  const band = (y0: number, y1: number, color: string): CSSProperties => ({ position: "absolute", left: 0, width: w, top: y0 - y, height: y1 - y0, background: color });
  return (
    // 上沿 fadeTop 场景像素做透明渐变（遮罩，正式图同样适用）：纸面变薄时（环境段 prejump）厨房和桌沿之间没有硬边
    <div data-bg="table" className="absolute" style={{ left: x, top: y, width: w, height: h, opacity, maskImage: fade, WebkitMaskImage: fade }}>
      {T.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={T.src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" style={{ objectFit: "fill" }} />
      ) : (
        <>
          <div style={band(y, T.topY, P.paper)} />
          <div style={band(T.topY, T.edgeY, P.top)} />
          <div style={band(T.edgeY, T.faceY, P.face)} />
          <div style={band(T.faceY, y + h, P.below)} />
        </>
      )}
      <div data-bg-line="top" className="absolute left-0 h-0" style={{ top: T.topY - y, width: w }} />
      <div data-bg-line="edge" className="absolute left-0 h-0" style={{ top: T.edgeY - y, width: w, borderTop: debug ? "2px dashed rgba(180,60,40,.6)" : undefined }} />
      {debug && !T.src && (
        <span className="absolute rounded bg-white/75 px-2 py-1 font-mono text-[18px] text-[#5b4632]" style={{ left: 232 + 700, top: T.edgeY - y + 12 }}>
          {T.label}
        </span>
      )}
    </div>
  );
}

/** 寻找段外围 + 收尾（页面层，漫画之下）。（原名 HallwayBackdrop，按内容改名：这里是门口厨房和收尾，不是走廊）。 */
export function SearchBackdrop() {
  const { timeline: t } = useScene();
  const debug = useDebugFlag();
  const s = backgroundState(gNow(t));
  return (
    <>
      {s.doorway > SHOW && <SearchSurround opacity={s.doorway} driftPct={s.drift} debug={debug} />}
      {s.ending > SHOW && <EndingSheet opacity={s.ending} />}
    </>
  );
}

/** B2 寻找段外围：浅色墙面 + 局部门框 + 纸白。横版 / 竖版按视口选；占位是平涂 */
function SearchSurround({ opacity, driftPct, debug }: { opacity: number; driftPct: number; debug: boolean }) {
  const H = BG.doorway;
  const vp = useViewport();
  // 视口宽高比低于 portraitBelow 用竖版（没有竖版时用横版裁切），否则横版
  const portrait = vp.w / vp.h < H.portraitBelow;
  const src = portrait ? (H.srcPortrait ?? H.src) : H.src;
  // 没有竖版图时竖屏用横版裁切：focusPortrait 指向门口那一侧（保持比例，不拉伸）
  const f = portrait && !H.srcPortrait ? H.focusPortrait : H.focus;
  const pad = H.driftPct;
  return (
    // 两段式：前一半铺满纸色（盖住阅读段的厨房），后一半在纸色上淡入图片，不叠两张厨房
    <div aria-hidden data-bg="search" className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" style={{ opacity: src ? 1 : opacity }}>
      <div className="absolute inset-0" style={{ background: H.color, opacity: src ? Math.min(1, opacity * 2) : 1 }} />
      {/* 比视口左右各宽 driftPct%，漂移时不露边 */}
      <div className="absolute inset-y-0" style={{ left: `-${pad}%`, right: `-${pad}%`, transform: `translateX(${driftPct.toFixed(3)}vw)`, opacity: src ? Math.max(0, opacity * 2 - 1) : 1 }}>
        {src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" style={{ objectPosition: `${f[0] * 100}% ${f[1] * 100}%` }} />
        )}
      </div>
      {debug && !src && (
        <span className="absolute bottom-6 left-6 rounded bg-white/70 px-2 py-1 font-mono text-[12px] text-[#5b4632]">
          {H.label}（{portrait ? "竖版" : "横版"}，{H.status}）
        </span>
      )}
    </div>
  );
}

/** 收尾：安静的厨房（new pics BG-quiet-ending），cover 铺满；src 为 null 时退回暖米白平涂 */
function EndingSheet({ opacity }: { opacity: number }) {
  const E = BG.ending;
  return (
    // 两段式：先铺满纸色，再淡入安静的厨房，不叠两张厨房
    <div aria-hidden data-bg="ending" className="pointer-events-none fixed inset-0 z-[5] overflow-hidden" style={{ opacity: E.src ? 1 : opacity }}>
      <div className="absolute inset-0" style={{ background: E.color, opacity: E.src ? Math.min(1, opacity * 2) : 1 }} />
      {E.src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={E.src} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" style={{ objectPosition: `${E.focus[0] * 100}% ${E.focus[1] * 100}%`, opacity: Math.max(0, opacity * 2 - 1) }} />
      )}
    </div>
  );
}

function transparent(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
}

function useDebugFlag() {
  return useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).has("debug"),
    () => false,
  );
}
