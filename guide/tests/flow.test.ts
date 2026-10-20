import { describe, expect, it } from "vitest";
import { cleanAnswer, cleanPhone, phoneMode, qualify, resumeStep, stepsFor, frontLoaded, isOptin, roleForPromo, stageOf } from "@/lib/flow";

const t = { qualifyMin: 3000, priorityMin: 10000 };
const questionCount = (answers: Record<string, unknown>) =>
  stepsFor("full", answers).filter((s) => s.scene === "question").length;

describe("flow", () => {
  it("asks clippers 9 questions and creators and brands 12, or 13 when an action is needed", () => {
    expect(questionCount({ role: "clipper" })).toBe(9);
    // Until the objective is answered the action step stays in the plan.
    expect(questionCount({ role: "creator" })).toBe(13);
    expect(questionCount({ role: "creator", objective: "visibility" })).toBe(12);
    expect(questionCount({ role: "brand", objective: "conversions" })).toBe(13);
    expect(questionCount({ role: "brand", objective: "both" })).toBe(13);
  });

  it("orders scenes as the spec says", () => {
    expect(stepsFor("full", { role: "creator", objective: "visibility" }).map((s) => s.id)).toEqual([
      "cold_open", "q_role", "chapter1", "q_project", "q_asset", "q_objective", "q_market", "q_audience", "chapter2",
      "q_library", "q_reach", "q_platforms", "q_timing", "q_budget", "q_deciding", "chapter3", "gate", "building", "result",
    ]);
    expect(stepsFor("full", { role: "clipper" }).map((s) => s.id)).toEqual([
      "cold_open", "q_role", "chapter1", "q_asset", "q_accounts", "chapter2", "q_hours", "q_tools", "q_platforms",
      "q_goal", "q_timing", "q_first_niche", "chapter3", "gate", "building", "result",
    ]);
    expect(stepsFor("plain", {}).map((s) => s.scene)).toEqual(["film", "gate", "building", "result"]);
  });

  it("asks for the action only when the objective needs one", () => {
    const ids = (a: Record<string, unknown>) => stepsFor("full", a).map((s) => s.id);
    expect(ids({ role: "brand", objective: "conversions" })).toContain("q_action");
    expect(ids({ role: "brand", objective: "both" })).toContain("q_action");
    expect(ids({ role: "brand", objective: "visibility" })).not.toContain("q_action");
  });

  it("resumes at the saved scene but never past an unanswered question", () => {
    expect(resumeStep("full", { role: "brand", project: "a launch", asset: "music_release" }, "q_objective", false)).toBe("q_objective");
    expect(resumeStep("full", { role: "brand" }, "chapter2", false)).toBe("q_project");
    expect(resumeStep("full", {}, null, false)).toBe("cold_open");
    expect(resumeStep("full", { role: "clipper" }, "result", false)).toBe("q_asset");
    expect(resumeStep("full", { role: "clipper" }, "q_role", true)).toBe("result");
  });

  it("treats a skipped optional typed answer as answered", () => {
    const all = { role: "clipper", asset: "music", accounts: "none", hours: "5_10", tools: "phone", platforms: ["tiktok"], goal: "side_income", timing: "new" };
    expect(resumeStep("full", all, "building", false)).toBe("q_first_niche");
    expect(resumeStep("full", { ...all, first_niche: "" }, "building", false)).toBe("gate");
  });

  it("is front loaded", () => {
    expect(frontLoaded(0.25)).toBeGreaterThan(0.25);
    expect(frontLoaded(1)).toBe(1);
  });
});

describe("qualification", () => {
  it("never qualifies clippers", () => {
    expect(qualify({ role: "clipper", budget: { band: "50k_plus" } }, t)).toEqual({ qualified: false, humanPriority: false });
  });
  it("qualifies buyers at $3K and up", () => {
    expect(qualify({ role: "creator", budget: { band: "under_3k" } }, t).qualified).toBe(false);
    expect(qualify({ role: "creator", budget: { band: "3k_10k" } }, t)).toEqual({ qualified: true, humanPriority: false });
    expect(qualify({ role: "brand", budget: { band: "10k_50k" } }, t)).toEqual({ qualified: true, humanPriority: true });
  });
  it("uses the number field when not sure", () => {
    expect(qualify({ role: "brand", budget: { band: "not_sure" } }, t).qualified).toBe(false);
    expect(qualify({ role: "brand", budget: { band: "not_sure", amount: 2999 } }, t).qualified).toBe(false);
    expect(qualify({ role: "brand", budget: { band: "not_sure", amount: 3000 } }, t).qualified).toBe(true);
    expect(qualify({ role: "brand", budget: { band: "not_sure", amount: 12000 } }, t).humanPriority).toBe(true);
  });
  it("flags company deciders as human priority", () => {
    expect(qualify({ role: "creator", budget: { band: "under_3k" }, deciding: "yes" }, t)).toEqual({ qualified: false, humanPriority: true });
  });
  it("reads thresholds from config", () => {
    expect(qualify({ role: "creator", budget: { band: "3k_10k" } }, { qualifyMin: 5000, priorityMin: 10000 }).qualified).toBe(false);
  });
});

