"use client";
/**
 * 停留式厨房叙事小样（feat/scroll-motion-demo）。
 * 节奏只有一个来源：<ScrollDriver> → useScene().timeline；这里只用 pinState / phaseProgress / envelope 推导。
 * 结构：固定的活厨房做底（从不退场）+ 页面层的流动内容和三块停留版面。
 */
import { useEffect } from "react";
import ScrollDriver from "@/components/ScrollDriver";
import KitchenCharacters from "@/components/kitchen/KitchenCharacters";
import KitchenScene from "@/components/kitchen/KitchenScene";
import { pinState } from "@/lib/beats";
import { SceneProvider, useScene } from "@/lib/scene-context";
import Hud from "./Hud";
import MomLayer from "./MomLayer";
import { DEMO_BEATS, demoCamera } from "./motion";
import PrepBoard from "./PrepBoard";
import { CatchFrame, EndCard, EndingCard, NoticeCaption, OpeningTitle } from "./Sheets";
import VelocityTilt from "./VelocityTilt";

function Stage() {
  const { timeline: t, beats } = useScene();
  const pin = pinState(t, beats);
  const camera = demoCamera(t, beats);
  const props = { t, beats, pin };
  return (
    <>
      <div className="fixed inset-0 z-0">
        <KitchenScene camera={camera} foreground={<MomLayer t={t} beats={beats} />}>
          <KitchenCharacters />
        </KitchenScene>
      </div>
      <OpeningTitle {...props} />
      <PrepBoard {...props} />
      <NoticeCaption {...props} />
      <CatchFrame {...props} />
      <EndingCard {...props} />
      <EndCard {...props} />
      <Hud t={t} pin={pin} zoom={camera.zoom} />
    </>
  );
}

/**
 * 兜底：ScrollDriver 首次计算时若视口高度还是 0，时间轴会卡在 p = NaN 的最后一段，直到段号变化。
 * 挂载后下一帧派发一次 resize，让唯一的 ScrollDriver 按真实尺寸重算（不是新的监听）。正式修法见任务文件。
 */
function KickDriverOnce() {
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

export default function ScrollMotionDemo() {
  return (
    <SceneProvider initialBeats={DEMO_BEATS}>
      <Stage />
      <VelocityTilt />
      <ScrollDriver />
      <KickDriverOnce />
    </SceneProvider>
  );
}
