import { describe, expect, it } from "vitest";
import { cleanAnswer, qualify, resumeStep, stepsFor, frontLoaded } from "@/lib/flow";

const t = { qualifyMin: 3000, priorityMin: 10000 };
const questionCount = (answers: Record<string, unknown>) =>
  stepsFor("full", answers).filter((s) => s.scene === "question").length;

describe("flow", () => {
  it("asks clippers 5 questions and creators and brands 7", () => {
    expect(questionCount({ role: "clipper" })).toBe(5);
    expect(questionCount({ role: "creator" })).toBe(7);
    expect(questionCount({ role: "brand" })).toBe(7);
  });

  it("orders scenes as the spec says", () => {
    expect(stepsFor("full", { role: "creator" }).map((s) => s.id)).toEqual([
      "cold_open", "q_role", "chapter1", "q_asset", "q_platforms", "chapter2",
      "q_goal", "q_timing", "q_budget", "q_deciding", "chapter3", "gate", "building", "result",
    ]);
    expect(stepsFor("plain", {}).map((s) => s.scene)).toEqual(["film", "gate", "building", "result"]);
  });

  it("resumes at the saved scene but never past an unanswered question", () => {
    expect(resumeStep("full", { role: "brand", asset: "music_release" }, "q_platforms", false)).toBe("q_platforms");
    expect(resumeStep("full", { role: "brand" }, "chapter2", false)).toBe("q_asset");
    expect(resumeStep("full", {}, null, false)).toBe("cold_open");
    expect(resumeStep("full", { role: "clipper" }, "result", false)).toBe("q_asset");
    expect(resumeStep("full", { role: "clipper" }, "q_role", true)).toBe("result");
  });

  it("caps resume before building when there is no lead", () => {
    const all = { role: "clipper", asset: "music", platforms: ["tiktok"], goal: "side_income", timing: "new" };
    expect(resumeStep("full", all, "building", false)).toBe("gate");
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
});
