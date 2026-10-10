import "server-only";
// The AI writer. One structured call writes the words of a guide for one
// lead; the facts come from the brief and the deterministic parts are
// attached afterwards in compose.ts. The model may only use figures from the
// numbers model and the approved proof; anything else fails the guard, gets
// one retry with the violation named, and then falls back to the rules
// writer in index.ts. The key comes from the owner's separate console.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import proofJson from "../../../../content/proof.json";
import strategyJson from "../../../../content/strategy.json";
import { SECTION_KEYS } from "@/lib/guide/doc";
import { allowedFigures, money } from "@/lib/guide/model";
import { config } from "../config";
import type { Brief } from "./brief";
import { sectionTitle, type Written } from "./compose";

export const EM_DASH = String.fromCharCode(0x2014);

const Section = z.object({
  key: z.string(),
  title: z.string(),
  lead: z.string(),
  paragraphs: z.array(z.string()),
  bullets: z.array(z.string()),
  callout: z.string(),
});

export const WrittenSchema = z.object({
  hero: z.object({
    headline: z.string(),
    sub: z.string(),
    tiles: z.array(z.object({ value: z.string(), label: z.string() })),
  }),
  summary: z.array(z.string()),
  sections: z.array(Section),
  proofIntro: z.string(),
});
export type WrittenOutput = z.infer<typeof WrittenSchema>;

/** What each section is for. The writer gets these with the lead's facts. */
const GUIDANCE: Record<string, string> = {
  what_it_does: "What clipping does for their project in particular: who ends up seeing it, how, and why that matters for their objective. Two to three paragraphs.",
  your_strategy: "Apply the strategy track to their project, market and audience. The steps of the track are shown below your text, so do not repeat them as a list. Explain what the reader must do first in their situation and what to look for. Two to three paragraphs.",
  playbook: "Which moments to cut from the kind of content they have, given how much content they have today. Specific to the asset type. Two paragraphs plus four to six bullets of concrete clip ideas.",
  where_to_post: "Why the platforms they picked fit their audience and objective, in the order given. The platform list is shown below your text. One or two paragraphs.",
  how_it_runs: "How a campaign runs, week by week: brief, rate per 1,000 counted views, review, dashboard, what counts and what does not. Two to three paragraphs.",
  numbers: "What the numbers model says for their budget, in plain words. The tiles and the slider are shown below your text. Explain the three rates and why they differ. Two paragraphs. Use only the figures given.",
  first_month: "Their first month, week by week, for their objective and timing. Then why month two is cheaper per result (compounding). Two paragraphs plus four bullets, one per week.",
  what_to_prepare: "What they need to have ready before day one, specific to their asset and how much content they have. One short paragraph plus four to six bullets.",
  mistakes: "The mistakes people in their position make, and how to avoid each. One paragraph plus four to five bullets.",
  proof: "One or two paragraphs tying the matched case studies to their situation. Use only the proof given. No hype.",
  next_step: "What to do next, in one or two short paragraphs. The button is shown below your text, so describe the step, not the link.",
  how_it_pays: "How clipping pays, for someone with their hours and experience. The pay tiles and the slider are shown below your text. Two to three paragraphs. Use only the figures given. Never promise an income.",
  set_up: "Setting up their accounts and tools from where they are today. Two paragraphs plus four to six bullets.",
  a_day: "A day of clipping at their hours: finding the moment, cutting, captioning, posting, logging. Two to three paragraphs.",
  what_travels: "Why the platforms they picked fit, in the order given. The list is shown below your text. One or two paragraphs.",
  rules: "The rules of a campaign: brief, review, what does not count, what gets a clipper removed. One paragraph plus four to six bullets.",
  your_niche: "Their niche, and the thing they already watch a lot of if they named one: why it is a good place to start and what to look for in it. Two paragraphs.",
};

