export type Cue = { start: number; end: number; text: string };

const time = (s: string) => {
  const parts = s.trim().split(":").map(Number);
  return parts.reduce((acc, n) => acc * 60 + n, 0);
};

/** Minimal WebVTT parser for the caption overlay. */
export function parseVtt(text: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of text.replace(/\r/g, "").split(/\n\n+/)) {
    const lines = block.split("\n");
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->");
    const body = lines.slice(i + 1).join("\n").replace(/<[^>]+>/g, "").trim();
    if (body) cues.push({ start: time(a), end: time(b.trim().split(/\s+/)[0]), text: body });
  }
  return cues;
}
