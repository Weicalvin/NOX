/** Android APK build — no server functions. Local models only. */

export async function getAiStatus() {
  return { available: false };
}

export async function transcribeChunk(_input?: {
  data?: { wavBase64?: string; language?: string };
}) {
  return {
    ok: false as const,
    error: "Cloud AI is not packaged in the Android app. Download an on-device speech model.",
  };
}

export async function translateLines(_input?: {
  data?: { lines?: string[]; sourceLang?: string; targetLang?: string };
}) {
  return {
    ok: false as const,
    error: "Cloud AI is not packaged in the Android app. Download a translation model.",
  };
}

export async function makeSampleClip() {
  return {
    ok: false as const,
    error: "Sample clip is only in the web app. Open a local audio or video file instead.",
  };
}