function systemPrompt(): string {
  const proof = (Object.values(proofJson.items) as { status: string; title?: string; text: string }[])
    .filter((p) => p.status === "approved")
    .map((p) => `- ${p.title ? `${p.title}: ` : ""}${p.text}`)
    .join("\n");
  const s = strategyJson;
  return [
    "You write personal guides for Maison d'Élites, a clipping network: creators, brands and labels pay clippers per 1,000 counted views to post short clips of their content, and clippers earn from those views.",
    "The reader answered a short questionnaire. You write their guide: what clipping would do for them, what they must do, in what order, and what the numbers look like. It is a real guide, not a sales page. The reader should feel understood. The proof speaks for itself; never pitch, never say 'we' or 'our team', never mention Maison d'Élites by name in the body.",
    "",
    "Rules, all of them hard:",
    "1. Second person, plain words, short sentences. No jargon, no hype, no exclamation marks.",
    "2. Never use an em dash (the long dash character). Use a comma, a colon or a full stop instead.",
    "3. Never name a person, except the artists and shows named in the proof list below, and only when quoting that proof.",
    "4. Use only the figures listed under ALLOWED FIGURES for this reader, and the figures in the proof list. No other number with a $ sign or a K, M or B suffix, ever. Small whole numbers (one to twelve, week numbers, the four steps) are fine.",
    "5. Never promise an income or a result. Say 'at the rate those campaigns ran at', 'if', 'could', 'counted views'.",
    "6. The four steps of a campaign are always: brief, clips, review, counted views paid per 1,000.",
    "7. Everything runs monthly and compounds. One-off campaigns are possible, but the longer it runs the better it gets. This is the main theme.",
    `8. The strategy has exactly three tracks, in the owner's words. Visibility: ${s.tracks.visibility.promise.replace(/\{\w+\}/g, "their")} Conversions: a small set of highly trained editors called ${s.terms.conversionEditors} who understand ${s.terms.conversionSkill}, posting from profiles built as a funnel, on pages the reader owns so everything is tracked. Both: the wide layer feeds the narrow layer. Never invent a fourth track.`,
    "9. Write every section listed in the request, with the given key, in the given order. Keep titles short (two to six words). A lead is one sentence. A callout is one or two sentences, or an empty string. Bullets are full sentences without a trailing full stop.",
    "10. Hero tiles: exactly three, each value copied verbatim from ALLOWED FIGURES, each label under ten words saying what the value is.",
    "11. The summary is exactly three short paragraphs: where they are, what their objective needs, what their answers mean for the plan.",
    "",
    "Monthly principle: " + s.monthly.principle,
    "One-off: " + s.monthly.oneOff,
    "Compounding: " + s.monthly.compounding.join(" "),
    "",
    "APPROVED PROOF (the only results you may cite):",
    proof,
  ].join("\n");
}

function userPrompt(brief: Brief, violations: string[] = []): string {
  const keys = SECTION_KEYS[brief.side];
  const figures = allowedFigures(brief.numbers);
  const lines: string[] = [];
  lines.push(`READER: a ${brief.path}${brief.firstName ? ` (first name ${brief.firstName}, use it at most once)` : ""}.`);
  lines.push("", "ANSWERS:");
  for (const f of brief.facts) lines.push(`- ${f.question} ${f.answer}`);
  if (brief.track) {
    lines.push("", `STRATEGY TRACK: ${brief.track.name}. ${brief.track.promise}`, "Steps (shown as a timeline under your text in your_strategy):");
    for (const st of brief.track.steps) lines.push(`- ${st.title}: ${st.body}`);
  } else if (brief.side === "clipper") {
    lines.push("", `CAMPAIGN TYPES: ${strategyJson.clipperNote.visibilityCampaigns} ${strategyJson.clipperNote.conversionCampaigns}`);
  }
  lines.push("", "PLATFORMS, in order:");
  for (const p of brief.platforms) lines.push(`- ${p.name}: ${p.text}`);
  lines.push("", "NUMBERS MODEL:");
  const n = brief.numbers;
  if (n.kind === "buyer") {
    lines.push(
      `- Monthly budget used: ${money(n.monthlyBudget)}${n.budgetKnown ? "" : " (assumed, they did not give one)"}`,
      `- Counted views for one month at the three case study rates: low rate $0.48 per 1,000 gives ${n.views.low.toLocaleString("en-US")}, mid rate $1.78 gives ${n.views.mid.toLocaleString("en-US")}, high rate $2.30 gives ${n.views.high.toLocaleString("en-US")}.`,
      n.currentPost ? `- Their current good post: about ${n.currentPost.toLocaleString("en-US")} views. One month at the mid rate is ${n.timesCurrentPost}x that.` : "",
      `- Three months at the mid rate with earlier months still counting: ${n.months.map((m) => `month ${m.month} ${m.total.toLocaleString("en-US")}`).join(", ")}.`,
    );
  } else {
    lines.push(
      `- Rate: $${n.rate.toFixed(2)} per 1,000 counted views.`,
      `- Per clip: ${n.perClip.map((c) => `${c.views.toLocaleString("en-US")} views pays ${money(c.pay)}`).join(", ")}.`,
      `- At their hours, about ${n.clipsPerWeek} clips a week. If the average clip reaches ${n.monthly.map((m) => `${m.avgViews.toLocaleString("en-US")} views, a month pays ${money(m.pay)}`).join("; if ")}.`,
    );
  }
  lines.push("", `ALLOWED FIGURES: ${figures.join(", ")}`);
  lines.push("", "PROOF MATCHED TO THIS READER (shown as a panel under your proof text):");
  for (const p of brief.proof) lines.push(`- ${p.title ? `${p.title}: ` : ""}${p.text}`);
  lines.push("", `NEXT STEP: ${brief.side === "clipper" ? "join the clipper network (a button follows your text)" : brief.offersCall ? "pick a time for a call to go through the plan (a button follows your text)" : "reply to the email with a rough monthly budget to get the numbers for it"}.`);
  lines.push("", "SECTIONS, in this order, with these keys:");
  for (const k of keys) lines.push(`- ${k} (suggested title "${sectionTitle(k, brief)}"): ${GUIDANCE[k] ?? ""}`);
  if (violations.length) {
    lines.push("", "YOUR PREVIOUS DRAFT BROKE THESE RULES. Write it again without them:", ...violations.map((v) => `- ${v}`));
  }
  return lines.filter((l) => l !== undefined).join("\n");
}

