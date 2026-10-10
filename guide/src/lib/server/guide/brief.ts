import "server-only";
// Everything the writers know about one lead, as plain facts: the answers as
// labels, the strategy track in the owner's words with the lead's tokens
// filled in, the numbers model, the matched proof and the next step.
import { fill, proofForAsset, questionFor, strategy, textAnswer as text, type Objective, type Path, type ProofItem } from "@/lib/content";
import { budgetOf, pathOf, type Answers } from "@/lib/flow";
import type { GuideStep } from "@/lib/guide/doc";
import { numbersFor, type Numbers } from "@/lib/guide/model";
import { config } from "../config";
import { bookingUrl } from "../email";
import type { LeadRow } from "../leads";
import { offersCall } from "../leadview";
import { platformOrder, type PlatformLine } from "./assemble";

export type Fact = { id: string; question: string; answer: string };

export type Track = { key: Objective; name: string; promise: string; steps: GuideStep[] };

export type Brief = {
  path: Path;
  side: "buyer" | "clipper";
  firstName: string;
  objective: Objective | null;
  project: string | null;
  market: string | null;
  audience: string | null;
  /** The action as a verb phrase ("sign up"), for sentences. */
  action: string | null;
  firstNiche: string | null;
  facts: Fact[];
  track: Track | null;
  monthly: typeof strategy.monthly;
  terms: { conversionEditors: string; conversionSkill: string };
  numbers: Numbers;
  platforms: PlatformLine[];
  proof: ProofItem[];
  offersCall: boolean;
  bookingUrl: string;
  joinUrl: string;
  tokens: Record<string, string>;
};

/** Verb phrases for the action answers, used inside sentences. */
const ACTION_VERBS: Record<string, string> = {
  buy: "buy",
  signup: "sign up",
  stream: "stream it",
  follow: "follow",
  book: "book or enquire",
};

const label = (id: string, path: Path, value: unknown): string | null => {
  const v = questionFor(id, path);
  if (!v) return null;
  if (Array.isArray(value)) {
    const names = value.map((x) => v.options.find((o) => o.value === x)?.label).filter(Boolean);
    return names.length ? names.join(", ") : null;
  }
  if (typeof value === "string") return v.options.find((o) => o.value === value)?.label ?? null;
  return null;
};

const textAnswer = (a: Answers, id: string): string | null => text(a, id) || null;

const GLOBAL = "Global";

/** "Nigeria", "Nigeria and Ghana", "Nigeria, Ghana and France", or "Global". */
export function marketLabel(value: unknown): string | null {
  const list = Array.isArray(value) ? value.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : typeof value === "string" && value.trim() ? [value.trim()] : [];
  if (!list.length) return null;
  if (list.some((x) => x.toLowerCase() === GLOBAL.toLowerCase())) return GLOBAL;
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export function briefFor(lead: LeadRow): Brief {
  const c = config();
  const a: Answers = lead.answers;
  const path = (pathOf(a) ?? lead.path) as Path;
  const side = path === "clipper" ? "clipper" : "buyer";
  const objective = side === "buyer" && (a.objective === "visibility" || a.objective === "conversions" || a.objective === "both") ? a.objective : null;
  const project = side === "buyer" ? textAnswer(a, "project") : null;
  const market = side === "buyer" ? marketLabel(a.market) : null;
  const global = market === GLOBAL;
  const audience = side === "buyer" ? textAnswer(a, "audience") : null;
  const actionValue = typeof a.action === "string" ? a.action : null;
  const action = objective && objective !== "visibility" && actionValue ? (ACTION_VERBS[actionValue] ?? "take the action") : null;
  const firstNiche = side === "clipper" ? textAnswer(a, "first_niche") : null;

  const facts: Fact[] = [];
  const ids = side === "buyer"
    ? ["asset", "objective", "action", "library", "reach", "platforms", "timing", "budget", "deciding"]
    : ["asset", "accounts", "hours", "tools", "platforms", "goal", "timing"];
  for (const id of ids) {
    const v = questionFor(id, path);
    if (!v) continue;
    let answer: string | null;
    if (id === "budget") {
      const b = budgetOf(a);
      answer = b ? (b.band === "not_sure" && b.amount ? `About $${b.amount.toLocaleString("en-US")} a month` : label(id, path, b.band)) : null;
    } else answer = label(id, path, a[id]);
    if (answer) facts.push({ id, question: v.prompt, answer });
  }
  if (project) facts.unshift({ id: "project", question: "What they are putting out", answer: project });
  if (market) facts.push({ id: "market", question: global ? "Target market" : "Target countries", answer: global ? "Worldwide" : market });
  if (audience) facts.push({ id: "audience", question: "Target audience", answer: audience });
  if (firstNiche) facts.push({ id: "first_niche", question: "Something they already watch a lot of", answer: firstNiche });

  const terms = { conversionEditors: strategy.terms.conversionEditors, conversionSkill: strategy.terms.conversionSkill };
  const tokens: Record<string, string> = {
    firstName: lead.firstName,
    project: project ?? "your content",
    market: global ? "your markets worldwide" : (market ?? "your market"),
    audience: audience ?? "your audience",
    action: action ?? "take the action",
    conversionEditors: terms.conversionEditors,
    conversionSkill: terms.conversionSkill,
  };
  const track: Track | null = objective
    ? {
        key: objective,
        name: strategy.tracks[objective].name,
        promise: fill(strategy.tracks[objective].promise, tokens),
        steps: strategy.tracks[objective].steps.map((s) => ({ title: fill(s.title, tokens), body: fill(s.body, tokens) })),
      }
    : null;

  const offers = offersCall(lead);
  return {
    path,
    side,
    firstName: lead.firstName,
    objective,
    project,
    market,
    audience,
    action,
    firstNiche,
    facts,
    track,
    monthly: strategy.monthly,
    terms,
    numbers: numbersFor(a, path),
    platforms: platformOrder(a, side),
    proof: proofForAsset(typeof a.asset === "string" ? a.asset : undefined),
    offersCall: offers,
    bookingUrl: offers ? bookingUrl(lead) : "",
    joinUrl: side === "clipper" ? c.whopJoinUrl : "",
    tokens,
  };
}
