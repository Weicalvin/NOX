import { encodeWav, blobToBase64, slicePcm, pcmDuration, type PcmClip } from "../audio";
import { mergeCues, wordsToCues, type Cue } from "../srt";
import { findModel, findMtModel } from "./catalog";
import { transcribeChunk, translateLines } from "./cloud";
import { isModelReady, transcribeLocal, translateLocal } from "./local-engine";
import { usePlayer, type EngineMode } from "../store";

const CLOUD_CHUNK = 18;
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
  cloudAvailable: boolean;
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
    opts.engine !== "cloud" && mt && isModelReady(mt.id) &&
    (opts.sourceLang === "auto" || !mt.src || mt.src === opts.sourceLang) &&
    (!mt.tgt || mt.tgt === opts.targetLang);

  const lines = cues.map((c) => c.text);
  if (canLocal && mt) {
    try {
      const translated = await translateLocal(mt, lines);
      return cues.map((c, i) => ({ ...c, translation: translated[i] ?? c.text }));
    } catch {
      /* fall through */
    }
  }

  if (opts.engine === "local") return cues;
  if (!opts.cloudAvailable) return cues;

  const translated: string[] = [];
  for (let i = 0; i < lines.length; i += 30) {
    const batch = lines.slice(i, i + 30);
    const res = await translateLines({
      data: {
        lines: batch,
        sourceLang: opts.sourceLang,
        targetLang: opts.targetLang,
      },
    });
    if (!res.ok) throw new Error(res.error);
    translated.push(...res.lines);
  }
  return cues.map((c, i) => ({ ...c, translation: translated[i] ?? c.text }));
}

async function transcribeCloud(clip: PcmClip, opts: RunOpts, offset: number): Promise<Cue[]> {
  const wav = encodeWav(clip);
  const wavBase64 = await blobToBase64(wav);
  const res = await transcribeChunk({
    data: {
      wavBase64,
      language: opts.sourceLang === "auto" ? undefined : opts.sourceLang,
    },
  });
  if (!res.ok) throw new Error(res.error);
  if (res.words.length > 0) return wordsToCues(res.words, offset);
  const dur = pcmDuration(clip);
  const text = res.text.trim();
  if (!text) return [];
  return [{ start: offset, end: offset + dur, text }];
}

export async function transcribeRange(opts: RunOpts): Promise<Cue[]> {
  const start = opts.start ?? 0;
  const end = opts.end ?? pcmDuration(opts.clip);
  const offset = opts.offset ?? start;
  const slice = slicePcm(opts.clip, start, end);
  const useLocal =
    opts.engine !== "cloud" && isModelReady(opts.sttModelId);
  if (useLocal) {
    const cues = await transcribeLocal(opts.sttModelId, slice, opts.whisperLang, offset);
    return translateCues(cues, opts);
  }
  if (opts.engine === "local") {
    throw new Error("local-stt-missing");
  }
  if (!opts.cloudAvailable) throw new Error("cloud-unavailable");
  const cues = await transcribeCloud(slice, opts, offset);
  return translateCues(cues, opts);
}

export async function transcribeFull(
  opts: RunOpts,
  onProgress: (ratio: number, label: string) => void,
) {
  const total = pcmDuration(opts.clip);
  const chunk = opts.engine === "cloud" || !isModelReady(opts.sttModelId) ? CLOUD_CHUNK : LOCAL_CHUNK;
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
    cloudAvailable: s.cloudAvailable,
    whisperLang:
      s.sourceLang === "auto"
        ? undefined
        : (s.sourceLang === "zh" ? "chinese" : s.sourceLang),
  };
}
