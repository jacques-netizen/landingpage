import { describe, expect, it } from "vitest";
import { briefFor } from "@/lib/server/guide/brief";
import { checkWritten, toWritten, WrittenSchema, type WrittenOutput } from "@/lib/server/guide/writer";
import { composeDoc } from "@/lib/server/guide/compose";
import { rulesGuide } from "@/lib/server/guide/rules";
import { guideText, SECTION_KEYS } from "@/lib/guide/doc";
import { sampleLead } from "../scripts/sample-guides";

const EM = String.fromCharCode(0x2014);
process.env.CAL_BOOKING_URL = "https://cal.com/mde/call";

const buyer = sampleLead("t1", {
  path: "brand",
  answers: { role: "brand", project: "a skincare launch", asset: "product_launch", objective: "both", action: "buy", market: "United Kingdom", audience: "women 25 to 40", library: "hours", reach: "10k_100k", platforms: ["instagram_reels", "tiktok"], timing: "two_weeks", budget: { band: "10k_50k" }, deciding: "yes" },
});
const clipper = sampleLead("t2", { path: "clipper", qualified: false, answers: { role: "clipper", asset: "music", accounts: "none", hours: "5_10", tools: "capcut", platforms: ["tiktok"], goal: "side_income", timing: "new", first_niche: "afrobeats" } });

function draft(brief: ReturnType<typeof briefFor>, over: Partial<WrittenOutput> = {}): WrittenOutput {
  const keys = SECTION_KEYS[brief.side];
  return {
    hero: { headline: "Your plan for a skincare launch", sub: "Built from your answers.", tiles: [{ value: "$10,000", label: "a month" }, { value: "5.6M", label: "counted views at the mid rate" }, { value: "$1.78", label: "mid rate per 1,000" }] },
    summary: ["Where you are.", "What the goal needs.", "What your answers mean."],
    sections: keys.map((key) => ({ key, title: key, lead: "", paragraphs: ["One paragraph."], bullets: [], callout: "" })),
    proofIntro: "Walmart ran a campaign like this.",
    ...over,
  };
}

describe("AI writer guard", () => {
  it("accepts a clean draft and rejects unknown figures and em dashes", () => {
    const brief = briefFor(buyer);
    expect(brief.numbers.kind).toBe("buyer");
    expect(checkWritten(draft(brief), brief)).toEqual([]);
    const bad = draft(brief, { summary: ["You will make $45K.", `Two${EM}things.`, "Third."] });
    const v = checkWritten(bad, brief);
    expect(v.some((x) => x.includes("$45K"))).toBe(true);
    expect(v.some((x) => x.includes("em dash"))).toBe(true);
  });

  it("requires every section, three tiles with allowed values, and no 'we'", () => {
    const brief = briefFor(buyer);
    const d = draft(brief);
    d.sections = d.sections.slice(1);
    d.hero.tiles[0].value = "$999";
    d.sections[0].paragraphs = ["We will do this for you."];
    const v = checkWritten(d, brief);
    expect(v.some((x) => x.includes("Missing sections: what_it_does"))).toBe(true);
    expect(v.some((x) => x.includes('"$999"'))).toBe(true);
    expect(v.some((x) => x.includes("'we'"))).toBe(true);
  });

  it("parses the schema and strips stray em dashes before composing", () => {
    const brief = briefFor(buyer);
    const d = WrittenSchema.parse(draft(brief, { proofIntro: `Proof${EM}here` }));
    const doc = composeDoc(brief, toWritten(d), { writer: "ai", model: "test" });
    expect(guideText(doc)).not.toContain(EM);
    expect(doc.sections.map((s) => s.key)).toEqual([...SECTION_KEYS.buyer]);
    expect(doc.sections.find((s) => s.key === "your_strategy")?.steps?.length).toBe(5);
    expect(doc.sections.find((s) => s.key === "numbers")?.numbers).toBe(true);
    expect(doc.sections.find((s) => s.key === "proof")?.proof).toBe(true);
    expect(doc.next.kind).toBe("book");
  });
});

describe("rules writer", () => {
  it("writes a full buyer guide with the strategy track and the numbers", () => {
    const brief = briefFor(buyer);
    const doc = rulesGuide(buyer, brief);
    expect(doc.writer).toBe("rules");
    expect(doc.hero.headline).toBe("Your plan for a skincare launch");
    expect(doc.hero.tiles).toHaveLength(3);
    expect(doc.sections.map((s) => s.key)).toEqual([...SECTION_KEYS.buyer]);
    const strategy = doc.sections.find((s) => s.key === "your_strategy")!;
    expect(strategy.lead).toContain("United Kingdom");
    expect(strategy.steps?.[0].body).toContain("Funnel Clippers");
    expect(guideText(doc)).not.toContain(EM);
    expect(doc.facts.find((f) => f.id === "market")?.answer).toBe("United Kingdom");
  });

  it("writes a clipper guide with pay numbers, the first month and the join step", () => {
    const brief = briefFor(clipper);
    const doc = rulesGuide(clipper, brief);
    expect(doc.sections.map((s) => s.key)).toEqual([...SECTION_KEYS.clipper]);
    expect(doc.numbers.kind).toBe("clipper");
    expect(doc.sections.find((s) => s.key === "first_month")?.steps?.length).toBe(4);
    expect(doc.next.kind).toBe("join");
    expect(doc.facts.find((f) => f.id === "first_niche")?.answer).toBe("afrobeats");
  });
});
