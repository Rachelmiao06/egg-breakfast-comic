import ComicScroll from "@/components/comic/ComicScroll";
import KitchenScene from "@/components/kitchen/KitchenScene";
import { SceneProvider } from "@/lib/scene-context";

/** 首页接线（集成会话维护）：厨房固定在底层持续运动，漫画在前层随滚动推进。 */
export default function Home() {
  return (
    <SceneProvider>
      <div className="fixed inset-0 z-0">
        <KitchenScene />
      </div>
      <main className="relative z-10">
        <div className="h-screen" aria-hidden />
        <ComicScroll />
      </main>
    </SceneProvider>
  );
}
