// The numbers model. Deterministic, shared by the server (the AI writer only
// uses these figures) and the browser (the sliders on the guide page). Every
// rate comes from the approved case studies in content/proof.json, so nothing
// here is a promise: it is "at the rates those campaigns ran at".
import { questionFor, strategy, type Path } from "@/lib/content";
import { budgetOf, type Answers } from "@/lib/flow";

/** Effective CPMs from the approved case studies: Mannywellz ft. Wale, Paul American, Walmart. */
export const CPM = { low: 0.48, mid: 1.78, high: 2.3 } as const;
/** The rate per 1,000 views named in two approved campaigns (Kojo Blak, Paul American). */
export const CLIPPER_RATE = 2.0;

export type BuyerNumbers = {
  kind: "buyer";
  monthlyBudget: number;
  budgetKnown: boolean;
  /** Counted views for one month's budget at each CPM. */
  views: { low: number; mid: number; high: number };
  perDay: { low: number; mid: number; high: number };
  /** Their current good post, from the reach band, and how many of those one month buys at the mid CPM. */
  currentPost: number | null;
  timesCurrentPost: number | null;
  /** Running three months at the mid CPM, with earlier months' posts still counting (compounding). */
  months: { month: number; newViews: number; carried: number; total: number }[];
};

export type ClipperNumbers = {
  kind: "clipper";
  rate: number;
  perClip: { views: number; pay: number }[];
  clipsPerWeek: number;
  /** A month at their hours, if the average clip reaches each size. */
  monthly: { avgViews: number; pay: number }[];
};

export type Numbers = BuyerNumbers | ClipperNumbers;

const round = (n: number, step = 1) => Math.round(n / step) * step;

/** Share of a month's views that is still arriving the month after (posts do not expire). */
export const CARRY = 0.35;

export function buyerNumbers(answers: Answers, path: Path | undefined, fallbackBudget = 3000): BuyerNumbers {
  const b = budgetOf(answers);
  const opt = questionFor("budget", path)?.options.find((o) => o.value === b?.band);
  let monthlyBudget = fallbackBudget;
  let budgetKnown = false;
  if (b?.band === "not_sure" && typeof b.amount === "number" && b.amount > 0) {
    monthlyBudget = b.amount;
    budgetKnown = true;
  } else if (opt && typeof opt.min === "number") {
    // Use the band's floor, except the lowest band where the floor is zero.
    monthlyBudget = opt.min > 0 ? opt.min : fallbackBudget;
    budgetKnown = opt.min > 0;
  }
  const reach = questionFor("reach", path)?.options.find((o) => o.value === answers.reach);
  const currentPost = typeof reach?.views === "number" ? reach.views : null;
  return buyerNumbersFrom(monthlyBudget, budgetKnown, currentPost);
}

/** The buyer numbers for a given budget. The slider on the guide page calls this in the browser. */
export function buyerNumbersFrom(monthlyBudget: number, budgetKnown: boolean, currentPost: number | null): BuyerNumbers {
  const at = (cpm: number) => round((monthlyBudget / cpm) * 1000, 1000);
  const views = { low: at(CPM.low), mid: at(CPM.mid), high: at(CPM.high) };
  const perDay = { low: round(views.low / 30, 100), mid: round(views.mid / 30, 100), high: round(views.high / 30, 100) };
  const timesCurrentPost = currentPost ? Math.max(1, Math.round(views.mid / currentPost)) : null;
  const months: BuyerNumbers["months"] = [];
  let carried = 0;
  for (let m = 1; m <= 3; m++) {
    const total = views.mid + carried;
    months.push({ month: m, newViews: views.mid, carried: round(carried, 1000), total: round(total, 1000) });
    carried = total * CARRY;
  }
  return { kind: "buyer", monthlyBudget, budgetKnown, views, perDay, currentPost, timesCurrentPost, months };
}

export function clipperNumbers(answers: Answers, path: Path | undefined = "clipper"): ClipperNumbers {
  const hours = questionFor("hours", path)?.options.find((o) => o.value === answers.hours);
  return clipperNumbersFrom(typeof hours?.clipsPerWeek === "number" ? hours.clipsPerWeek : 10);
}

/** The clipper numbers for a number of clips a week. The slider on the guide page calls this in the browser. */
export function clipperNumbersFrom(clipsPerWeek: number): ClipperNumbers {
  const perClip = [1_000, 10_000, 100_000].map((views) => ({ views, pay: round((views / 1000) * CLIPPER_RATE, 1) }));
  const monthly = [500, 2_000, 10_000].map((avgViews) => ({
    avgViews,
    pay: round(((clipsPerWeek * 4 * avgViews) / 1000) * CLIPPER_RATE, 1),
  }));
  return { kind: "clipper", rate: CLIPPER_RATE, perClip, clipsPerWeek, monthly };
}

export function numbersFor(answers: Answers, path: Path | undefined): Numbers {
  return path === "clipper" ? clipperNumbers(answers, path) : buyerNumbers(answers, path);
}

/** 1,234,567 to "1.2M", 45,000 to "45K". */
export function short(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
}

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** Every figure the writer is allowed to use, as strings, for the output guard. */
export function allowedFigures(n: Numbers): string[] {
  const out = new Set<string>();
  const add = (v: number) => {
    out.add(short(v));
    out.add(Math.round(v).toLocaleString("en-US"));
    out.add(String(Math.round(v)));
    out.add(money(v));
  };
  if (n.kind === "buyer") {
    add(n.monthlyBudget);
    for (const k of ["low", "mid", "high"] as const) {
      add(n.views[k]);
      add(n.perDay[k]);
    }
    if (n.currentPost) add(n.currentPost);
    if (n.timesCurrentPost) out.add(`${n.timesCurrentPost}x`);
    for (const m of n.months) {
      add(m.total);
      add(m.carried);
    }
    out.add(`$${CPM.low.toFixed(2)}`);
    out.add(`$${CPM.mid.toFixed(2)}`);
    out.add(`$${CPM.high.toFixed(2)}`);
  } else {
    out.add(`$${n.rate.toFixed(2)}`);
    for (const c of n.perClip) {
      add(c.views);
      add(c.pay);
    }
    for (const m of n.monthly) {
      add(m.avgViews);
      add(m.pay);
    }
    out.add(String(n.clipsPerWeek));
  }
  return [...out];
}

export const strategyTerms = strategy.terms;
