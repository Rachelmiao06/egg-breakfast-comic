"use client";
/**
 * 漫画页版式预览 /dev/comic（comic-scroll 分支自己维护）：静态，不接 timeline，没有滚动动效。
 * 第一页"切配菜"四格（占位）放在视口偏左的纸面上；厨房（含蛋、火苗、油泡、蒸汽）在底层活动，
 * 用 <KitchenScene camera> 把锅和跳蛋取到纸页右侧露出来。
 * 滚动流程预览在 /dev/comic/flow。
 */
import ComicPage from "@/components/comic/ComicPage";
import { CHOP_PAGE } from "@/components/comic/pages";
import KitchenCharacters from "@/components/kitchen/KitchenCharacters";
import KitchenScene from "@/components/kitchen/KitchenScene";
import { ANCHORS } from "@/lib/scene";
import { SceneProvider } from "@/lib/scene-context";

/** 取景：推近 1.35 倍，把锅底中心放到视口右侧偏下，纸页盖不住锅和蛋 */
const CAMERA = { x: ANCHORS.panInner.cx, y: ANCHORS.panInner.cy + 40, weight: 1, at: { x: 0.86, y: 0.7 }, zoom: 1.35 };

export default function ComicPagePreview() {
  return (
    <SceneProvider>
      <div className="fixed inset-0 z-0">
        <KitchenScene camera={CAMERA}>
          <KitchenCharacters />
        </KitchenScene>
      </div>
      <div className="pointer-events-none fixed inset-0 z-10">
        <div className="absolute left-[4vw] top-1/2 -translate-y-1/2">
          <ComicPage page={CHOP_PAGE} style={{ width: "min(1180px, 86vw, 118vh)" }} />
        </div>
      </div>
      <div className="fixed bottom-2 left-3 z-20 rounded bg-ink/80 px-2 py-1 font-mono text-[11px] text-cream">
        /dev/comic · 切配菜页 · 静态占位版式 · 滚动流程见 /dev/comic/flow
      </div>
    </SceneProvider>
  );
}
