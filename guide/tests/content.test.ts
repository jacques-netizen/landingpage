// Content integrity: the rules in sections 3, 6.3 and 10 of the build plan,
// checked mechanically over every content file.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { flow, getQuestion, media, PATHS, questionFor } from "@/lib/content";
import proofJson from "../content/proof.json";

const contentDir = path.resolve(__dirname, "../content");
const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(path.join(dir, d.name)) : [path.join(dir, d.name)],
  );
const all = files(contentDir).map((f) => ({ f: path.relative(contentDir, f), text: fs.readFileSync(f, "utf8") }));

describe("content", () => {
  it("has no em dashes", () => {
    for (const { f, text } of all) expect(text.includes(String.fromCharCode(0x2014)), f).toBe(false);
  });

  it("references only questions and media that exist", () => {
    for (const steps of Object.values(flow)) {
      for (const s of steps) {
        if (s.question) expect(getQuestion(s.question), s.id).toBeTruthy();
        if (s.media) expect(media[s.media], s.id).toBeTruthy();
      }
    }
    for (const p of PATHS) expect(media[`result_${p}`]).toBeTruthy();
  });

  it("gives every question a variant for every path that sees it", () => {
    for (const steps of Object.values(flow)) {
      for (const s of steps.filter((x) => x.question)) {
        for (const p of PATHS.filter((x) => !s.paths || s.paths.includes(x))) {
          expect(questionFor(s.question!, p)?.options.length, `${s.id} ${p}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("never carries the retired claims from the old deck", () => {
    const banned = [/100%/, /clickfunnels/i, /45k/i, /300M/i, /\$2M/i, /gyamfi/i, /90%/, /meta ads/i];
    for (const { f, text } of all) for (const b of banned) expect(b.test(text), `${f} ${b}`).toBe(false);
  });

  it("only shows figures from approved proof", () => {
    const items = Object.values(proofJson.items) as { status: string; headline?: string; figures?: { value: string }[] }[];
    const approved = new Set(items.filter((i) => i.status === "approved").flatMap((i) => [i.headline, ...(i.figures ?? []).map((x) => x.value)]).filter(Boolean) as string[]);
    // Budget bands and the per 1,000 views rate unit are not claims.
    const figure = /(\$\d[\d.,]*[KMB]?\+?|\b\d[\d.]*[KMB]\+?(?=\s|$|[.,]))/g;
    const allowedFiles = new Set(["proof.json", "questions.json"]);
    for (const { f, text } of all) {
      if (allowedFiles.has(f)) continue;
      for (const m of text.match(figure) ?? []) expect(approved.has(m), `${f}: ${m}`).toBe(true);
    }
  });
});
