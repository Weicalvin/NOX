import { slicePcm, pcmDuration, type PcmClip } from "../audio";
import { mergeCues, type Cue } from "../srt";
import { findModel, findMtModel } from "./catalog";
import { isModelReady, transcribeLocal, translateLocal } from "./local-engine";
import { usePlayer, type EngineMode } from "../store";

const LOCAL_CHUNK = 24;

export type RunOpts = {
  clip: PcmClip;
  start?: number;
  end?: number;
  offset?: number;
  engine: EngineMode;
  sttModelId: string;
  mtModelId: string;
  sourceLang: string;
  targetLang: string;
  whisperLang?: string;
};

async function translateCues(cues: Cue[], opts: RunOpts): Promise<Cue[]> {
  if (cues.length === 0) return cues;
  if (opts.sourceLang !== "auto" && opts.sourceLang === opts.targetLang) {
    return cues.map((c) => ({ ...c, translation: c.text }));
  }

  const localMt = findModel(opts.mtModelId);
  const pair = findMtModel(
    opts.sourceLang === "auto" ? "en" : opts.sourceLang,
    opts.targetLang,
  );
  const mt = localMt?.task === "mt" ? localMt : pair;
  const canLocal =
    mt && isModelReady(mt.id) &&
    (opts.sourceLang === "auto" || !mt.src || mt.src === opts.sourceLang) &&
    (!mt.tgt || mt.tgt === opts.targetLang);

  const lines = cues.map((c) => c.text);
  if (canLocal && mt) {
    try {
      const translated = await translateLocal(mt, lines);
      return cues.map((c, i) => ({ ...c, translation: translated[i] ?? c.text }));
    } catch {
      return cues;
    }
  }

  // 純離線模式：沒有可用的本機翻譯模型時保留原文，不連線到任何雲端服務。
  return cues;
}

export async function transcribeRange(opts: RunOpts): Promise<Cue[]> {
  const start = opts.start ?? 0;
  const end = opts.end ?? pcmDuration(opts.clip);
  const offset = opts.offset ?? start;
  const slice = slicePcm(opts.clip, start, end);
  const useLocal = isModelReady(opts.sttModelId);
  if (useLocal) {
    const cues = await transcribeLocal(opts.sttModelId, slice, opts.whisperLang, offset);
    return translateCues(cues, opts);
  }
  throw new Error("local-stt-missing");
}

export async function transcribeFull(
  opts: RunOpts,
  onProgress: (ratio: number, label: string) => void,
) {
  const total = pcmDuration(opts.clip);
  const chunk = LOCAL_CHUNK;
  let cues: Cue[] = [];
  let t = 0;
  let i = 0;
  const n = Math.max(1, Math.ceil(total / chunk));
  while (t < total - 0.15) {
    const end = Math.min(total, t + chunk);
    onProgress(i / n, `${i + 1} / ${n}`);
    const part = await transcribeRange({ ...opts, start: t, end, offset: t });
    cues = mergeCues(cues, part);
    t = end;
    i += 1;
  }
  onProgress(1, `${n} / ${n}`);
  return cues;
}

export function liveTick(currentTime: number, lastEnd: number) {
  const CATCH = 5.5;
  if (currentTime - lastEnd < CATCH) return null;
  const start = lastEnd;
  const end = Math.min(currentTime, lastEnd + 8);
  return { start, end };
}

export function snapshotOpts(): Omit<RunOpts, "clip"> {
  const s = usePlayer.getState();
  return {
    engine: s.engine,
    sttModelId: s.sttModelId,
    mtModelId: s.mtModelId,
    sourceLang: s.sourceLang,
    targetLang: s.targetLang,
    whisperLang:
      s.sourceLang === "auto"
        ? undefined
        : (s.sourceLang === "zh" ? "chinese" : s.sourceLang),
  };
}
