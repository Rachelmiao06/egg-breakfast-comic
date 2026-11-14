"use client";
/**
 * 节拍调节页（集成会话维护）：完整滚动体验 + 节拍表面板。
 * 厨房、蛋、声音是正式组件；前景暂用替身（StandIns），comic-scroll 交付后替换。
 */
import ScrollDriver from "@/components/ScrollDriver";
import KitchenCharacters from "@/components/kitchen/KitchenCharacters";
import KitchenScene from "@/components/kitchen/KitchenScene";
import ScrollHint from "@/components/kitchen/ScrollHint";
import SoundToggle from "@/components/kitchen/SoundToggle";
import { SceneProvider } from "@/lib/scene-context";
import { EndingStandIn, MomStandIn, PanelStandIns } from "./StandIns";
import TuningPanel from "./TuningPanel";

export default function BeatsPage() {
  return (
    <SceneProvider>
      <div className="fixed inset-0 z-0">
        <KitchenScene foreground={<MomStandIn />}>
          <KitchenCharacters />
        </KitchenScene>
      </div>
      <PanelStandIns />
      <EndingStandIn />
      <ScrollDriver />
      <SoundToggle />
      <ScrollHint />
      <TuningPanel />
    </SceneProvider>
  );
}
