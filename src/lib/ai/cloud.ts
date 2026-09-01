import { createServerFn } from "@tanstack/react-start";
import { LANGUAGES } from "./catalog";

export type WordHit = { text: string; start: number; end: number };

export type SttResult =
  | { ok: true; text: string; words: WordHit[]; language?: string }
  | { ok: false; error: string };

export type TranslateResult =
  | { ok: true; lines: string[] }
  | { ok: false; error: string };

const MAX_B64 = 3_200_000;
const MAX_LINES = 36;

export const getAiStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { available: Boolean(process.env.XAI_API_KEY) };
});

export const transcribeChunk = createServerFn({ method: "POST" })
  .validator((input: { wavBase64: string; language?: string }) => {
    if (!input?.wavBase64 || typeof input.wavBase64 !== "string") {
      throw new Error("Missing audio");
    }
    if (input.wavBase64.length > MAX_B64) {
      throw new Error("Audio chunk too large");
    }
    return input;
  })
  .handler(async ({ data }): Promise<SttResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "AI is not available" };

    const bin = Buffer.from(data.wavBase64, "base64");
    const form = new FormData();
    if (data.language && data.language !== "auto") {
      form.append("language", data.language);
      form.append("format", "true");
    }
    form.append("file", new Blob([bin], { type: "audio/wav" }), "chunk.wav");

    const res = await fetch("https://api.x.ai/v1/stt", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `STT ${res.status}${detail ? `: ${detail.slice(0, 180)}` : ""}` };
    }
    const body = (await res.json()) as {
      text?: string;
      language?: string;
      words?: { text: string; start: number; end: number }[];
    };
    return {
      ok: true,
      text: body.text ?? "",
      language: body.language,
      words: (body.words ?? []).map((w) => ({
        text: w.text,
        start: w.start,
        end: w.end,
      })),
    };
  });

export const translateLines = createServerFn({ method: "POST" })
  .validator((input: { lines: string[]; sourceLang: string; targetLang: string }) => {
    if (!Array.isArray(input.lines) || input.lines.length === 0) {
      throw new Error("No lines");
    }
    return {
      lines: input.lines.slice(0, MAX_LINES).map((l) => String(l).slice(0, 400)),
      sourceLang: input.sourceLang || "auto",
      targetLang: input.targetLang || "zh",
    };
  })
  .handler(async ({ data }): Promise<TranslateResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "AI is not available" };

    const src =
      LANGUAGES.find((l) => l.id === data.sourceLang)?.label ?? data.sourceLang;
    const tgt =
      LANGUAGES.find((l) => l.id === data.targetLang)?.label ?? data.targetLang;

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.1,
        max_tokens: 1800,
        messages: [
          {
            role: "system",
            content:
              "You translate film/video subtitles. Return ONLY a JSON array of strings, same length and order as the input. Preserve meaning, keep lines short, do not add quotes or numbering.",
          },
          {
            role: "user",
            content: `Translate from ${src} to ${tgt}. Input JSON:\n${JSON.stringify(data.lines)}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `Translate ${res.status}` };
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = body.choices?.[0]?.message?.content ?? "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    try {
      const parsed = JSON.parse(jsonMatch?.[0] ?? raw) as unknown;
      if (!Array.isArray(parsed)) return { ok: false, error: "Bad translate payload" };
      const lines = parsed.map((x) => String(x ?? ""));
      while (lines.length < data.lines.length) lines.push(data.lines[lines.length] ?? "");
      return { ok: true, lines: lines.slice(0, data.lines.length) };
    } catch {
      return { ok: false, error: "Could not parse translation" };
    }
  });

export const makeSampleClip = createServerFn({ method: "POST" }).handler(async () => {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false as const, error: "AI is not available" };

  const res = await fetch("https://api.x.ai/v1/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      text: "Welcome to NOX, the offline AI video translation player. Drop in a film, download a free speech model, and watch subtitles appear in your language in real time.",
      voice_id: "eve",
    }),
  });
  if (!res.ok) {
    return { ok: false as const, error: `TTS ${res.status}` };
  }
  const mime = res.headers.get("content-type") || "audio/mpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { ok: true as const, mime, audio: buf.toString("base64") };
});