const FIGURE = /(\$\d[\d.,]*\d[KMB]?\+?|\$\d[KMB]?\+?|\b\d[\d.,]*[KMB]\+?(?=[\s<.,;:)]|$))/g;

/** Checks a draft against the hard rules. Returns the violations, empty when clean. */
export function checkWritten(w: WrittenOutput, brief: Brief): string[] {
  const out: string[] = [];
  const allowed = new Set<string>([
    ...allowedFigures(brief.numbers),
    ...((Object.values(proofJson.items) as { status: string }[]).filter((p) => p.status === "approved").flatMap((p) => JSON.stringify(p).match(FIGURE) ?? [])),
  ]);
  const text = JSON.stringify(w);
  const bad = [...new Set(text.match(FIGURE) ?? [])].filter((f) => !allowed.has(f));
  if (bad.length) out.push(`Figures not in the allowed list: ${bad.join(", ")}. Use only the ALLOWED FIGURES and the proof figures.`);
  if (text.includes(EM_DASH)) out.push("An em dash was used. Replace every em dash with a comma, colon or full stop.");
  const keys = SECTION_KEYS[brief.side];
  const got = w.sections.map((s) => s.key);
  const missing = keys.filter((k) => !got.includes(k));
  if (missing.length) out.push(`Missing sections: ${missing.join(", ")}. Write every section listed.`);
  if (w.hero.tiles.length !== 3) out.push("The hero needs exactly three tiles.");
  for (const t of w.hero.tiles) if (!allowed.has(t.value.trim())) out.push(`Tile value "${t.value}" is not in ALLOWED FIGURES.`);
  if (w.summary.length !== 3) out.push("The summary needs exactly three paragraphs.");
  if (/\bwe\b|\bour\b/i.test([...w.summary, ...w.sections.flatMap((s) => s.paragraphs)].join(" "))) out.push("Do not say 'we' or 'our'. Write to the reader about what they must do.");
  return out;
}

const stripDashes = (s: string) => s.replace(new RegExp(EM_DASH, "g"), ", ").replace(/ ,/g, ",").replace(/, ,/g, ",");

/** The parsed output as what compose expects, with the empty strings dropped. */
export function toWritten(w: WrittenOutput): Written {
  return {
    hero: { headline: stripDashes(w.hero.headline), sub: stripDashes(w.hero.sub), tiles: w.hero.tiles.map((t) => ({ value: t.value.trim(), label: stripDashes(t.label) })) },
    summary: w.summary.map(stripDashes),
    sections: w.sections.map((s) => ({
      key: s.key,
      title: stripDashes(s.title),
      lead: s.lead ? stripDashes(s.lead) : undefined,
      paragraphs: s.paragraphs.map(stripDashes).filter(Boolean),
      bullets: s.bullets.length ? s.bullets.map(stripDashes) : undefined,
      callout: s.callout ? { text: stripDashes(s.callout) } : undefined,
    })),
    proofIntro: stripDashes(w.proofIntro),
  };
}

export type WriteResult = { written: Written; model: string; usage: { input: number; output: number } };

export async function writeWithAi(brief: Brief): Promise<WriteResult> {
  const c = config();
  if (!c.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({
    apiKey: c.anthropicApiKey,
    maxRetries: 2,
    timeout: 120_000,
    ...(c.anthropicWorkspaceId ? { defaultHeaders: { "anthropic-workspace-id": c.anthropicWorkspaceId } } : {}),
  });
  let violations: string[] = [];
  let last: WrittenOutput | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.beta.messages.parse({
      model: c.guideWriterModel,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: zodOutputFormat(WrittenSchema) },
      system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt(brief, violations) }],
    });
    const parsed = res.parsed_output;
    if (!parsed) throw new Error(`writer returned no parsed output (stop_reason ${res.stop_reason})`);
    last = parsed;
    violations = checkWritten(parsed, brief);
    if (!violations.length) {
      return { written: toWritten(parsed), model: res.model, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens } };
    }
    console.warn(`guide writer draft ${attempt + 1} rejected:`, violations.join(" | "));
  }
  throw new Error(`writer draft rejected twice: ${violations.join(" | ")}${last ? "" : ""}`);
}
