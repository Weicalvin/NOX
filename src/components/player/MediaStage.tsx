import { Film, Music2 } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { usePlayer } from "@/lib/store";
import { Controls } from "./Controls";
import { usePlayerContext } from "./player-context";
import { SubtitleOverlay } from "./SubtitleOverlay";
import { Visualizer } from "./Visualizer";

export function MediaStage({
  playing,
  setPlaying,
  time,
  setTime,
  duration,
  setDuration,
  buffered,
  setBuffered,
  onEnded,
  onLoadSub,
}: {
  playing: boolean;
  setPlaying: (v: boolean) => void;
  time: number;
  setTime: (v: number) => void;
  duration: number;
  setDuration: (v: number) => void;
  buffered: number;
  setBuffered: (v: number) => void;
  onEnded: () => void;
  onLoadSub: () => void;
}) {
  const { mediaRef, stageRef, graphRef } = usePlayerContext();
  const current = usePlayer((s) => s.playlist.find((p) => p.id === s.currentId));
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const rate = usePlayer((s) => s.rate);
  const uiLang = usePlayer((s) => s.uiLang);
  const selectRelative = usePlayer((s) => s.selectRelative);
  const [idle, setIdle] = useState(false);
  const [fs, setFs] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el || !current) return;
    el.volume = volume;
    el.muted = muted;
    el.playbackRate = rate;
  }, [current, mediaRef, muted, rate, volume]);

  useEffect(() => {
    if (!playing) {
      setIdle(false);
      return;
    }
    if (hover) {
      setIdle(false);
      return;
    }
    const id = window.setTimeout(() => setIdle(true), 2500);
    return () => window.clearTimeout(id);
  }, [playing, hover]);

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (current) return;
    const g = graphRef.current;
    if (!g) return;
    graphRef.current = null;
    void g.ctx.close();
  }, [current, graphRef]);

  const ensureGraph = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (graphRef.current) {
      if (graphRef.current.ctx.state === "suspended") {
        void graphRef.current.ctx.resume();
      }
      return;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(el);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    graphRef.current = { ctx, source, analyser };
  };

  const togglePlay = async () => {
    const el = mediaRef.current;
    if (!el || !current) return;
    ensureGraph();
    if (el.paused) {
      try {
        await el.play();
      } catch {
        /* autoplay blocked */
      }
    } else {
      el.pause();
    }
  };

  const seek = (t0: number) => {
    const el = mediaRef.current;
    if (!el) return;
    el.currentTime = t0;
    setTime(t0);
  };

  const fullscreen = async () => {
    const node = stageRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen();
    } catch {
      /* ignore */
    }
  };

  const pip = async () => {
    const el = mediaRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await el.requestPictureInPicture();
    } catch {
      /* unsupported */
    }
  };

  const showChrome = !playing || !idle || !current;
  const isAudio = current?.kind === "audio";

  return (
    <div
      ref={stageRef}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg"
      onMouseMove={() => {
        setHover(true);
        setIdle(false);
      }}
      onMouseLeave={() => setHover(false)}
      onPointerDown={() => {
        setIdle(false);
      }}
    >
      <div className="relative min-h-0 flex-1">
        {current ? (
          <>
            <video
              ref={mediaRef}
              src={current.url}
              className={
                isAudio
                  ? "pointer-events-none absolute h-0 w-0 opacity-0"
                  : "absolute inset-0 size-full bg-bg object-contain"
              }
              playsInline
              onPlay={() => {
                setPlaying(true);
                ensureGraph();
              }}
              onPause={() => setPlaying(false)}
              onTimeUpdate={() => {
                const el = mediaRef.current;
                if (!el) return;
                setTime(el.currentTime);
                if (el.buffered.length > 0) {
                  setBuffered(el.buffered.end(el.buffered.length - 1));
                }
              }}
              onDurationChange={() => {
                const el = mediaRef.current;
                if (el) setDuration(el.duration || 0);
              }}
              onLoadedMetadata={() => {
                const el = mediaRef.current;
                if (el) setDuration(el.duration || 0);
              }}
              onEnded={onEnded}
              onClick={togglePlay}
            />
            {isAudio ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Visualizer active={playing} />
                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className="flex size-16 items-center justify-center rounded-xl bg-surface shadow-[0_0_0_1px_rgb(255_255_255/0.08)]">
                    <Music2 className="size-7 text-accent" />
                  </div>
                  <p className="max-w-[80vw] truncate px-6 font-display text-2xl text-fg">
                    {current.name.replace(/\.[^.]+$/, "")}
                  </p>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">
                    {t(uiLang, "audioMode")}
                  </p>
                </div>
              </div>
            ) : null}
            <SubtitleOverlay time={time} />
          </>
        ) : (
          <EmptyState />
        )}
      </div>

      {current ? (
        <>
          <div
            className={`top-gradient pointer-events-none absolute inset-x-0 top-0 z-20 h-24 transition-opacity duration-200 ${
              showChrome ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`absolute left-4 top-4 z-30 max-w-[70%] truncate text-sm text-fg/90 transition-opacity duration-200 ${
              showChrome ? "opacity-100" : "opacity-0"
            }`}
          >
            {current.name}
          </div>
          <Controls
            playing={playing}
            time={time}
            duration={duration}
            buffered={buffered}
            isFullscreen={fs}
            onTogglePlay={togglePlay}
            onSeek={seek}
            onPrev={() => selectRelative(-1)}
            onNext={() => selectRelative(1)}
            onFullscreen={fullscreen}
            onPip={pip}
            onLoadSub={onLoadSub}
            visible={showChrome}
          />
        </>
      ) : null}
    </div>
  );
}

function EmptyState() {
  const uiLang = usePlayer((s) => s.uiLang);
  const addFiles = usePlayer((s) => s.addFiles);
  const togglePanel = usePlayer((s) => s.togglePanel);
  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center">
      <div className="mb-6 flex size-14 items-center justify-center rounded-lg bg-surface shadow-[0_0_0_1px_rgb(255_255_255/0.08)]">
        <Film className="size-6 text-accent" />
      </div>
      <h1 className="font-display text-4xl tracking-tight text-fg sm:text-5xl">
        {t(uiLang, "emptyTitle")}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        {t(uiLang, "emptyBody")}
      </p>
      <p className="mt-8 text-sm text-fg">{t(uiLang, "drop")}</p>
      <p className="mt-1 max-w-sm text-xs text-subtle">{t(uiLang, "dropHint")}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <label className="inline-flex h-11 cursor-pointer items-center rounded-md bg-fg px-4 text-sm font-medium text-accent-fg transition-[transform,background-color] duration-150 active:scale-[0.96]">
          {t(uiLang, "openFiles")}
          <input
            type="file"
            accept="video/*,audio/*,.mp4,.webm,.mkv,.mov,.mp3,.wav,.flac,.ogg,.m4a"
            multiple
            className="hidden"
            onChange={(e) => {
              const list = e.target.files;
              if (list) addFiles(Array.from(list));
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="inline-flex h-11 items-center rounded-md px-4 text-sm text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.12)] transition-[background-color,transform] duration-150 hover:bg-white/5 active:scale-[0.96]"
          onClick={() => togglePanel("models")}
        >
          {t(uiLang, "models")}
        </button>
        <button
          type="button"
          className="inline-flex h-11 items-center rounded-md px-4 text-sm text-fg shadow-[0_0_0_1px_rgb(255_255_255/0.12)] transition-[background-color,transform] duration-150 hover:bg-white/5 active:scale-[0.96]"
          onClick={() => togglePanel("install")}
        >
          {t(uiLang, "install")}
        </button>
      </div>
    </div>
  );
}
