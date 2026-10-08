// Typed access to the content JSON. Everything a visitor reads comes from
// /content, never from components.
import questionsJson from "../../content/questions.json";
import flowJson from "../../content/flow.json";
import copyJson from "../../content/copy.json";
import resultsJson from "../../content/results.json";
import mediaJson from "../../content/media.json";
import proofJson from "../../content/proof.json";

export type Path = "clipper" | "creator" | "brand";
export type Variant = "full" | "plain";
export type ProgressMode = "front_loaded" | "none";

export type Option = { value: string; label: string; min?: number; amountField?: boolean };
export type QuestionVariant = {
  paths: string[];
  prompt: string;
  help?: string;
  options: Option[];
  amountField?: { label: string; help: string; placeholder: string; continue: string; skip: string };
};
export type Question = { id: string; type: "single" | "multi"; variants: QuestionVariant[] };

export type Step = {
  id: string;
  scene: "cold_open" | "question" | "film" | "steps" | "gate" | "building" | "result";
  question?: string;
  media?: string;
  chapter?: string;
  unlockAt?: number;
  paths?: string[];
  roleSelect?: boolean;
};

export type MediaItem = {
  provider: "file" | "mux";
  id: string;
  poster: string | null;
  captions: string | null;
  loop?: boolean;
  placeholder?: boolean;
};

export type ProofItem = {
  status: "approved" | "pending_owner";
  title?: string;
  headline?: string;
  text: string;
  short?: string;
  url?: string;
  poster?: string;
  objective?: string;
  strategy?: string;
  figures?: { value: string; label: string }[];
  logos?: { name: string; src: string }[];
};

export const PATHS = questionsJson.paths as Path[];
export const questions = questionsJson.questions as Question[];
export const flow = flowJson.variants as Record<Variant, Step[]>;
export const copy = copyJson;
export type Copy = typeof copyJson;
export const results = resultsJson;
export const media = mediaJson.items as Record<string, MediaItem>;
const proofItems = proofJson.items as Record<string, ProofItem>;
const proofByAsset = proofJson.byAsset as Record<string, string[]>;

export function getQuestion(id: string): Question | undefined {
  return questions.find((q) => q.id === id);
}

/** The prompt and options of a question for one path. Falls back to "*". */
export function questionFor(id: string, path: Path | undefined): QuestionVariant | undefined {
  const q = getQuestion(id);
  if (!q) return undefined;
  return (
    q.variants.find((v) => path && v.paths.includes(path)) ??
    q.variants.find((v) => v.paths.includes("*")) ??
    q.variants[0]
  );
}

export function optionLabel(id: string, path: Path | undefined, value: string): string | undefined {
  return questionFor(id, path)?.options.find((o) => o.value === value)?.label;
}

/** Approved proof only. Anything pending the owner never leaves this module. */
export function proof(id: string): ProofItem | undefined {
  const item = proofItems[id];
  return item && item.status === "approved" ? item : undefined;
}

export function proofForAsset(asset: string | undefined): ProofItem[] {
  const ids = (asset && proofByAsset[asset]) || ["views_delivered", "clients"];
  const out = ids.map(proof).filter((p): p is ProofItem => Boolean(p));
  return out.length ? out : [proof("views_delivered")!];
}

export function resultText(path: Path | undefined, asset: string | undefined) {
  const group = path === "clipper" ? "clipper" : "buyer";
  const table = results[group] as Record<string, { headline: string; body: string }>;
  return (asset && table[asset]) || results.fallback[group];
}

/** Replace {key} tokens. Unknown keys are left empty. */
export function fill(template: string, values: Record<string, string | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");
}