describe("answer cleaning", () => {
  it("rejects values outside the content", () => {
    expect(cleanAnswer("role", undefined, "admin")).toBeNull();
    expect(cleanAnswer("asset", "clipper", "music_release")).toBeNull();
    expect(cleanAnswer("asset", "clipper", "music")).toBe("music");
    expect(cleanAnswer("platforms", "creator", ["tiktok", "myspace", "tiktok"])).toEqual(["tiktok"]);
    expect(cleanAnswer("budget", "brand", { band: "not_sure", amount: 4200.4 })).toEqual({ band: "not_sure", amount: 4200 });
    expect(cleanAnswer("budget", "brand", { band: "3k_10k", amount: 99 })).toEqual({ band: "3k_10k", amount: null });
  });

  it("cleans typed answers and keeps them short", () => {
    expect(cleanAnswer("project", "creator", "  my next <b>single</b>\u0007  ")).toBe("my next b single /b");
    expect(cleanAnswer("project", "creator", "x".repeat(200))).toHaveLength(80);
    expect(cleanAnswer("project", "creator", "")).toBeNull();
    expect(cleanAnswer("project", "creator", 42)).toBeNull();
    expect(cleanAnswer("first_niche", "clipper", "")).toBe("");
    expect(cleanAnswer("market", "creator", "Nigeria")).toEqual(["Nigeria"]);
    expect(cleanAnswer("market", "creator", ["Nigeria", " ghana ", "Nigeria", ""])).toEqual(["Nigeria", "ghana"]);
    expect(cleanAnswer("market", "creator", ["Nigeria", "global"])).toEqual(["Global"]);
    expect(cleanAnswer("market", "creator", [])).toBeNull();
    expect(cleanAnswer("market", "creator", ["a", "b", "c", "d", "e", "f", "g"])).toHaveLength(6);
  });
});

describe("phone at the gate", () => {
  it("is required for creators and brands, never for clippers", () => {
    expect(phoneMode({ role: "creator", budget: { band: "3k_10k" } })).toBe("required");
    expect(phoneMode({ role: "brand", budget: { band: "under_3k" } })).toBe("required");
    expect(phoneMode({ role: "creator" })).toBe("required");
    expect(phoneMode({ role: "clipper" })).toBe("none");
    expect(phoneMode({})).toBe("none");
  });
  it("keeps digits and the country code, rejects junk", () => {
    expect(cleanPhone("+32 470 12 34 56")).toBe("+32470123456");
    expect(cleanPhone("0032 (0)470-12.34.56")).toBe("+320470123456");
    expect(cleanPhone("0470123456")).toBe("0470123456");
    expect(cleanPhone("12345")).toBe("");
    expect(cleanPhone("call me")).toBe("");
    expect(cleanPhone(42)).toBe("");
  });
});

describe("opt-in page", () => {
  const base = { role: "brand", promo: "brand_product", audience_size: "10k_50k", revenue: "10k_50k", team: "2_5", decider: "team", heard: "just_now" };
  it("maps each promo option to a path", () => {
    expect(roleForPromo("music_indie")).toBe("creator");
    expect(roleForPromo("music_label")).toBe("brand");
    expect(roleForPromo("nope")).toBeUndefined();
  });
  it("puts the stage at the floor of the average score", () => {
    expect(stageOf(base)).toEqual({ n: 2, name: "Growing" });
    expect(stageOf({ ...base, audience_size: "1m_plus", revenue: "250k_plus", team: "51_plus" })).toEqual({ n: 5, name: "Leading" });
    expect(stageOf({ ...base, audience_size: "under_1k", revenue: "none", team: "solo" })).toEqual({ n: 0, name: "Starting" });
    expect(stageOf({ role: "brand" })).toBeNull();
  });
  it("qualifies at the opt-in line from its own budget bands", () => {
    const t = { qualifyMin: 10000, priorityMin: 10000 };
    expect(qualify({ ...base, budget_v2: "10k_25k" }, t).qualified).toBe(true);
    expect(qualify({ ...base, budget_v2: "3k_10k" }, t).qualified).toBe(false);
    expect(qualify({ ...base, budget_v2: "100k_plus" }, t).humanPriority).toBe(true);
    expect(isOptin(base)).toBe(true);
    expect(isOptin({ role: "brand" })).toBe(false);
  });
});
