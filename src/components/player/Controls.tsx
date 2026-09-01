import {
  Captions,
  FastForward,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tip } from "@/components/ui/tooltip";
import { t, type CopyKey } from "@/lib/i18n";
import { usePlayer } from "@/lib/store";
import { Timeline } from "./Timeline";
import { usePlayerContext } from "./player-context";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function Controls({
  playing,
  time,
  duration,
  buffered,
  isFullscreen,
  onTogglePlay,
  onSeek,
  onPrev,
  onNext,
  onFullscreen,
  onPip,
  onLoadSub,
  visible,
}: {
  playing: boolean;
  time: number;
  duration: number;
  buffered: number;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onFullscreen: () => void;
  onPip: () => void;
  onLoadSub: () => void;
  visible: boolean;
}) {
  const { mediaRef } = usePlayerContext();
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const rate = usePlayer((s) => s.rate);
  const uiLang = usePlayer((s) => s.uiLang);
  const setVolume = usePlayer((s) => s.setVolume);
  const setMuted = usePlayer((s) => s.setMuted);
  const setRate = usePlayer((s) => s.setRate);
  const togglePanel = usePlayer((s) => s.togglePanel);
  const tt = (k: CopyKey) => t(uiLang, k);

  return (
    <div
      className={`player-gradient absolute inset-x-0 bottom-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-16 transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-5 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      <Timeline time={time} duration={duration} buffered={buffered} onSeek={onSeek} />
      <div className="mt-1 flex items-center gap-0.5">
        <Tip label={tt("prev")}>
          <Button size="icon-sm" onClick={onPrev} aria-label={tt("prev")}>
            <SkipBack />
          </Button>
        </Tip>
        <Tip label={playing ? tt("pause") : tt("play")}>
          <Button
            size="icon"
            variant="subtle"
            className="rounded-full"
            onClick={onTogglePlay}
            aria-label={playing ? tt("pause") : tt("play")}
          >
            {playing ? <Pause /> : <Play className="ml-0.5" />}
          </Button>
        </Tip>
        <Tip label={tt("next")}>
          <Button size="icon-sm" onClick={onNext} aria-label={tt("next")}>
            <SkipForward />
          </Button>
        </Tip>
        <Tip label="-5s">
          <Button size="icon-sm" onClick={() => onSeek(Math.max(0, time - 5))} aria-label="-5s">
            <Rewind />
          </Button>
        </Tip>
        <Tip label="+5s">
          <Button
            size="icon-sm"
            onClick={() => onSeek(Math.min(duration, time + 5))}
            aria-label="+5s"
          >
            <FastForward />
          </Button>
        </Tip>

        <div className="ml-1 hidden items-center gap-1 sm:flex">
          <Tip label={muted ? tt("unmute") : tt("mute")}>
            <Button
              size="icon-sm"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                const el = mediaRef.current;
                if (el) el.muted = next;
              }}
              aria-label={muted ? tt("unmute") : tt("mute")}
            >
              {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
            </Button>
          </Tip>
          <div className="w-24">
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[muted ? 0 : volume]}
              onValueChange={([v]) => {
                const vol = v ?? 0;
                setVolume(vol);
                setMuted(vol === 0);
                const el = mediaRef.current;
                if (el) {
                  el.volume = vol;
                  el.muted = vol === 0;
                }
              }}
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <div className="hidden items-center gap-1 md:flex">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setRate(s);
                  const el = mediaRef.current;
                  if (el) el.playbackRate = s;
                }}
                className={`h-8 min-w-9 rounded-sm px-1.5 font-mono text-[11px] tabular-nums transition-[background-color,color] duration-150 ${
                  rate === s ? "bg-fg text-accent-fg" : "text-muted hover:bg-white/8 hover:text-fg"
                }`}
              >
                {s === 1 ? "1×" : `${s}×`}
              </button>
            ))}
          </div>
          <Tip label={tt("loadSub")}>
            <Button size="icon-sm" onClick={onLoadSub} aria-label={tt("loadSub")}>
              <Captions />
            </Button>
          </Tip>
          <Tip label={tt("translate")}>
            <Button
              size="sm"
              onClick={() => togglePanel("translate")}
              aria-label={tt("translate")}
              className="px-2 font-display text-base italic"
            >
              Aa
            </Button>
          </Tip>
          <Tip label={tt("pip")}>
            <Button size="icon-sm" onClick={onPip} aria-label={tt("pip")}>
              <PictureInPicture2 />
            </Button>
          </Tip>
          <Tip label={tt("fullscreen")}>
            <Button size="icon-sm" onClick={onFullscreen} aria-label={tt("fullscreen")}>
              {isFullscreen ? <Minimize /> : <Maximize />}
            </Button>
          </Tip>
        </div>
      </div>
    </div>
  );
}
