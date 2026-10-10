import "server-only";
// The rules writer: the fixed content blocks from content/guide, mapped onto
// the guide's section keys, plus the strategy track and the numbers from the
// brief. No live text generation. Used when there is no API key, when the AI
// writer fails, and for local runs.
import { assembleGuide, type Guide } from "./assemble";
import type { Brief } from "./brief";
import { composeDoc, defaultTiles, sectionTitle, type Written } from "./compose";
import type { GuideDoc } from "@/lib/guide/doc";
import type { LeadRow } from "../leads";
import { guideInput } from "./input";

/** Which assembled block sections feed each guide section. */
const MAP: Record<"buyer" | "clipper", Record<string, string[]>> = {
  buyer: {
    what_it_does: ["what_is_clipping", "what_it_does"],
    playbook: ["what_to_give"],
    where_to_post: ["where_to_post"],
    how_it_runs: ["how_it_runs", "what_counts"],
    numbers: ["pricing"],
    first_month: ["timeline"],
    mistakes: ["mistakes"],
    proof: ["proof"],
    next_step: ["next_step"],
  },
  clipper: {
    how_it_pays: ["what_is_clipping", "how_it_pays"],
    set_up: ["set_up"],
    a_day: ["workflow"],
    what_travels: ["what_travels"],
    rules: ["rules"],
    first_month: ["getting_better"],
    your_niche: ["your_niche"],
    proof: ["proof"],
    next_step: ["next_step"],
  },
};

export function rulesWritten(brief: Brief, assembled: Guide): Written {
  const map = MAP[brief.side];
  const sections: Written["sections"] = [];
  for (const [key, from] of Object.entries(map)) {
    const parts = from.map((k) => assembled.sections.find((s) => s.key === k)).filter((s): s is NonNullable<typeof s> => Boolean(s));
    if (!parts.length) continue;
    sections.push({ key, title: sectionTitle(key, brief), paragraphs: [], html: parts.map((p) => p.html).join("\n") });
  }
  // The strategy section: the track's own words carry it; the lead is its promise.
  if (brief.track) {
    sections.push({
      key: "your_strategy",
      title: sectionTitle("your_strategy", brief),
      lead: brief.track.promise,
      paragraphs: [brief.monthly.principle],
    });
  }
  sections.push({ key: "what_to_prepare", title: sectionTitle("what_to_prepare", brief), paragraphs: [] });
  const summary = [assembled.intro, ...(brief.track ? [brief.track.promise] : []), brief.monthly.oneOff];
  return {
    hero: { headline: assembled.title, sub: "", tiles: defaultTiles(brief) },
    summary,
    sections,
    proofIntro: brief.proof[0]?.text ?? "",
  };
}

export function rulesGuide(lead: LeadRow, brief: Brief): GuideDoc {
  const assembled = assembleGuide(guideInput(lead));
  return composeDoc(brief, rulesWritten(brief, assembled), { writer: "rules", model: null });
}
