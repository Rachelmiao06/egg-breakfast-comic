"use client";

/**
 * 画格纸边的纸纹：用 Paper Design 的 PaperTexture shader（@paper-design/shaders-react，纸纤维 + 细颗粒）
 * 在一块不可见（opacity 0）的 1024² 画布上只渲染一次（shader 在视口外会暂停，所以不能放到屏幕外），截成图片后写进 <html> 的 CSS 变量 --paper-tex，随即销毁 WebGL 上下文。
 * 为什么不是每格一个 canvas：画格一次有十几块，浏览器 WebGL 上下文有数量上限，一块共用的纹理 + CSS 叠加最稳，
 * 之后每帧零 GPU 成本。纹理用 multiply 叠在画格上（globals.css .panel-frame::before），让纸边和画面都带一点纸张颗粒。
 * 拿不到 WebGL 时 --paper-tex 保持 none，纸边仍是平整的奶油色。
 */
import { useEffect, useRef, useState } from "react";
import { PaperTexture } from "@paper-design/shaders-react";

const SIZE = 1024;

export default function PaperFrameTexture() {
  const host = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // 已经烘过（StrictMode 重复挂载 / 热更新）就不再渲染
    if (document.getElementById("paper-frame-texture")) return;
    let tries = 0;
    let timer = 0;
    const grab = () => {
      const canvas = host.current?.querySelector("canvas");
      if (canvas && canvas.width > 0) {
        // 不透明纸纹 → jpeg data URL（几百 KB）。写进 <head> 的 <style>，不写 <html> 的 inline style：
        // 厨房层会整段重写 <html> 的 style，写在那里的变量会被冲掉。
        try {
          const url = canvas.toDataURL("image/jpeg", 0.9);
          if (url.length > 20000) {
            const el = document.createElement("style");
            el.id = "paper-frame-texture";
            el.textContent = `:root{--paper-tex:url(${url})}`;
            document.head.appendChild(el);
            setDone(true);
            return;
          }
        } catch {
          /* 读不出来就保持平整纸边 */
        }
        return;
      }
      if (++tries < 300) timer = window.setTimeout(grab, 20);
      else setDone(true);
    };
    timer = window.setTimeout(grab, 30);
    return () => window.clearTimeout(timer);
  }, []);

  if (done) return null;
  return (
    <div ref={host} aria-hidden style={{ position: "fixed", left: -SIZE - 100, top: 0, width: SIZE, height: SIZE, pointerEvents: "none" }}>
      <PaperTexture
        width={SIZE}
        height={SIZE}
        webGlContextAttributes={{ preserveDrawingBuffer: true }}
        minPixelRatio={1}
        maxPixelCount={SIZE * SIZE}
        fit="cover"
        scale={1.4}
        speed={0}
        frame={0}
        colorBack="#fffaf0"
        colorPaper="#fffaf0"
        colorShadow="#b79a72"
        blending={1}
        distortion={0}
        angle={40}
        seed={455}
        roughness={0.6}
        roughnessSize={0.35}
        roughnessRows={0.25}
        fiber={0.55}
        fiberSize={0.45}
        folds={0}
        wrinkles={0.2}
        wrinkleSize={0.8}
        crumples={0}
        drops={0}
      />
    </div>
  );
}
