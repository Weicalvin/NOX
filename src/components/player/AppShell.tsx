import {
  FolderOpen,
  Keyboard,
  Languages,
  Library,
  ListMusic,
  Smartphone,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tip, TooltipProvider } from "@/components/ui/tooltip";
import { detectCachedModels, listReadyModels } from "@/lib/ai/local-engine";
import { liveTick, snapshotOpts, transcribeRange } from "@/lib/ai/pipeline";
import { decodeToMono16k } from "@/lib/audio";
import { t } from "@/lib/i18n";
import { mergeCues, parseSubtitles } from "@/lib/srt";
import { pcmStore, usePlayer } from "@/lib/store";
import { isMediaFile, isSubtitleFile, isTypingTarget } from "@/lib/utils";
import { Logo } from "./Logo";
import { MediaStage } from "./MediaStage";
import { PlayerContext, type AudioGraph } from "./player-context";
import { SidePanel } from "./SidePanel";

export function AppShell() {
  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<AudioGraph | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const subRef = useRef<HTMLInputElement>(null);
  const liveCursor = useRef(0);
  const liveLock = useRef(false);
  const timeRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [dragging, setDragging] = useState(false);
  timeRef.current = time;

  const playlist = usePlayer((s) => s.playlist);
  const currentId = usePlayer((s) => s.currentId);
  const uiLang = usePlayer((s) => s.uiLang);
  const live = usePlayer((s) => s.live);
  const volume = usePlayer((s) => s.volume);
  const addFiles = usePlayer((s) => s.addFiles);
  const setCues = usePlayer((s) => s.setCues);
  const setPanel = usePlayer((s) => s.togglePanel);
  const selectRelative = usePlayer((s) => s.selectRelative);
  const setVolume = usePlayer((s) => s.setVolume);
  const setMuted = usePlayer((s) => s.setMuted);
  const autoplayNext = usePlayer((s) => s.autoplayNext);
  const current = playlist.find((p) => p.id === currentId);

  const ctx = useMemo(
    () => ({ mediaRef, stageRef, graphRef }),
    [],
  );

  useEffect(() => {
    document.documentElement.lang = uiLang === "zh" ? "zh-Hant" : "en";
  }, [uiLang]);

  useEffect(() => {
    void detectCachedModels().then(() => {
      for (const id of listReadyModels()) usePlayer.getState().markModelReady(id);
    });
  }, []);

  useEffect(() => {
    if (!current) return;
    if (pcmStore.has(current.id)) {
      usePlayer.getState().markPcm(current.id, true);
      return;
    }
    let cancelled = false;
    usePlayer.getState().markPcm(current.id, false);
    void (async () => {
      try {
        const blob = await fetch(current.url).then((r) => r.blob());
        const clip = await decodeToMono16k(blob);
        if (cancelled) return;
        pcmStore.set(current.id, clip);
        usePlayer.getState().markPcm(current.id, true);
      } catch {
        if (!cancelled) usePlayer.getState().markPcm(current.id, false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current]);

  useEffect(() => {
    liveCursor.current = 0;
  }, [currentId, live]);

  useEffect(() => {
    if (!live || !playing || !currentId) return;
    const id = window.setInterval(() => {
      if (liveLock.current) return;
      const range = liveTick(timeRef.current, liveCursor.current);
      if (!range) return;
      const clip = pcmStore.get(currentId);
      if (!clip) return;
      liveLock.current = true;
      liveCursor.current = range.end;
      void transcribeRange({
        clip,
        start: range.start,
        end: range.end,
        offset: range.start,
        ...snapshotOpts(),
      })
        .then((part) => {
          const prev = usePlayer.getState().cues;
          usePlayer.getState().setCues(mergeCues(prev, part));
        })
        .catch(() => {
          liveCursor.current = Math.max(0, liveCursor.current - 4);
        })
        .finally(() => {
          liveLock.current = false;
        });
    }, 1200);
    return () => window.clearInterval(id);
  }, [live, playing, currentId]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.name,
      artist: "NOX",
      album: t(uiLang, "tagline"),
    });
    const el = () => mediaRef.current;
    navigator.mediaSession.setActionHandler("play", () => void el()?.play());
    navigator.mediaSession.setActionHandler("pause", () => el()?.pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => selectRelative(-1));
    navigator.mediaSession.setActionHandler("nexttrack", () => selectRelative(1));
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      const m = el();
      if (m) m.currentTime = Math.max(0, m.currentTime - 5);
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      const m = el();
      if (m) m.currentTime = Math.min(m.duration || 0, m.currentTime + 5);
    });
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [current, playing, selectRelative, uiLang]);

  const ingest = useCallback(
    async (files: File[]) => {
      const media = files.filter(isMediaFile);
      const subs = files.filter(isSubtitleFile);
      if (media.length) {
        addFiles(media);
        toast.success(`${t(uiLang, "added")} · ${media.length}`);
      }
      if (subs[0]) {
        const text = await subs[0].text();
        setCues(parseSubtitles(text));
        toast.success(t(uiLang, "dropSub"));
      }
      if (media.length === 0 && subs.length === 0) toast.error(t(uiLang, "nothing"));
    },
    [addFiles, setCues, uiLang],
  );

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = e.dataTransfer?.files;
      if (files) void ingest(Array.from(files));
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [ingest]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const el = mediaRef.current;
      const k = e.key.toLowerCase();
      if (e.code === "Space") {
        e.preventDefault();
        if (!el) return;
        if (el.paused) void el.play();
        else el.pause();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (el) el.currentTime = Math.min(el.duration || 0, el.currentTime + 5);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (el) el.currentTime = Math.max(0, el.currentTime - 5);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.min(1, volume + 0.05);
        setVolume(next);
        setMuted(false);
        if (el) {
          el.volume = next;
          el.muted = false;
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.max(0, volume - 0.05);
        setVolume(next);
        if (el) el.volume = next;
        if (next === 0) setMuted(true);
      } else if (k === "f") {
        e.preventDefault();
        const node = stageRef.current;
        if (!node) return;
        if (document.fullscreenElement) void document.exitFullscreen();
        else void node.requestFullscreen();
      } else if (k === "m") {
        e.preventDefault();
        const next = !usePlayer.getState().muted;
        setMuted(next);
        if (el) el.muted = next;
      } else if (k === "n") {
        selectRelative(1);
      } else if (k === "p") {
        selectRelative(-1);
      } else if (k === "?" || (e.shiftKey && k === "/")) {
        setPanel("help");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectRelative, setMuted, setPanel, setVolume, volume]);

  const onEnded = () => {
    if (autoplayNext) selectRelative(1);
  };

  return (
    <PlayerContext.Provider value={ctx}>
      <TooltipProvider>
        <div className="flex h-dvh flex-col bg-bg text-fg">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
            <Logo className="size-8 shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-lg leading-none tracking-wide">NOX</p>
              <p className="hidden truncate text-[11px] text-muted sm:block">
                {t(uiLang, "tagline")}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-0.5">
              <Tip label={t(uiLang, "openFiles")}>
                <Button
                  size="icon-sm"
                  onClick={() => fileRef.current?.click()}
                  aria-label={t(uiLang, "openFiles")}
                >
                  <FolderOpen />
                </Button>
              </Tip>
              <Tip label={t(uiLang, "playlist")}>
                <Button
                  size="icon-sm"
                  onClick={() => setPanel("playlist")}
                  aria-label={t(uiLang, "playlist")}
                >
                  <ListMusic />
                </Button>
              </Tip>
              <Tip label={t(uiLang, "models")}>
                <Button
                  size="icon-sm"
                  onClick={() => setPanel("models")}
                  aria-label={t(uiLang, "models")}
                >
                  <Library />
                </Button>
              </Tip>
              <Tip label={t(uiLang, "translate")}>
                <Button
                  size="icon-sm"
                  onClick={() => setPanel("translate")}
                  aria-label={t(uiLang, "translate")}
                >
                  <Languages />
                </Button>
              </Tip>
              <Tip label={t(uiLang, "install")}>
                <Button
                  size="icon-sm"
                  onClick={() => setPanel("install")}
                  aria-label={t(uiLang, "install")}
                >
                  <Smartphone />
                </Button>
              </Tip>
              <Tip label={t(uiLang, "shortcuts")}>
                <Button
                  size="icon-sm"
                  onClick={() => setPanel("help")}
                  aria-label={t(uiLang, "shortcuts")}
                >
                  <Keyboard />
                </Button>
              </Tip>
              <button
                type="button"
                className="ml-1 h-8 rounded-sm px-2 text-[11px] uppercase tracking-[0.14em] text-muted hover:text-fg"
                onClick={() =>
                  usePlayer.getState().setUiLang(uiLang === "zh" ? "en" : "zh")
                }
              >
                {uiLang === "zh" ? "EN" : "中文"}
              </button>
            </div>
          </header>

          <div className="relative flex min-h-0 min-w-0 flex-1 flex-row">
            <MediaStage
              playing={playing}
              setPlaying={setPlaying}
              time={time}
              setTime={setTime}
              duration={duration}
              setDuration={setDuration}
              buffered={buffered}
              setBuffered={setBuffered}
              onEnded={onEnded}
              onLoadSub={() => subRef.current?.click()}
            />
            <SidePanel />
          </div>

          {dragging ? (
            <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center bg-bg/70">
              <div className="rounded-xl border border-dashed border-accent/40 px-10 py-8 text-center">
                <p className="font-display text-2xl">{t(uiLang, "dropHere")}</p>
              </div>
            </div>
          ) : null}

          <input
            ref={fileRef}
            type="file"
            accept="video/*,audio/*,.srt,.vtt"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void ingest(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
          <input
            ref={subRef}
            type="file"
            accept=".srt,.vtt,text/vtt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void ingest([f]);
              e.target.value = "";
            }}
          />
        </div>
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: "#111111",
              color: "#f2f0eb",
              border: "1px solid #222222",
            },
          }}
        />
      </TooltipProvider>
    </PlayerContext.Provider>
  );
}
