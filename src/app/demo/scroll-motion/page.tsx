import type { Metadata } from "next";
import ChopScreen from "./ChopScreen";

export const metadata: Metadata = {
  title: "切菜 · 漫画构图稿 · 妈妈的荷包蛋拌饭",
};

/** 构图确认稿：只放"切菜"这一屏，静态，不滚动。调试读数：?debug=1 或按 D。 */
export default function ScrollMotionDemoPage() {
  return <ChopScreen />;
}
