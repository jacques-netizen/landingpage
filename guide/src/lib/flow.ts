// Scene flow and qualification. Pure functions, shared by client and server.
import { flow, getQuestion, questionFor, type Path, type Step, type Variant } from "./content";

export type Answers = Record<string, unknown>;

export type Thresholds = { qualifyMin: number; priorityMin: number };

export function pathOf(answers: Answers): Path | undefined {
  const r = answers.role;
  return r === "clipper" || r === "creator" || r === "brand" ? r : undefined;
}

/** Steps for a variant, filtered to the chosen path. Before Q1 every step shows. */
export function stepsFor(variant: Variant, answers: Answers): Step[] {
  const path = pathOf(answers);
  return flow[variant].filter((s) => !s.paths || !path || s.paths.includes(path));
}

export function isAnswered(questionId: string, answers: Answers): boolean {
  const v = answers[questionId];
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return typeof (v as { band?: unknown }).band === "string";
  return typeof v === "string" && v.length > 0;
}

/**
 * Where a returning visitor lands. Goes to the saved scene when it still exists
 * in their flow, but never past the first unanswered question before it.
 */
export function resumeStep(variant: Variant, answers: Answers, lastScene: string | null, hasLead: boolean): string {
  const steps = stepsFor(variant, answers);
  if (hasLead) return "result";
  const lastIdx = lastScene ? steps.findIndex((s) => s.id === lastScene) : -1;
  // Building and result need a lead. Without one, send them back to the gate.
  const cap = steps.findIndex((s) => s.scene === "building");
  let target = lastIdx < 0 ? 0 : cap >= 0 && lastIdx >= cap ? cap - 1 : lastIdx;
  const firstOpen = steps.findIndex((s) => s.scene === "question" && s.question && !isAnswered(s.question, answers));
  if (firstOpen >= 0 && firstOpen < target) target = firstOpen;
  return steps[Math.max(0, target)].id;
}

/** Budget answer is stored as { band, amount? }. */
export type BudgetAnswer = { band: string; amount?: number | null };

export function budgetOf(answers: Answers): BudgetAnswer | undefined {
  const b = answers.budget;
  if (b && typeof b === "object" && typeof (b as BudgetAnswer).band === "string") return b as BudgetAnswer;
  if (typeof b === "string") return { band: b };
  return undefined;
}

/** Lowest dollar amount the budget answer stands for, or null when unknown. */
export function budgetFloor(answers: Answers, path: Path | undefined): number | null {
  const b = budgetOf(answers);
  if (!b) return null;
  const opt = questionFor("budget", path)?.options.find((o) => o.value === b.band);
  if (opt && typeof opt.min === "number") return opt.min;
  if (typeof b.amount === "number" && Number.isFinite(b.amount) && b.amount > 0) return b.amount;
  return null;
}

export function qualify(answers: Answers, t: Thresholds): { qualified: boolean; humanPriority: boolean } {
  const path = pathOf(answers);
  const buyer = path === "creator" || path === "brand";
  const floor = budgetFloor(answers, path);
  const qualified = buyer && floor !== null && floor >= t.qualifyMin;
  const humanPriority = buyer && (answers.deciding === "yes" || (floor !== null && floor >= t.priorityMin));
  return { qualified, humanPriority };
}

/** Validates an answer against content. Returns the cleaned value or null. */
export function cleanAnswer(questionId: string, path: Path | undefined, value: unknown): unknown | null {
  const q = getQuestion(questionId);
  const v = questionFor(questionId, path);
  if (!q || !v) return null;
  const allowed = new Set(v.options.map((o) => o.value));
  if (questionId === "budget") {
    const b = typeof value === "string" ? { band: value } : (value as BudgetAnswer | null);
    if (!b || typeof b.band !== "string" || !allowed.has(b.band)) return null;
    const amount = typeof b.amount === "number" && Number.isFinite(b.amount) && b.amount > 0 && b.amount < 1e9 ? Math.round(b.amount) : null;
    return { band: b.band, amount: b.band === "not_sure" ? amount : null };
  }
  if (q.type === "multi") {
    if (!Array.isArray(value)) return null;
    const vals = [...new Set(value.filter((x): x is string => typeof x === "string" && allowed.has(x)))];
    return vals.length ? vals : null;
  }
  return typeof value === "string" && allowed.has(value) ? value : null;
}

/** Index of a step for the progress bar, as a share of question and film steps. */
export function progressShare(variant: Variant, answers: Answers, stepId: string): number {
  const steps = stepsFor(variant, answers).filter((s) => s.scene !== "building" && s.scene !== "result");
  const i = steps.findIndex((s) => s.id === stepId);
  if (i < 0) return 1;
  return steps.length <= 1 ? 1 : i / (steps.length - 1);
}

/** Front loaded curve: moves fast early, slows near the end. */
export function frontLoaded(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return 1 - Math.pow(1 - c, 2.2);
}
