"use client";
/**
 * 六格漫画的滚动阅读区（feat/comic-scroll 实现）。
 * 约定：它渲染在厨房之上（z-10），自己决定总高度；进入阅读时通过
 * useScene().setProgress / setActivePanel 告诉厨房背景现在读到哪了。
 */
export default function ComicScroll() {
  return <section aria-label="comic" className="min-h-screen" />;
}
