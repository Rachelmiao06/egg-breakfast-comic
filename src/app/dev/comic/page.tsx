import KitchenScene from "@/components/kitchen/KitchenScene";
import { SceneProvider } from "@/lib/scene-context";

/** 开发预览页（feat/comic-scroll 分支自己维护，可随意改）。 */
export default function DevPage() {
  return (
    <SceneProvider>
      <div className="fixed inset-0">
        <KitchenScene />
      </div>
    </SceneProvider>
  );
}
