import { useRef } from "react";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Timeline({
  time,
  duration,
  buffered,
  onSeek,
}: {
  time: number;
  duration: number;
  buffered: number;
  onSeek: (t: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ratio = duration > 0 ? Math.min(1, time / duration) : 0;
  const buf = duration > 0 ? Math.min(1, buffered / duration) : 0;

  const seekFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(x * duration);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted">
        {formatTime(time)}
      </span>
      <div
        ref={ref}
        className="group relative h-11 flex-1 cursor-pointer"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          seekFromEvent(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromEvent(e);
        }}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration || 0}
        aria-valuenow={time}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onSeek(Math.min(duration, time + 5));
          if (e.key === "ArrowLeft") onSeek(Math.max(0, time - 5));
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/12">
          <div
            className="absolute inset-y-0 left-0 bg-white/20"
            style={{ width: `${buf * 100}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 bg-fg"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <div
          className={cn(
            "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg opacity-0 transition-opacity duration-150 group-hover:opacity-100",
          )}
          style={{ left: `${ratio * 100}%` }}
        />
      </div>
      <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted">
        {formatTime(duration)}
      </span>
    </div>
  );
}
