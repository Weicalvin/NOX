import { srtTimestamp } from "./format";

export type Cue = {
  start: number;
  end: number;
  text: string;
  translation?: string;
};

function parseTimestamp(raw: string) {
  const clean = raw.trim().replace(",", ".");
  const m = clean.match(/(?:(\d+):)?(\d+):(\d+)(?:\.(\d+))?/);
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  const frac = (m[4] ?? "0").padEnd(3, "0").slice(0, 3);
  return h * 3600 + min * 60 + s + Number(frac) / 1000;
}

export function parseSubtitles(input: string): Cue[] {
  const text = input.replace(/^\uFEFF/, "").replace(/\r/g, "");
  const body = text.startsWith("WEBVTT")
    ? text.replace(/^WEBVTT[^\n]*\n+/, "")
    : text;
  const blocks = body.split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) continue;
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const [startRaw, endRaw] = timeLine.split("-->");
    const start = parseTimestamp(startRaw ?? "0");
    const end = parseTimestamp((endRaw ?? "0").split(" ")[0] ?? "0");
    const idx = lines.indexOf(timeLine);
    const content = lines
      .slice(idx + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!content) continue;
    cues.push({ start, end, text: content });
  }
  return cues;
}

export function toSrt(cues: Cue[], bilingual: boolean) {
  return cues
    .map((cue, i) => {
      const body =
        bilingual && cue.translation
          ? `${cue.text}\n${cue.translation}`
          : (cue.translation ?? cue.text);
      return `${i + 1}\n${srtTimestamp(cue.start)} --> ${srtTimestamp(cue.end)}\n${body}\n`;
    })
    .join("\n");
}

export function wordsToCues(
  words: { text: string; start: number; end: number }[],
  offset = 0,
  maxGap = 0.7,
  maxDur = 4.2,
): Cue[] {
  const cues: Cue[] = [];
  let cur: Cue | null = null;
  for (const word of words) {
    const start = word.start + offset;
    const end = word.end + offset;
    const token = word.text.trim();
    if (!token) continue;
    const glue = /^['’.,!?%]/.test(token) ? "" : " ";
    if (!cur || start - cur.end > maxGap || end - cur.start > maxDur) {
      if (cur) cues.push(cur);
      cur = { start, end, text: token };
    } else {
      cur.end = end;
      cur.text += glue + token;
    }
  }
  if (cur) cues.push(cur);
  return cues;
}

export function mergeCues(existing: Cue[], incoming: Cue[]) {
  if (incoming.length === 0) return existing;
  const cutoff = incoming[0]!.start - 0.05;
  const kept = existing.filter((c) => c.end <= cutoff + 0.01);
  return [...kept, ...incoming].sort((a, b) => a.start - b.start);
}

export function activeCue(cues: Cue[], time: number) {
  for (let i = cues.length - 1; i >= 0; i--) {
    const c = cues[i]!;
    if (time >= c.start && time <= c.end + 0.12) return c;
  }
  return null;
}
