"use client";
/**
 * 右下角的小声音开关。没有文字，只有图标；音效文件未提供时依旧可点（静音预览）。
 * 选择记在 localStorage（kitchen.soundOn）；恢复为"开"时要等第一次点击 / 按键才真的出声（浏览器自动播放限制）。
 * 旁边的「音效致谢」：CC BY 4.0 素材要求在网页上可见地署名（标题、作者、来源、许可、是否修改），点开显示，再点或按 Esc 收起。
 */
import { useEffect, useState } from "react";
import { useScene } from "@/lib/scene-context";
import { useKitchenAudio } from "./useKitchenAudio";

const KEY = "kitchen.soundOn";

/** 需要署名的素材（CC BY 4.0）；其余来自 Freesound（CC0）、Pixabay、Mixkit，不要求署名，见 public/assets/audio/LICENSES.md */
const CREDITS = [
  { title: "Stir fry 07", author: "LG", url: "https://freesound.org/people/LG/sounds/77923/", use: "配菜落锅" },
  { title: "Pouring oil (SoundAction 072)", author: "alexarje", url: "https://freesound.org/people/alexarje/sounds/721754/", use: "淋汁" },
];
const CC_BY = "https://creativecommons.org/licenses/by/4.0/";

export default function SoundToggle() {
  const { soundOn, setSoundOn } = useScene();
  const { available } = useKitchenAudio();
  useEffect(() => {
    try { if (localStorage.getItem(KEY) === "1") setSoundOn(true); } catch { /* 隐私模式等 */ }
  }, [setSoundOn]);
  const toggle = () => {
    const next = !soundOn;
    setSoundOn(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* 忽略 */ }
  };
  const label = soundOn ? "关闭声音" : "打开声音";
  const [credits, setCredits] = useState(false);
  useEffect(() => {
    if (!credits) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCredits(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [credits]);
  return (
    <>
    <button
      type="button"
      onClick={() => setCredits(!credits)}
      aria-expanded={credits}
      aria-controls="sound-credits"
      className="fixed bottom-[1.6rem] right-[4.1rem] z-50 rounded-full bg-cream/80 px-2.5 py-1 text-[11px] leading-none text-ink/70 shadow-[0_1px_3px_rgba(107,74,43,0.2)] ring-1 ring-ink/10 backdrop-blur-sm transition hover:bg-cream hover:text-ink"
    >
      音效致谢
    </button>
    {credits && (
      <div id="sound-credits" role="dialog" aria-label="音效致谢" className="fixed bottom-16 right-5 z-50 w-[min(20rem,calc(100vw-2.5rem))] rounded-xl bg-cream/95 p-3 text-[12px] leading-relaxed text-ink shadow-[0_2px_10px_rgba(107,74,43,0.25)] ring-1 ring-ink/15 backdrop-blur-sm">
        <p className="mb-1 font-medium">音效致谢</p>
        <ul className="space-y-1">
          {CREDITS.map((c) => (
            <li key={c.url}>
              {c.use}：<a href={c.url} target="_blank" rel="noopener noreferrer" className="underline decoration-ink/30 underline-offset-2">“{c.title}”</a>，作者 {c.author}（Freesound），
              <a href={CC_BY} target="_blank" rel="noopener noreferrer" className="underline decoration-ink/30 underline-offset-2">CC BY 4.0</a>，已裁剪并调整响度。
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-ink/60">其余音效来自 Freesound（CC0）、Pixabay、Mixkit 的免费素材。</p>
      </div>
    )}
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={soundOn}
      title={available === false ? `${label}（音效待添加）` : label}
      className="fixed bottom-5 right-5 z-50 grid h-10 w-10 place-items-center rounded-full bg-cream/80 text-ink shadow-[0_1px_4px_rgba(107,74,43,0.25)] ring-1 ring-ink/15 backdrop-blur-sm transition hover:bg-cream"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" fillOpacity="0.12" />
        {soundOn ? (
          <>
            <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
            <path d="M18 6.8a7.4 7.4 0 0 1 0 10.4" />
          </>
        ) : (
          <path d="M16 9.5l5 5m0-5l-5 5" />
        )}
      </svg>
    </button>
    </>
  );
}
