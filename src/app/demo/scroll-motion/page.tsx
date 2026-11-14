import type { Metadata } from "next";
import ScrollMotionDemo from "./ScrollMotionDemo";

export const metadata: Metadata = {
  title: "停留式叙事小样 · 妈妈的荷包蛋拌饭",
};

export default function ScrollMotionDemoPage() {
  return <ScrollMotionDemo />;
}
