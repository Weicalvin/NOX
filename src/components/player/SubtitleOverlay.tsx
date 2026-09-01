import { activeCue } from "@/lib/srt";
import { usePlayer } from "@/lib/store";

export function SubtitleOverlay({ time }: { time: number }) {
  const cues = usePlayer((s) => s.cues);
  const size = usePlayer((s) => s.subtitleSize);
  const showOriginal = usePlayer((s) => s.showOriginal);
  const bilingual = usePlayer((s) => s.bilingual);
  const cue = activeCue(cues, time);
  if (!cue) return null;
  const primary = cue.translation || cue.text;
  const secondary = cue.translation && showOriginal ? cue.text : null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[18%] z-20 flex justify-center px-4 sm:bottom-[22%]">
      <div className="max-w-[min(920px,92%)] text-center">
        <p
          className="font-medium leading-snug text-fg"
          style={{
            fontSize: `clamp(14px, ${size * 0.12}vw, ${size}px)`,
            textShadow: "0 1px 2px rgb(0 0 0 / 0.9), 0 0 18px rgb(0 0 0 / 0.55)",
          }}
        >
          {primary}
        </p>
        {bilingual && secondary ? (
          <p
            className="mt-1 font-normal text-fg/80"
            style={{
              fontSize: `clamp(12px, ${size * 0.08}vw, ${Math.round(size * 0.72)}px)`,
              textShadow: "0 1px 2px rgb(0 0 0 / 0.9)",
            }}
          >
            {secondary}
          </p>
        ) : null}
      </div>
    </div>
  );
}
