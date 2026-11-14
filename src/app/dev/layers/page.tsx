import { SceneProvider } from "@/lib/scene-context";
import LayersPreview from "./LayersPreview";

/** 开发预览页（feat/kitchen-layers 分支维护）：分层叠合、视差、故事推进与弱化。 */
export default function DevLayersPage() {
  return (
    <SceneProvider>
      <LayersPreview />
    </SceneProvider>
  );
}
