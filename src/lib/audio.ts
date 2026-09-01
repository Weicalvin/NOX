const TARGET_RATE = 16000;

export type PcmClip = {
  sampleRate: number;
  samples: Float32Array;
};

function mixToMono(buffer: AudioBuffer) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const out = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) out[i] += data[i] ?? 0;
  }
  if (channels > 1) {
    for (let i = 0; i < length; i++) out[i] /= channels;
  }
  return out;
}

function resample(input: Float32Array, fromRate: number, toRate: number) {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.round(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const t = src - i0;
    out[i] = (input[i0] ?? 0) * (1 - t) + (input[i1] ?? 0) * t;
  }
  return out;
}

export async function decodeToMono16k(file: File | Blob): Promise<PcmClip> {
  const ctx = new AudioContext({ sampleRate: TARGET_RATE });
  try {
    const raw = await file.arrayBuffer();
    const audio = await ctx.decodeAudioData(raw.slice(0));
    const mono = mixToMono(audio);
    const samples = resample(mono, audio.sampleRate, TARGET_RATE);
    return { sampleRate: TARGET_RATE, samples };
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

export function slicePcm(clip: PcmClip, startSec: number, endSec: number): PcmClip {
  const start = Math.max(0, Math.floor(startSec * clip.sampleRate));
  const end = Math.min(clip.samples.length, Math.floor(endSec * clip.sampleRate));
  return {
    sampleRate: clip.sampleRate,
    samples: clip.samples.subarray(start, Math.max(start + 1, end)),
  };
}

export function encodeWav(clip: PcmClip): Blob {
  const samples = clip.samples;
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, clip.sampleRate, true);
  view.setUint32(28, clip.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function blobToBase64(blob: Blob) {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function pcmDuration(clip: PcmClip) {
  return clip.samples.length / clip.sampleRate;
}
