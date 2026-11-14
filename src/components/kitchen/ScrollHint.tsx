"use client";
/** 底部中间一个很小、轻轻上下动的向下箭头；用户开始滚动后淡出。没有文字。 */
import { useEffect, useState } from "react";

export default function ScrollHint() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onScroll = () => setHidden(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2 text-ink/50 transition-opacity duration-500"
      style={{ opacity: hidden ? 0 : 1 }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="animate-[hint-bob_2.2s_ease-in-out_infinite]">
        <path d="M6 9l6 6 6-6" />
      </svg>
      <style>{`@keyframes hint-bob{0%,100%{transform:translateY(0);opacity:.7}50%{transform:translateY(5px);opacity:1}}@media (prefers-reduced-motion: reduce){svg{animation:none!important}}`}</style>
    </div>
  );
}
