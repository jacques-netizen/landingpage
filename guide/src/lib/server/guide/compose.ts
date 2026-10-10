import "server-only";
// Turns what a writer produced (the words) plus the brief (the facts) into the
// finished GuideDoc. The deterministic parts are attached here, so the AI
// writer and the rules writer cannot drift: strategy steps, platforms, the
// numbers block, the matched proof and the next step.
import outline from "../../../../content/guide/outline.json";
import { fill } from "@/lib/content";
import { SECTION_KEYS, type GuideDoc, type GuideSection, type GuideTile } from "@/lib/guide/doc";
import { money, short, strategyTerms } from "@/lib/guide/model";
import type { Brief } from "./brief";
import { manifestVersion } from "./assemble";
import nextCopy from "../../../../content/email.json";
import strategyJson from "../../../../content/strategy.json";

/** What a writer has to produce. Everything else is attached from the brief. */
export type Written = {
  hero: { headline: string; sub: string; tiles: GuideTile[] };
  summary: string[];
  sections: { key: string; title: string; lead?: string; paragraphs: string[]; bullets?: string[]; callout?: { label?: string; text: string }; html?: string }[];
  proofIntro: string;
};

const titles = outline.sectionTitles as Record<string, string>;

export const sectionTitle = (key: string, brief: Brief) => fill(titles[key] ?? key, brief.tokens);

/** Three tiles from the numbers model, used when the writer does not pick its own. */
export function defaultTiles(brief: Brief): GuideTile[] {
  const n = brief.numbers;
  if (n.kind === "buyer") {
    return [
      { value: short(n.views.mid), label: `counted views a month at ${money(n.monthlyBudget)}, at the mid case study rate` },
      { value: n.timesCurrentPost ? `${n.timesCurrentPost}x` : short(n.perDay.mid), label: n.timesCurrentPost ? "your current good post, every month" : "views a day at the mid rate" },
      { value: short(n.months[2].total), label: "views in month three with earlier months still counting" },
    ];
  }
  return [
    { value: `$${n.rate.toFixed(2)}`, label: "per 1,000 counted views, the rate two approved campaigns paid" },
    { value: money(n.perClip[1].pay), label: "for one clip that reaches 10K views" },
    { value: String(n.clipsPerWeek), label: "clips a week at your hours" },
  ];
}

export function composeDoc(brief: Brief, written: Written, meta: { writer: "ai" | "rules"; model: string | null }): GuideDoc {
  const keys = SECTION_KEYS[brief.side];
  const byKey = new Map(written.sections.map((s) => [s.key, s]));
  const sections: GuideSection[] = [];
  for (const key of keys) {
    const w = byKey.get(key);
    const s: GuideSection = {
      key,
      title: w?.title || sectionTitle(key, brief),
      lead: w?.lead,
      paragraphs: w?.paragraphs ?? [],
      bullets: w?.bullets,
      callout: w?.callout,
      html: w?.html,
    };
    if (key === "your_strategy" && brief.track) {
      s.steps = brief.track.steps;
      s.lead = s.lead || brief.track.promise;
    }
    if (key === "first_month") {
      if (brief.side === "clipper") s.steps = s.steps ?? strategyClipperMonth();
      if (!s.callout) s.callout = { label: "Why month two is cheaper per result", text: brief.monthly.principle };
    }
    if (key === "what_to_prepare" && !s.bullets?.length) s.bullets = strategyPrepare(brief.side);
    if ((key === "where_to_post" || key === "what_travels") && brief.platforms.length) {
      s.platforms = { lead: platformLead(brief), items: brief.platforms };
    }
    if (key === "numbers" || key === "how_it_pays") s.numbers = true;
    if (key === "proof") s.proof = true;
    if (key === "next_step") {
      const n = nextFor(brief);
      if (!s.paragraphs.length && !s.html) s.paragraphs = [n.text];
    }
    if (!s.paragraphs.length && !s.html && !s.steps && !s.bullets && !s.platforms && !s.numbers && !s.proof) continue;
    sections.push(s);
  }

  const hero = {
    kicker: outline.hero.kicker,
    headline: written.hero.headline || fill(brief.side === "buyer" ? outline.hero.buyerHeadline : outline.hero.clipperHeadline, brief.tokens),
    sub: written.hero.sub || outline.hero.sub,
    tiles: written.hero.tiles.length === 3 ? written.hero.tiles : defaultTiles(brief),
  };

  return {
    version: 2,
    writer: meta.writer,
    model: meta.model,
    path: brief.path,
    objective: brief.objective,
    project: brief.project,
    market: brief.market,
    audience: brief.audience,
    action: brief.action,
    firstName: brief.firstName,
    facts: brief.facts,
    hero,
    summary: written.summary,
    sections,
    proofIntro: written.proofIntro,
    proof: brief.proof,
    numbers: brief.numbers,
    next: nextFor(brief),
    preparedFor: fill(outline.cover.preparedFor, { firstName: brief.firstName }),
    footer: outline.cover.footer,
    generatedAt: new Date().toISOString(),
    contentVersion: manifestVersion(),
  };
}

function platformLead(brief: Brief): string {
  const p = brief.platforms;
  // Same lines as the rules blocks, from content/guide/platforms.json through assemble.
  const lead = p.length === 1 ? "Start with {first} and put the whole first wave there." : brief.side === "buyer" ? "Start with {first}. Add the others once the first clips are moving." : "Post on {first} first. Add the others once you know which clips work.";
  return fill(lead, { first: p[0]?.name ?? "" });
}

export function nextFor(brief: Brief): GuideDoc["next"] {
  const e = nextCopy.next;
  if (brief.side === "clipper") return { kind: "join", url: brief.joinUrl, label: e.join.button, text: e.join.text };
  if (brief.offersCall && brief.bookingUrl) return { kind: "book", url: brief.bookingUrl, label: e.book.button, text: e.book.text };
  return { kind: "reply", url: "", label: "", text: e.soft.text };
}

const strategyPrepare = (side: "buyer" | "clipper") => strategyJson.prepare[side];
const strategyClipperMonth = () => strategyJson.clipperFirstMonth.steps;
export const terms = strategyTerms;
