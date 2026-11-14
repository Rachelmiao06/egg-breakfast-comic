"use client";
/** 视口尺寸订阅（SSR 时按桌面 1440×900）。竖屏手机用纵向堆叠版式。 */
import { useSyncExternalStore } from "react";

let snap = "1440x900";
const read = () => (typeof window === "undefined" ? snap : (snap = `${window.innerWidth}x${window.innerHeight}`));
export function useViewport() {
  const s = useSyncExternalStore(
    (cb) => {
      window.addEventListener("resize", cb);
      return () => window.removeEventListener("resize", cb);
    },
    read,
    () => "1440x900",
  );
  const [w, h] = s.split("x").map(Number);
  return { w, h, portrait: w / h < 0.85 };
}
