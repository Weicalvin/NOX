import { env, pipeline } from "@huggingface/transformers";

env.useBrowserCache = true;
env.allowRemoteModels = true;
env.allowLocalModels = false;

type WorkerRequest =
  | { type: "load"; task: "asr" | "translation"; model: string }
  | { type: "transcribe"; audio: Float32Array; model: string; language?: string }
  | { type: "translate"; text: string; model: string };

type Progress = { status?: string; file?: string; progress?: number; loaded?: number; total?: number };
const pipelines = new Map<string, any>();
const keyFor = (task: string, model: string) => `${task}:${model}`;

async function getPipeline(task: "asr" | "translation", model: string) {
  const key = keyFor(task, model);
  const existing = pipelines.get(key);
  if (existing) return existing;
  const progress_callback = (progress: Progress) => self.postMessage({ type: "progress", task, model, ...progress });
  let instance;
  try {
    instance = await pipeline(task === "asr" ? "automatic-speech-recognition" : "translation", model, {
      dtype: task === "asr" ? "fp32" : "q8",
      device: "wasm",
      progress_callback,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (task !== "asr" || !/TransposeDQWeightsForMatMulNBits|Missing required scale|Can't create a session/i.test(message)) throw error;
    self.postMessage({ type: "fallback", task, model, message: "量化權重不相容，改用相容模式重新載入" });
    instance = await pipeline("automatic-speech-recognition", model, {
      dtype: "fp32",
      device: "wasm",
      progress_callback,
    });
  }
  pipelines.set(key, instance);
  return instance;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "load") {
      await getPipeline(request.task, request.model);
      self.postMessage({ type: "ready", task: request.task, model: request.model });
      return;
    }
    if (request.type === "transcribe") {
      const transcriber = await getPipeline("asr", request.model);
      const result = await transcriber(request.audio, { return_timestamps: true, language: request.language, chunk_length_s: 30, stride_length_s: 5 });
      self.postMessage({ type: "transcription", model: request.model, result });
      return;
    }
    const translator = await getPipeline("translation", request.model);
    const result = await translator(request.text);
    self.postMessage({ type: "translation", model: request.model, result });
  } catch (error) {
    self.postMessage({ type: "error", model: request.model, message: error instanceof Error ? error.message : "模型處理失敗" });
  }
};
