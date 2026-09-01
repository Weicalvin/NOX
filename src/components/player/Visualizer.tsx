import { useEffect, useRef } from "react";
import { usePlayerContext } from "./player-context";

export function Visualizer({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { graphRef } = usePlayerContext();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    let raf = 0;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = () => {
      const { width, height } = canvas;
      ctx2d.clearRect(0, 0, width, height);
      const analyser = graphRef.current?.analyser;
      const bins = 72;
      const data = new Uint8Array(bins);
      if (analyser) {
        const tmp = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(tmp);
        for (let i = 0; i < bins; i++) {
          const idx = Math.floor((i / bins) * tmp.length * 0.7);
          data[i] = tmp[idx] ?? 0;
        }
      }
      const gap = 3;
      const barW = (width - gap * (bins - 1)) / bins;
      for (let i = 0; i < bins; i++) {
        const mag = reduced ? 0.18 : (data[i] ?? 0) / 255;
        const h = Math.max(4, mag * height * 0.86);
        const x = i * (barW + gap);
        const y = height - h;
        const alpha = 0.28 + mag * 0.55;
        ctx2d.fillStyle = `rgba(200, 204, 212, ${alpha})`;
        ctx2d.fillRect(x, y, barW, h);
      }
      raf = requestAnimationFrame(draw);
    };
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(parent.clientWidth * dpr);
      canvas.height = Math.floor(parent.clientHeight * dpr);
    };
    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [active, graphRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 size-full"
      aria-hidden="true"
    />
  );
}
