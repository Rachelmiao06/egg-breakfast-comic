"use client";
/** 厨房里所有会动的东西，按前后顺序叠放。由 KitchenScene 作为 children 使用。 */
import Bubbles from "./Bubbles";
import Egg, { type EggAnchors } from "./Egg";
import Flame from "./Flame";
import PanOil from "./PanOil";
import Steam from "./Steam";

export default function KitchenCharacters({ eggAnchors, direct = false }: { eggAnchors?: Partial<EggAnchors>; direct?: boolean }) {
  return (
    <>
      <Flame />
      <PanOil />
      <Bubbles />
      <Steam />
      <Egg anchors={eggAnchors} direct={direct} />
    </>
  );
}
