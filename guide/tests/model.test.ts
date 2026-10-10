import { describe, expect, it } from "vitest";
import { allowedFigures, buyerNumbers, clipperNumbers, CPM, short } from "@/lib/guide/model";

describe("numbers model", () => {
  it("turns a budget band into counted views at the case study CPMs", () => {
    const n = buyerNumbers({ role: "creator", budget: { band: "3k_10k" }, reach: "1k_10k" }, "creator");
    expect(n.monthlyBudget).toBe(3000);
    expect(n.budgetKnown).toBe(true);
    expect(n.views.high).toBe(Math.round((3000 / CPM.high) * 1000 / 1000) * 1000);
    expect(n.views.low).toBeGreaterThan(n.views.mid);
    expect(n.views.mid).toBeGreaterThan(n.views.high);
    expect(n.currentPost).toBe(5000);
    expect(n.timesCurrentPost).toBeGreaterThan(100);
    expect(n.months).toHaveLength(3);
    expect(n.months[2].total).toBeGreaterThan(n.months[0].total);
  });

  it("uses the typed amount when the band is not sure, and a floor otherwise", () => {
    expect(buyerNumbers({ budget: { band: "not_sure", amount: 7500 } }, "brand").monthlyBudget).toBe(7500);
    const low = buyerNumbers({ budget: { band: "under_3k" } }, "brand");
    expect(low.monthlyBudget).toBe(3000);
    expect(low.budgetKnown).toBe(false);
    expect(buyerNumbers({}, "creator").budgetKnown).toBe(false);
  });

  it("gives clippers per clip pay at the campaign rate, never a monthly promise", () => {
    const n = clipperNumbers({ hours: "5_10" });
    expect(n.rate).toBe(2);
    expect(n.perClip[1]).toEqual({ views: 10_000, pay: 20 });
    expect(n.clipsPerWeek).toBe(12);
    expect(n.monthly[0].pay).toBe(Math.round(((12 * 4 * 500) / 1000) * 2));
  });

  it("lists every figure the writer may use", () => {
    const f = allowedFigures(buyerNumbers({ budget: { band: "10k_50k" }, reach: "under_1k" }, "brand"));
    expect(f).toContain("$10,000");
    expect(f).toContain("$1.78");
    expect(f.some((x) => /M$/.test(x))).toBe(true);
  });

  it("formats short numbers", () => {
    expect(short(1_234_567)).toBe("1.2M");
    expect(short(45_000)).toBe("45K");
    expect(short(900)).toBe("900");
  });
});
