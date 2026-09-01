import { findModel, type LocalModel } from "./catalog";
import type { Cue } from "../srt";
import { wordsToCues } from "../srt";
import type { PcmClip } from "../audio";

type ProgressCb = (p: { status: string; file?: string; progress?: number }) => void;

type AsrPipe = (audio: Float32Array | { audio: Float32Array; sampling_rate: number }, opts?: Record<string, unknown>) => Promise<{
  text?: string;
  chunks?: { text: string; timestamp: [number, number | null] }[];
}>;

type MtPipe = (text: string | string[]) => Promise<{ translation_text: string } | { translation_text: string }[]>;

const asrCache = new Map<string, AsrPipe>();
const mtCache = new Map<string, MtPipe>();
const ready = new Set<string>();
const progressMap = new Map<string, number>();

async function loadTransformers() {
  const mod = await import("@huggingface/transformers");
  const env = mod.env;
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  return mod;
}

export function modelProgress(id: string) {
  return progressMap.get(id) ?? 0;
}

export function isModelReady(id: string) {
  return ready.has(id);
}

export function listReadyModels() {
  return [...ready];
}

export async function detectCachedModels() {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      const reqs = await cache.keys();
      for (const model of await import("./catalog").then((m) => m.LOCAL_MODELS)) {
        const token = model.hf.split("/")[1] ?? model.hf;
        if (reqs.some((r) => r.url.includes(token))) ready.add(model.id);
      }
    }
  } catch {
    /* ignore */
  }
}

export async function loadLocalModel(id: string, onProgress?: ProgressCb) {
  const spec = findModel(id);
  if (!spec) throw new Error("Unknown model");
  if (spec.task === "stt" && asrCache.has(id)) {
    ready.add(id);
    return;
  }
  if (spec.task === "mt" && mtCache.has(id)) {
    ready.add(id);
    return;
  }
  const { pipeline } = await loadTransformers();
  const task = spec.task === "stt" ? "automatic-speech-recognition" : "translation";
  const pipe = await pipeline(task, spec.hf, {
    dtype: "q8",
    progress_callback: (info: { status?: string; file?: string; progress?: number }) => {
      if (typeof info.progress === "number") progressMap.set(id, info.progress);
      onProgress?.({
        status: info.status ?? "",
        file: info.file,
        progress: info.progress,
      });
    },
  });
  if (spec.task === "stt") asrCache.set(id, pipe as unknown as AsrPipe);
  else mtCache.set(id, pipe as unknown as MtPipe);
  ready.add(id);
  progressMap.set(id, 100);
}

export async function unloadLocalModel(id: string) {
  asrCache.delete(id);
  mtCache.delete(id);
  ready.delete(id);
  progressMap.delete(id);
}

export async function transcribeLocal(
  modelId: string,
  clip: PcmClip,
  language?: string,
  offset = 0,
): Promise<Cue[]> {
  let pipe = asrCache.get(modelId);
  if (!pipe) {
    await loadLocalModel(modelId);
    pipe = asrCache.get(modelId);
  }
  if (!pipe) throw new Error("Speech model not loaded");
  const opts: Record<string, unknown> = {
    return_timestamps: "word",
    chunk_length_s: 20,
    stride_length_s: 4,
    sampling_rate: clip.sampleRate,
  };
  if (language && language !== "auto") opts.language = language;
  const out = await pipe(clip.samples, opts);
  if (out.chunks && out.chunks.length > 0) {
    const words = out.chunks
      .filter((c) => c.timestamp[0] != null)
      .map((c) => ({
        text: c.text,
        start: c.timestamp[0],
        end: c.timestamp[1] ?? c.timestamp[0] + 0.4,
      }));
    const looksLikeWords = words.length > 3 && words.every((w) => w.text.trim().split(/\s+/).length <= 4);
    if (looksLikeWords) return wordsToCues(words, offset);
    return words.map((w) => ({
      start: w.start + offset,
      end: w.end + offset,
      text: w.text.trim(),
    }));
  }
  const text = (out.text ?? "").trim();
  if (!text) return [];
  const dur = clip.samples.length / clip.sampleRate;
  return [{ start: offset, end: offset + dur, text }];
}

export async function translateLocal(model: LocalModel, lines: string[]) {
  let pipe = mtCache.get(model.id);
  if (!pipe) {
    await loadLocalModel(model.id);
    pipe = mtCache.get(model.id);
  }
  if (!pipe) throw new Error("Translation model not loaded");
  const out: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      out.push("");
      continue;
    }
    const res = await pipe(line);
    const row = Array.isArray(res) ? res[0] : res;
    out.push(row?.translation_text ?? line);
  }
  return out;
}
