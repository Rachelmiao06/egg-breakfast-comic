"use client";
/**
 * 音效致谢（CC BY 4.0 要求网页上看得到的署名）。在最后一段（结尾特写）的末尾、三个点之后淡入，固定在画面底部，
 * 小字、不抢画面；屏幕阅读器始终可读。条目对应 public/assets/audio/LICENSES.md 文末"署名"一节（由声音会话维护）：
 * 新增 / 撤下 CC BY 素材时，同时改这里。
 */
import { useScene } from "@/lib/scene-context";

const CREDITS: { title: string; author: string; url: string; file: string }[] = [
  { title: "Stir fry 07.wav", author: "LG", url: "https://freesound.org/people/LG/sounds/77923/", file: "入锅声" },
  { title: "Pouring oil (SoundAction 072)", author: "alexarje (Alexander Refsum Jensenius)", url: "https://freesound.org/people/alexarje/sounds/721754/", file: "淋汁声" },
];
const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

export default function SoundCredits() {
  const { timeline: t, beats } = useScene();
  const last = t.index === beats.length - 1;
  const k = last ? Math.min(1, Math.max(0, (t.p - 0.82) / 0.1)) : 0;
  return (
    <footer
      aria-label="音效致谢"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] px-16 pb-3 text-center text-[11px] leading-relaxed"
      style={{ color: "rgba(74,52,32,0.72)", opacity: k, pointerEvents: k > 0.5 ? "auto" : "none" }}
    >
      <span>音效致谢：</span>
      {CREDITS.map((c, i) => (
        <span key={c.url}>
          {i > 0 && "；"}
          {c.file} “<a href={c.url} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">{c.title}</a>” by {c.author}
        </span>
      ))}
      <span>，<a href={LICENSE_URL} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">CC BY 4.0</a>，已裁切和调整响度。</span>
    </footer>
  );
}
