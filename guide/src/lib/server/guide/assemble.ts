import "server-only";
// Rule based guide assembly (section 6.1). Blocks are markdown files in
// content/guide with front matter saying when they apply. No live text
// generation: the same answers always give the same guide.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import matter from "gray-matter";
import { marked } from "marked";
import outline from "../../../../content/guide/outline.json";
import platformsJson from "../../../../content/guide/platforms.json";
import { fill, proofForAsset, resultText, type Path, type ProofItem } from "@/lib/content";
import type { Answers } from "@/lib/flow";

type Filter = {
  section: string;
  paths?: string[];
  assets?: string[];
  goals?: string[];
  timings?: string[];
  platforms?: string[];
  deciding?: string[];
  qualified?: boolean;
  title?: string;
  order?: number;
};
type Block = Filter & { id: string; body: string };

const DIR = path.join(process.cwd(), "content", "guide");

let cache: { blocks: Block[]; version: string } | null = null;
function load() {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".md")).sort();
  const hash = crypto.createHash("sha256");
  const blocks = files.map((f) => {
    const raw = fs.readFileSync(path.join(DIR, f), "utf8");
    hash.update(f).update(raw);
    const { data, content } = matter(raw);
    return { ...(data as Filter), id: f.replace(/\.md$/, ""), body: content.trim() };
  });
  hash.update(JSON.stringify(outline)).update(JSON.stringify(platformsJson));
  cache = { blocks, version: `${outline.version}+${hash.digest("hex").slice(0, 8)}` };
  return cache;
}

export const manifestVersion = () => load().version;

export type GuideInput = {
  path: Path;
  answers: Answers;
  qualified: boolean;
  firstName: string;
  bookingUrl: string;
  joinUrl: string;
};

const has = (list: string[] | undefined, v: unknown) =>
  !list || (Array.isArray(v) ? v.some((x) => list.includes(String(x))) : list.includes(String(v)));

function applies(b: Block, g: GuideInput): boolean {
  const a = g.answers;
  return (
    has(b.paths, g.path) &&
    has(b.assets, a.asset) &&
    has(b.goals, a.goal) &&
    has(b.timings, a.timing) &&
    has(b.platforms, a.platforms) &&
    has(b.deciding, a.deciding) &&
    (b.qualified === undefined || b.qualified === g.qualified)
  );
}

export type PlatformLine = { key: string; name: string; text: string };

/** Deterministic order from the goal weights, limited to what the lead picked. */
export function platformOrder(answers: Answers, side: "buyer" | "clipper"): PlatformLine[] {
  const picked = Array.isArray(answers.platforms) ? (answers.platforms as string[]) : [];
  const list = picked.length ? picked : platformsJson.order;
  const weights = (platformsJson.weights as Record<string, Record<string, number>>)[String(answers.goal)] ?? {};
  const base = platformsJson.order;
  const info = platformsJson.platforms as Record<string, { name: string; buyer: string; clipper: string }>;
  return [...list]
    .filter((k) => info[k])
    .sort((x, y) => (weights[y] ?? 0) - (weights[x] ?? 0) || base.indexOf(x) - base.indexOf(y))
    .map((k) => ({ key: k, name: info[k].name, text: info[k][side] }));
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export type GuideSection = {
  key: string;
  title: string;
  html: string;
  platforms?: { lead: string; items: PlatformLine[] };
  proof?: ProofItem[];
};

export type Guide = {
  title: string;
  intro: string;
  preparedFor: string;
  footer: string;
  sections: GuideSection[];
  version: string;
};

function renderMarkdown(body: string, tokens: Record<string, string>): string {
  // A link whose target is empty (no booking or join URL configured) is dropped.
  const withLinks = body.replace(/^\[([^\]]+)\]\(\{(\w+)\}\)\s*$/gm, (line, _label, key: string) => (tokens[key] ? line : ""));
  const text = fill(withLinks, tokens);
  return marked.parse(text, { async: false, gfm: true }) as string;
}

export function assembleGuide(g: GuideInput): Guide {
  const { blocks, version } = load();
  const side = g.path === "clipper" ? "clipper" : "buyer";
  const asset = typeof g.answers.asset === "string" ? g.answers.asset : undefined;
  const platforms = platformOrder(g.answers, side);
  const tokens: Record<string, string> = {
    firstName: g.firstName,
    bookingUrl: g.bookingUrl,
    joinUrl: g.joinUrl,
    platformNames: joinNames(platforms.map((p) => p.name)),
  };

  const sections: GuideSection[] = [];
  for (const s of outline[side]) {
    const matched = blocks.filter((b) => b.section === s.key && applies(b, g)).sort((x, y) => (x.order ?? 9) - (y.order ?? 9));
    if (!matched.length) continue;
    const title = matched.find((b) => b.title)?.title ?? "";
    const html = matched.map((b) => renderMarkdown(b.body, tokens)).join("\n");
    const section: GuideSection = { key: s.key, title, html };
    if ("generated" in s && s.generated === "platforms" && platforms.length) {
      const lead = platforms.length === 1 ? platformsJson.lead.buyerOne : platformsJson.lead[side];
      section.platforms = { lead: fill(lead, { first: platforms[0].name }), items: platforms };
    }
    if ("generated" in s && s.generated === "proof") section.proof = proofForAsset(asset);
    sections.push(section);
  }

  const result = resultText(g.path, asset);
  return {
    title: result.headline,
    intro: result.body,
    preparedFor: fill(outline.cover.preparedFor, { firstName: g.firstName }),
    footer: outline.cover.footer,
    sections,
    version,
  };
}

export const guideLabels = outline.labels;
