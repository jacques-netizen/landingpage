// The written guide as data. The AI writer and the rules writer both produce
// this shape; the web page, the PDF and the result scene all render from it.
// Nothing in here is server only, so the browser can read the stored JSON.
import type { Objective, Path, ProofItem } from "@/lib/content";
import type { Numbers } from "./model";

export type GuideTile = { value: string; label: string };

export type GuideStep = { title: string; body: string };

export type GuideSection = {
  key: string;
  title: string;
  /** One line under the title, set in the large serif. */
  lead?: string;
  paragraphs: string[];
  bullets?: string[];
  /** Ordered steps, shown on the timeline rail (the strategy track, the first month). */
  steps?: GuideStep[];
  callout?: { label?: string; text: string };
  /** Rules writer only: markdown already rendered to HTML. */
  html?: string;
  platforms?: { lead: string; items: { key: string; name: string; text: string }[] };
  /** Show the numbers model block (tiles plus slider) in this section. */
  numbers?: boolean;
  /** Show the matched case studies in this section. */
  proof?: boolean;
};

export type GuideNext = { kind: "book" | "join" | "reply"; url: string; label: string; text: string };

export type GuideDoc = {
  version: 2;
  writer: "ai" | "rules";
  model: string | null;
  path: Path;
  objective: Objective | null;
  /** Typed answers, cleaned. Null when not asked or skipped. */
  project: string | null;
  market: string | null;
  audience: string | null;
  action: string | null;
  firstName: string;
  /** The answers as short labels, for the summary card. */
  facts: { id: string; question: string; answer: string }[];
  hero: { kicker: string; headline: string; sub: string; tiles: GuideTile[] };
  summary: string[];
  sections: GuideSection[];
  proofIntro: string;
  proof: ProofItem[];
  numbers: Numbers;
  next: GuideNext;
  preparedFor: string;
  footer: string;
  generatedAt: string;
  contentVersion: string;
};

/** Section keys per audience, in the order the guide shows them. */
export const SECTION_KEYS = {
  buyer: ["what_it_does", "your_strategy", "playbook", "where_to_post", "how_it_runs", "numbers", "first_month", "what_to_prepare", "mistakes", "proof", "next_step"],
  clipper: ["how_it_pays", "set_up", "a_day", "what_travels", "rules", "first_month", "your_niche", "proof", "next_step"],
} as const;

export type SectionKey = (typeof SECTION_KEYS)[keyof typeof SECTION_KEYS][number];

/** Every word of the guide as one string, for the checks (em dashes, figures). */
export function guideText(doc: GuideDoc): string {
  const parts: string[] = [doc.hero.headline, doc.hero.sub, ...doc.hero.tiles.flatMap((t) => [t.value, t.label]), ...doc.summary, doc.proofIntro];
  for (const s of doc.sections) {
    parts.push(s.title, s.lead ?? "", ...s.paragraphs, ...(s.bullets ?? []), s.callout?.text ?? "", s.html ?? "");
    for (const st of s.steps ?? []) parts.push(st.title, st.body);
  }
  return parts.join("\n");
}
