"use client";
/** 右下角的小声音开关。没有文字，只有图标；音效文件未提供时依旧可点（静音预览）。 */
import { useScene } from "@/lib/scene-context";
import { useKitchenAudio } from "./useKitchenAudio";

export default function SoundToggle() {
  const { soundOn, setSoundOn } = useScene();
  const { available } = useKitchenAudio();
  const label = soundOn ? "关闭声音" : "打开声音";
  return (
    <button
      type="button"
      onClick={() => setSoundOn(!soundOn)}
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
  );
}
