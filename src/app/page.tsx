"use client";
import ScrollProgress from "@/components/ScrollProgress";
import ScrollDriver from "@/components/ScrollDriver";
import ComicScroll from "@/components/comic/ComicScroll";
import KitchenCharacters from "@/components/kitchen/KitchenCharacters";
import KitchenScene from "@/components/kitchen/KitchenScene";
import ScrollHint from "@/components/kitchen/ScrollHint";
import SoundToggle from "@/components/kitchen/SoundToggle";
import { SceneProvider } from "@/lib/scene-context";

/**
 * 首页接线（集成会话维护）：厨房固定在底层持续运动，前景漫画在上层；
 * 整页节奏只由 <ScrollDriver> + 统一节拍表（src/lib/beats.json）决定。
 */
export default function Home() {
  return (
    <SceneProvider>
      <div className="fixed inset-0 z-0">
        <KitchenScene>
          <KitchenCharacters />
        </KitchenScene>
      </div>
      <ComicScroll />
      <ScrollDriver />
      <SoundToggle />
      <ScrollProgress />
      <ScrollHint />
    </SceneProvider>
  );
}
