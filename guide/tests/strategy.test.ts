import { describe, expect, it } from "vitest";
import { briefFor } from "@/lib/server/guide/brief";
import { effectiveGoal } from "@/lib/server/guide/assemble";
import { sampleLead } from "../scripts/sample-guides";
import strategy from "../content/strategy.json";

const lead = (objective: string, action?: string) =>
  sampleLead("s", { path: "creator", answers: { role: "creator", project: "my single", asset: "music_release", objective, action, market: "Ghana", audience: "students", platforms: ["tiktok"], budget: { band: "3k_10k" } } });

describe("strategy tracks", () => {
  it("maps each objective to its track with the lead's tokens filled in", () => {
    const v = briefFor(lead("visibility"));
    expect(v.track?.key).toBe("visibility");
    expect(v.track?.promise).toContain("Ghana");
    expect(v.track?.promise).toContain("students");
    expect(v.action).toBeNull();
    const c = briefFor(lead("conversions", "signup"));
    expect(c.track?.key).toBe("conversions");
    expect(c.action).toBe("sign up");
    expect(c.track?.steps.some((s) => s.body.includes("sign up"))).toBe(true);
    expect(c.track?.steps[0].title).toContain(strategy.terms.conversionEditors);
    const b = briefFor(lead("both", "stream"));
    expect(b.track?.key).toBe("both");
    expect(b.track?.promise).toContain("my single");
    expect(b.track?.steps.length).toBe(5);
  });

  it("joins several countries and treats Global as worldwide", () => {
    const two = briefFor(sampleLead("m", { path: "creator", answers: { role: "creator", objective: "visibility", market: ["Nigeria", "Ghana"], audience: "students" } }));
    expect(two.market).toBe("Nigeria and Ghana");
    expect(two.track?.promise).toContain("Nigeria and Ghana");
    const g = briefFor(sampleLead("g", { path: "creator", answers: { role: "creator", objective: "visibility", market: ["Global"], audience: "students" } }));
    expect(g.facts.find((f) => f.id === "market")?.answer).toBe("Worldwide");
    expect(g.track?.promise).toContain("your markets worldwide");
  });

  it("leaves no unfilled tokens", () => {
    for (const o of ["visibility", "conversions", "both"]) {
      const b = briefFor(lead(o, "buy"));
      expect(JSON.stringify(b.track)).not.toMatch(/\{\w+\}/);
    }
  });

  it("maps the objective onto the rule block goals", () => {
    expect(effectiveGoal({ objective: "visibility" })).toBe("views");
    expect(effectiveGoal({ objective: "conversions", action: "stream" })).toBe("streams");
    expect(effectiveGoal({ objective: "conversions", action: "buy" })).toBe("sales");
    expect(effectiveGoal({ objective: "both" })).toBe("awareness");
    expect(effectiveGoal({ goal: "side_income" })).toBe("side_income");
  });
});
