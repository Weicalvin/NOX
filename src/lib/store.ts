import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid, isAudioFile, isVideoFile } from "./utils";
import type { Cue } from "./srt";
import type { UiLang } from "./i18n";
import type { PcmClip } from "./audio";

export type EngineMode = "local";
export type Panel = "none" | "playlist" | "models" | "translate" | "install" | "help";

export type MediaItem = {
  id: string;
  name: string;
  kind: "video" | "audio";
  url: string;
  mime: string;
  size: number;
};

type PlayerState = {
  playlist: MediaItem[];
  currentId: string | null;
  volume: number;
  muted: boolean;
  rate: number;
  autoplayNext: boolean;
  uiLang: UiLang;
  sourceLang: string;
  targetLang: string;
  engine: EngineMode;
  sttModelId: string;
  mtModelId: string;
  subtitleSize: number;
  showOriginal: boolean;
  bilingual: boolean;
  cues: Cue[];
  live: boolean;
  busy: string | null;
  progress: number;
  panel: Panel;
  readyModels: string[];
  downloadProgress: Record<string, number>;
  pcmReady: Record<string, boolean>;
};

type PlayerActions = {
  addFiles: (files: File[]) => MediaItem[];
  removeItem: (id: string) => void;
  select: (id: string) => void;
  selectRelative: (dir: 1 | -1) => void;
  setVolume: (v: number) => void;
  setMuted: (v: boolean) => void;
  setRate: (v: number) => void;
  setAutoplayNext: (v: boolean) => void;
  setUiLang: (v: UiLang) => void;
  setSourceLang: (v: string) => void;
  setTargetLang: (v: string) => void;
  setEngine: (v: EngineMode) => void;
  setSttModel: (v: string) => void;
  setMtModel: (v: string) => void;
  setSubtitleSize: (v: number) => void;
  setShowOriginal: (v: boolean) => void;
  setBilingual: (v: boolean) => void;
  setCues: (cues: Cue[]) => void;
  patchCues: (cues: Cue[]) => void;
  setLive: (v: boolean) => void;
  setBusy: (v: string | null) => void;
  setProgress: (v: number) => void;
  setPanel: (v: Panel) => void;
  togglePanel: (v: Panel) => void;
  markModelReady: (id: string) => void;
  setDownloadProgress: (id: string, n: number) => void;
  markPcm: (id: string, ready: boolean) => void;
  current: () => MediaItem | undefined;
};

export const pcmStore = new Map<string, PcmClip>();

export const usePlayer = create<PlayerState & PlayerActions>()(
  persist(
    (set, get) => ({
      playlist: [],
      currentId: null,
      volume: 0.85,
      muted: false,
      rate: 1,
      autoplayNext: true,
      uiLang: "zh",
      sourceLang: "auto",
      targetLang: "zh",
      engine: "local",
      sttModelId: "whisper-tiny",
      mtModelId: "mt-en-zh",
      subtitleSize: 28,
      showOriginal: true,
      bilingual: true,
      cues: [],
      live: false,
      busy: null,
      progress: 0,
      panel: "none",
      readyModels: [],
      downloadProgress: {},
      pcmReady: {},

      addFiles: (files) => {
        const added: MediaItem[] = [];
        for (const file of files) {
          const kind = isVideoFile(file) ? "video" : isAudioFile(file) ? "audio" : null;
          if (!kind) continue;
          added.push({
            id: uid(),
            name: file.name,
            kind,
            url: URL.createObjectURL(file),
            mime: file.type || (kind === "video" ? "video/mp4" : "audio/mpeg"),
            size: file.size,
          });
        }
        if (added.length === 0) return added;
        set((s) => ({
          playlist: [...s.playlist, ...added],
          currentId: s.currentId ?? added[0]!.id,
          cues: s.currentId ? s.cues : [],
        }));
        return added;
      },

      removeItem: (id) => {
        const item = get().playlist.find((p) => p.id === id);
        if (item) URL.revokeObjectURL(item.url);
        pcmStore.delete(id);
        set((s) => {
          const playlist = s.playlist.filter((p) => p.id !== id);
          const currentId =
            s.currentId === id ? (playlist[0]?.id ?? null) : s.currentId;
          return {
            playlist,
            currentId,
            cues: s.currentId === id ? [] : s.cues,
            pcmReady: { ...s.pcmReady, [id]: false },
          };
        });
      },

      select: (id) => {
        if (get().currentId === id) return;
        set({ currentId: id, cues: [], live: false, busy: null, progress: 0 });
      },

      selectRelative: (dir) => {
        const { playlist, currentId } = get();
        if (playlist.length === 0) return;
        const idx = Math.max(0, playlist.findIndex((p) => p.id === currentId));
        const next = playlist[(idx + dir + playlist.length) % playlist.length];
        if (next) get().select(next.id);
      },

      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      setMuted: (muted) => set({ muted }),
      setRate: (rate) => set({ rate }),
      setAutoplayNext: (autoplayNext) => set({ autoplayNext }),
      setUiLang: (uiLang) => set({ uiLang }),
      setSourceLang: (sourceLang) => set({ sourceLang }),
      setTargetLang: (targetLang) => set({ targetLang }),
      setEngine: (engine) => set({ engine }),
      setSttModel: (sttModelId) => set({ sttModelId }),
      setMtModel: (mtModelId) => set({ mtModelId }),
      setSubtitleSize: (subtitleSize) => set({ subtitleSize }),
      setShowOriginal: (showOriginal) => set({ showOriginal }),
      setBilingual: (bilingual) => set({ bilingual }),
      setCues: (cues) => set({ cues }),
      patchCues: (cues) => set({ cues }),
      setLive: (live) => set({ live }),
      setBusy: (busy) => set({ busy }),
      setProgress: (progress) => set({ progress }),
      setPanel: (panel) => set({ panel }),
      togglePanel: (panel) =>
        set((s) => ({ panel: s.panel === panel ? "none" : panel })),
      markModelReady: (id) =>
        set((s) => ({
          readyModels: s.readyModels.includes(id) ? s.readyModels : [...s.readyModels, id],
        })),
      setDownloadProgress: (id, n) =>
        set((s) => ({ downloadProgress: { ...s.downloadProgress, [id]: n } })),
      markPcm: (id, ready) =>
        set((s) => ({ pcmReady: { ...s.pcmReady, [id]: ready } })),
      current: () => get().playlist.find((p) => p.id === get().currentId),
    }),
    {
      name: "nox-prefs",
      partialize: (s) => ({
        volume: s.volume,
        muted: s.muted,
        rate: s.rate,
        autoplayNext: s.autoplayNext,
        uiLang: s.uiLang,
        sourceLang: s.sourceLang,
        targetLang: s.targetLang,
        engine: s.engine,
        sttModelId: s.sttModelId,
        mtModelId: s.mtModelId,
        subtitleSize: s.subtitleSize,
        showOriginal: s.showOriginal,
        bilingual: s.bilingual,
      }),
    },
  ),
);
