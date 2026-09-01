import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Check,
  ChevronDown,
  FileAudio,
  FileVideo,
  FolderOpen,
  Gauge,
  Headphones,
  Languages,
  ListMusic,
  Maximize2,
  Menu,
  Mic2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Subtitles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect as useDocumentEffect } from "react";

type Cue = { start: number; end: number; text: string };
type MediaItem = { id: string; file: File; url: string; kind: "audio" | "video" };

type Panel = "queue" | "captions" | "settings" | null;

function parseTime(raw: string) {
  const value = raw.trim().replace(",", ".");
  const parts = value.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function parseSubtitles(input: string): Cue[] {
  const normalized = input.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const body = normalized.startsWith("WEBVTT")
    ? normalized.replace(/^WEBVTT[^\n]*\n+/, "")
    : normalized;
  return body
    .split(/\n{2,}/)
    .map((block) => block.split("\n").filter(Boolean))
    .map((lines) => {
      const line = lines.find((item) => item.includes("-->"));
      if (!line) return null;
      const [start, end] = line.split("-->");
      const content = lines
        .slice(lines.indexOf(line) + 1)
        .join("\n")
        .replace(/<[^>]+>/g, "")
        .trim();
      if (!content) return null;
      return { start: parseTime(start), end: parseTime(end.split(/\s+/)[0]), text: content };
    })
    .filter((cue): cue is Cue => cue !== null && cue.end > cue.start);
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00";
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Home() {
  const mediaInput = useRef<HTMLInputElement>(null);
  const subtitleInput = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLVideoElement>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [cues, setCues] = useState<Cue[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.82);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [captionSize, setCaptionSize] = useState(1);
  const [captionOffset, setCaptionOffset] = useState(0);
  const [notice, setNotice] = useState("");
  const itemsRef = useRef<MediaItem[]>([]);
  itemsRef.current = items;

  const current = items.find((item) => item.id === currentId) ?? null;
  const activeCue = useMemo(
    () => cues.find((cue) => currentTime >= cue.start && currentTime <= cue.end + 0.12) ?? null,
    [cues, currentTime],
  );

  const addMedia = useCallback((files: File[]) => {
    const accepted = files.filter((file) => file.type.startsWith("audio/") || file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|mp3|wav|flac|ogg|m4a)$/i.test(file.name));
    if (!accepted.length) {
      setNotice("請選擇支援的影片或音訊檔案");
      return;
    }
    const additions = accepted.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      url: URL.createObjectURL(file),
      kind: file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/i.test(file.name) ? "video" as const : "audio" as const,
    }));
    setItems((previous) => {
      const merged = [...previous, ...additions.filter((item) => !previous.some((old) => old.id === item.id))];
      if (!currentId && merged[0]) setCurrentId(merged[0].id);
      return merged;
    });
    setNotice(`${accepted.length} 個檔案已加入播放清單`);
    setPanel("queue");
  }, [currentId]);

  const loadSubtitles = useCallback(async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseSubtitles(await file.text());
      setCues(parsed);
      setNotice(parsed.length ? `${parsed.length} 段字幕已載入` : "找不到有效的字幕段落");
      setPanel("captions");
    } catch {
      setNotice("字幕檔案無法讀取");
    }
  }, []);

  useEffect(() => {
    return () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
  }, []);

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.playbackRate = speed;
      mediaRef.current.volume = volume;
      mediaRef.current.muted = muted;
    }
  }, [speed, volume, muted, currentId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.tagName === "INPUT") return;
      if (event.code === "Space") {
        event.preventDefault();
        void togglePlayback();
      }
      if (event.key === "ArrowLeft") seek((mediaRef.current?.currentTime ?? 0) - 5);
      if (event.key === "ArrowRight") seek((mediaRef.current?.currentTime ?? 0) + 5);
      if (event.key.toLowerCase() === "m") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useDocumentEffect(() => {
    document.title = "NOX · Offline Player";
  }, []);

  function seek(value: number) {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = Math.min(Math.max(value, 0), duration || 0);
    setCurrentTime(mediaRef.current.currentTime);
  }

  async function togglePlayback() {
    if (!mediaRef.current || !current) return;
    if (mediaRef.current.paused) {
      await mediaRef.current.play();
      setPlaying(true);
    } else {
      mediaRef.current.pause();
      setPlaying(false);
    }
  }

  function toggleMute() {
    setMuted((value) => {
      if (mediaRef.current) mediaRef.current.muted = !value;
      return !value;
    });
  }

  function selectItem(item: MediaItem) {
    setCurrentId(item.id);
    setCurrentTime(0);
    setPlaying(false);
  }

  function removeItem(id: string) {
    setItems((previous) => {
      const target = previous.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      const next = previous.filter((item) => item.id !== id);
      if (id === currentId) setCurrentId(next[0]?.id ?? null);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#0a0b0b] text-[#f4f1ea] selection:bg-[#c9ff65] selection:text-[#0a0b0b]">
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0a0b0b]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#c9ff65] text-[#10120c] shadow-[0_0_30px_rgba(201,255,101,0.16)]">
              <span className="font-serif text-xl italic">n</span>
            </div>
            <div>
              <div className="flex items-center gap-2"><span className="font-display text-xl font-semibold tracking-[-0.04em]">NOX</span><span className="rounded-full border border-[#c9ff65]/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#c9ff65]">private beta</span></div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Local media workspace</p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            <button onClick={() => setPanel("queue")} className={cn("top-action", panel === "queue" && "top-action-active")}><ListMusic size={16} /> Queue <span>{items.length}</span></button>
            <button onClick={() => setPanel("captions")} className={cn("top-action", panel === "captions" && "top-action-active")}><Subtitles size={16} /> Captions <span>{cues.length}</span></button>
            <button onClick={() => setPanel("settings")} className={cn("top-action", panel === "settings" && "top-action-active")}><Settings2 size={16} /> Settings</button>
          </nav>
          <button onClick={() => setPanel(panel ? null : "settings")} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/60 transition hover:border-white/25 hover:text-white md:hidden"><Menu size={18} /></button>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-72px)] max-w-[1440px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="relative flex min-h-[calc(100vh-72px)] flex-col border-r border-white/[0.08] px-5 py-7 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -left-40 top-24 h-[420px] w-[420px] rounded-full bg-[#c9ff65]/[0.035] blur-[100px]" /><div className="absolute right-0 top-0 h-[350px] w-[350px] rounded-full bg-[#8e7dff]/[0.045] blur-[100px]" /></div>
          <div className="relative mb-8 flex items-end justify-between gap-6">
            <div><p className="eyebrow">01 / studio</p><h1 className="mt-3 max-w-xl font-display text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl">Your media.<br /><span className="font-serif font-normal italic text-[#c9ff65]">Your language.</span></h1></div>
            <div className="hidden text-right sm:block"><div className="mb-2 flex items-center justify-end gap-2 text-[11px] text-white/45"><span className="live-dot" /> device-only mode</div><p className="max-w-[180px] text-xs leading-5 text-white/30">Files stay in this browser. No upload, no cloud account.</p></div>
          </div>

          {!current ? (
            <button onClick={() => mediaInput.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addMedia(Array.from(event.dataTransfer.files)); }} className={cn("relative flex min-h-[390px] flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed transition", dragging ? "border-[#c9ff65] bg-[#c9ff65]/10" : "border-white/15 bg-white/[0.025] hover:border-white/30 hover:bg-white/[0.04]")}>
              <div className="mb-6 grid h-20 w-20 place-items-center rounded-[24px] border border-[#c9ff65]/25 bg-[#c9ff65]/[0.08] text-[#c9ff65]"><Plus size={32} strokeWidth={1.5} /></div>
              <span className="font-display text-2xl font-medium tracking-[-0.03em]">Drop a file to begin</span>
              <span className="mt-3 max-w-sm text-center text-sm leading-6 text-white/40">Play video or audio directly from your device. NOX never uploads your media.</span>
              <span className="mt-7 rounded-full bg-[#c9ff65] px-5 py-2.5 text-xs font-bold uppercase tracking-[0.15em] text-[#0a0b0b]">Browse files</span>
              <span className="mt-5 text-[10px] uppercase tracking-[0.16em] text-white/25">MP4 · WEBM · MOV · MP3 · WAV · FLAC</span>
            </button>
          ) : (
            <div className="relative flex flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.1] bg-[#101212] shadow-2xl">
              <div className="relative flex min-h-[390px] flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,rgba(201,255,101,0.08),transparent_38%),#111313]">
                {current.kind === "video" ? (
                  <video ref={mediaRef} src={current.url} className="h-full max-h-[58vh] w-full object-contain" onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setCurrentTime(0); }} />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <div className="grid h-32 w-32 place-items-center rounded-full border border-[#c9ff65]/30 bg-[#c9ff65]/[0.08] text-[#c9ff65] shadow-[0_0_80px_rgba(201,255,101,0.1)]"><Headphones size={52} strokeWidth={1} /></div>
                    <audio ref={mediaRef} src={current.url} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setCurrentTime(0); }} />
                  </div>
                )}
                {activeCue && <div className="pointer-events-none absolute bottom-7 left-1/2 max-w-[85%] -translate-x-1/2 rounded-lg bg-black/75 px-5 py-3 text-center font-display text-lg shadow-lg backdrop-blur-md" style={{ fontSize: `${captionSize}rem`, transform: `translateX(-50%) translateY(${-captionOffset}px)` }}>{activeCue.text}</div>}
                <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/60 backdrop-blur"><span className="live-dot" /> local playback</div>
              </div>
              <div className="border-t border-white/[0.08] bg-[#0d0f0f] p-5">
                <div className="mb-4 flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-white/90">{current.file.name}</p><p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/30">{current.kind} · {formatTime(currentTime)} / {formatTime(duration)}</p></div><button onClick={() => setPanel("queue")} className="icon-button" aria-label="Open queue"><ListMusic size={17} /></button></div>
                <input aria-label="Playback progress" className="timeline" type="range" min={0} max={duration || 0} step={0.01} value={currentTime} onChange={(event) => seek(Number(event.target.value))} />
                <div className="mt-4 flex items-center justify-between"><div className="flex items-center gap-1"><button onClick={() => seek(currentTime - 5)} className="icon-button" aria-label="Seek back 5 seconds"><RotateCcw size={16} /></button><button onClick={() => void togglePlayback()} className="play-button" aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button><button onClick={() => seek(currentTime + 5)} className="icon-button" aria-label="Seek forward 5 seconds"><RotateCcw className="-scale-x-100" size={16} /></button></div><div className="flex items-center gap-2"><button onClick={toggleMute} className="icon-button" aria-label="Toggle mute">{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><input aria-label="Volume" className="volume" type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume} onChange={(event) => { const value = Number(event.target.value); setVolume(value); setMuted(value === 0); if (mediaRef.current) { mediaRef.current.volume = value; mediaRef.current.muted = value === 0; } }} /></div><div className="flex items-center gap-1"><button onClick={() => setSpeed((value) => value === 2 ? 0.75 : value + 0.25)} className="control-chip"><Gauge size={14} /> {speed}×</button>{current.kind === "video" && <button onClick={() => mediaRef.current?.requestFullscreen()} className="icon-button" aria-label="Fullscreen"><Maximize2 size={17} /></button>}</div></div>
              </div>
            </div>
          )}

          <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3 text-[11px] text-white/35"><span className="flex items-center gap-1.5"><Check size={13} className="text-[#c9ff65]" /> browser-local</span><span className="h-1 w-1 rounded-full bg-white/20" /><span>nothing leaves your device</span></div><div className="flex gap-2"><button onClick={() => subtitleInput.current?.click()} className="secondary-button"><Subtitles size={15} /> Load captions</button><button onClick={() => mediaInput.current?.click()} className="secondary-button"><FolderOpen size={15} /> Add media</button></div></div>
          {notice && <div className="relative mt-3 flex items-center justify-between rounded-xl border border-[#c9ff65]/20 bg-[#c9ff65]/[0.06] px-4 py-3 text-xs text-[#dfffaa]"><span>{notice}</span><button onClick={() => setNotice("")}><X size={14} /></button></div>}
        </section>

        <aside className="relative hidden bg-[#0d0f0f] lg:block">{panel ? <PanelContent panel={panel} items={items} currentId={currentId} cues={cues} activeCue={activeCue} captionSize={captionSize} captionOffset={captionOffset} setCaptionSize={setCaptionSize} setCaptionOffset={setCaptionOffset} selectItem={selectItem} removeItem={removeItem} onClose={() => setPanel(null)} onLoad={() => subtitleInput.current?.click()} /> : <SessionIntro onOpenQueue={() => setPanel("queue")} onOpenCaptions={() => setPanel("captions")} />}</aside>
      </main>

      {panel && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setPanel(null)}><div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-auto rounded-t-[28px] border-t border-white/10 bg-[#111313]" onClick={(event) => event.stopPropagation()}><PanelContent panel={panel} items={items} currentId={currentId} cues={cues} activeCue={activeCue} captionSize={captionSize} captionOffset={captionOffset} setCaptionSize={setCaptionSize} setCaptionOffset={setCaptionOffset} selectItem={selectItem} removeItem={removeItem} onClose={() => setPanel(null)} onLoad={() => subtitleInput.current?.click()} /></div></div>}

      <input ref={mediaInput} className="hidden" type="file" accept="video/*,audio/*,.mp4,.webm,.mov,.mkv,.mp3,.wav,.flac,.ogg,.m4a" multiple onChange={(event) => { addMedia(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
      <input ref={subtitleInput} className="hidden" type="file" accept=".srt,.vtt,text/vtt" onChange={(event) => { void loadSubtitles(event.target.files?.[0]); event.currentTarget.value = ""; }} />
    </div>
  );
}

function SessionIntro({ onOpenQueue, onOpenCaptions }: { onOpenQueue: () => void; onOpenCaptions: () => void }) {
  return <div className="flex h-full min-h-[calc(100vh-72px)] flex-col justify-between p-6"><div><p className="eyebrow">session notes</p><div className="mt-8 space-y-7"><div><div className="mb-3 flex items-center gap-2 text-[#c9ff65]"><Headphones size={16} /><span className="text-xs font-medium uppercase tracking-[0.12em]">Play locally</span></div><p className="text-xs leading-6 text-white/38">Drop a file and your browser creates a temporary local URL. The original media never needs to leave this device.</p></div><div><div className="mb-3 flex items-center gap-2 text-[#c9ff65]"><Languages size={16} /><span className="text-xs font-medium uppercase tracking-[0.12em]">Add captions</span></div><p className="text-xs leading-6 text-white/38">Load an SRT or WebVTT track, then tune its size and position from the caption panel.</p></div><div><div className="mb-3 flex items-center gap-2 text-[#c9ff65]"><Mic2 size={16} /><span className="text-xs font-medium uppercase tracking-[0.12em]">Translate offline</span></div><p className="text-xs leading-6 text-white/38">On-device models are optional. Download once when online, then process supported media without cloud calls.</p></div></div></div><div className="space-y-2"><button onClick={onOpenQueue} className="flex w-full items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-left text-xs text-white/55 transition hover:border-[#c9ff65]/30 hover:text-white"><span className="flex items-center gap-2"><ListMusic size={15} /> Open playback queue</span><ChevronDown className="-rotate-90" size={14} /></button><button onClick={onOpenCaptions} className="flex w-full items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-left text-xs text-white/55 transition hover:border-[#c9ff65]/30 hover:text-white"><span className="flex items-center gap-2"><Subtitles size={15} /> Configure captions</span><ChevronDown className="-rotate-90" size={14} /></button></div></div>;
}

function PanelContent({ panel, items, currentId, cues, activeCue, captionSize, captionOffset, setCaptionSize, setCaptionOffset, selectItem, removeItem, onClose, onLoad }: { panel: Panel; items: MediaItem[]; currentId: string | null; cues: Cue[]; activeCue: Cue | null; captionSize: number; captionOffset: number; setCaptionSize: (value: number) => void; setCaptionOffset: (value: number) => void; selectItem: (item: MediaItem) => void; removeItem: (id: string) => void; onClose: () => void; onLoad: () => void }) {
  const title = panel === "queue" ? "Playback queue" : panel === "captions" ? "Caption track" : "Local settings";
  return <div className="flex h-full min-h-[calc(100vh-72px)] flex-col"><div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-6"><div><p className="eyebrow">workspace</p><h2 className="mt-2 font-display text-xl font-medium tracking-[-0.03em]">{title}</h2></div><button onClick={onClose} className="icon-button"><X size={17} /></button></div>{panel === "queue" && <div className="flex-1 p-4"><button onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-4 text-xs text-white/50 transition hover:border-[#c9ff65]/50 hover:text-[#c9ff65]"><Plus size={15} /> Add to queue</button>{items.length === 0 ? <EmptyPanel icon={<ListMusic size={22} />} title="Queue is empty" copy="Add a local file to start your session." /> : <div className="space-y-1">{items.map((item, index) => <div key={item.id} className={cn("group flex items-center gap-3 rounded-xl p-3 transition", item.id === currentId ? "bg-[#c9ff65]/[0.1]" : "hover:bg-white/[0.04]")}><button onClick={() => selectItem(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", item.id === currentId ? "bg-[#c9ff65] text-[#0a0b0b]" : "bg-white/[0.06] text-white/40")}>{item.kind === "video" ? <FileVideo size={16} /> : <FileAudio size={16} />}</span><span className="min-w-0"><span className="block truncate text-xs text-white/80">{item.file.name}</span><span className="mt-1 block text-[10px] uppercase tracking-wider text-white/25">{String(index + 1).padStart(2, "0")} · {item.kind}</span></span></button><button onClick={() => removeItem(item.id)} className="p-2 text-white/20 opacity-0 transition hover:text-red-300 group-hover:opacity-100"><X size={14} /></button></div>)}</div>}</div>}{panel === "captions" && <div className="flex-1 p-6"><div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-white/75">{cues.length ? "Track loaded" : "No track loaded"}</p><p className="mt-1 text-[11px] leading-5 text-white/35">{cues.length ? `${cues.length} timed cues ready for playback.` : "Load an SRT or WebVTT file from your device."}</p></div><Subtitles size={19} className="text-[#c9ff65]" /></div><button onClick={onLoad} className="mt-5 w-full rounded-xl bg-white/[0.08] py-3 text-xs font-medium text-white/70 transition hover:bg-[#c9ff65] hover:text-[#0a0b0b]">Load SRT / WebVTT</button></div>{activeCue && <div className="mt-4 rounded-2xl border border-[#c9ff65]/20 bg-[#c9ff65]/[0.06] p-5"><p className="eyebrow text-[#c9ff65]">now showing</p><p className="mt-3 text-sm leading-6 text-white/80">{activeCue.text}</p></div>}<div className="mt-5"><p className="eyebrow">track preview</p><div className="mt-3 space-y-2">{cues.slice(0, 6).map((cue) => <div key={`${cue.start}-${cue.text}`} className="flex gap-3 rounded-lg px-2 py-2 text-xs"><span className="w-10 shrink-0 font-mono text-[10px] text-white/25">{formatTime(cue.start)}</span><span className={cn("text-white/45", activeCue?.text === cue.text && "text-[#c9ff65]")}>{cue.text}</span></div>)}</div></div></div>}{panel === "settings" && <div className="flex-1 space-y-7 p-6"><SettingRow icon={<SlidersHorizontal size={16} />} title="Caption size" value={`${Math.round(captionSize * 100)}%`}><input className="timeline" type="range" min="0.75" max="1.5" step="0.05" value={captionSize} onChange={(event) => setCaptionSize(Number(event.target.value))} /></SettingRow><SettingRow icon={<ChevronDown size={16} />} title="Caption lift" value={`${captionOffset}px`}><input className="timeline" type="range" min="0" max="120" step="4" value={captionOffset} onChange={(event) => setCaptionOffset(Number(event.target.value))} /></SettingRow><div className="border-t border-white/[0.08] pt-6"><p className="eyebrow">privacy posture</p><div className="mt-4 space-y-3">{["Media stays in browser memory", "No cloud transcription", "No account required"].map((label) => <div className="flex items-center gap-3 text-xs text-white/60" key={label}><span className="grid h-5 w-5 place-items-center rounded-full bg-[#c9ff65]/15 text-[#c9ff65]"><Check size={12} /></span>{label}</div>)}</div></div><div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex gap-3"><Sparkles size={17} className="mt-0.5 text-[#c9ff65]" /><div><p className="text-xs font-medium text-white/75">On-device models</p><p className="mt-1 text-[11px] leading-5 text-white/35">Whisper and translation models can be downloaded once, then used offline when supported by your browser.</p></div></div></div></div>}</div>;
}

function SettingRow({ icon, title, value, children }: { icon: ReactNode; title: string; value: string; children: ReactNode }) { return <div><div className="mb-3 flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-white/60">{icon}{title}</span><span className="font-mono text-[10px] text-[#c9ff65]">{value}</span></div>{children}</div>; }
function EmptyPanel({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) { return <div className="flex flex-col items-center justify-center py-20 text-center text-white/30">{icon}<p className="mt-4 text-sm text-white/55">{title}</p><p className="mt-2 max-w-[210px] text-xs leading-5">{copy}</p></div>; }
