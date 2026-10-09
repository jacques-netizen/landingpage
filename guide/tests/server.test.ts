import { describe, expect, it } from "vitest";
import { crmFields, crmTags } from "@/lib/server/leadview";
import { buildDeliveryEmail } from "@/lib/server/email";
import { signToken, verifyToken } from "@/lib/server/tokens";
import { cleanProps } from "@/lib/events";
import type { LeadRow } from "@/lib/server/leads";

const lead = (over: Partial<LeadRow> = {}): LeadRow => ({
  id: "11111111-1111-1111-1111-111111111111",
  sessionId: "22222222-2222-2222-2222-222222222222",
  firstName: "Sam",
  email: "sam@example.com",
  igHandle: null,
  company: null,
  consentTextVersion: "v",
  consentAt: new Date(),
  qualified: true,
  humanPriority: false,
  path: "creator",
  variant: "full",
  answers: { role: "creator", asset: "music_release", platforms: ["tiktok", "x"], goal: "streams", timing: "this_month", budget: { band: "not_sure", amount: 4000 }, deciding: "no" },
  ghlContactId: null,
  ghlOpportunityId: null,
  metaEventId: "e",
  fbp: null,
  fbc: null,
  clientIp: null,
  userAgent: null,
  bookedAt: null,
  createdAt: new Date(),
  ...over,
});

describe("CRM mapping", () => {
  it("sets the fields and tags from section 8.1", () => {
    const f = crmFields(lead(), { src: "ig-distribution" });
    expect(f).toMatchObject({ funnel_path: "creator", asset: "music_release", platforms: "tiktok,x", goal: "streams", timing: "this_month", budget_band: "not_sure:4000", qualified: "yes", human_priority: "no", source: "ig-distribution" });
    expect(f.guide_url).toMatch(/\/g\//);
    expect(crmTags(lead())).toEqual(["guide-lead", "path-creator", "qualified"]);
    expect(crmTags(lead({ qualified: false, humanPriority: true, path: "brand" }))).toEqual(["guide-lead", "path-brand", "not-qualified", "human-priority"]);
  });
});

describe("delivery email", () => {
  it("has a guide link, unsubscribe, no em dashes and no booking link for clippers", () => {
    process.env.CAL_BOOKING_URL = "https://cal.com/mde/call";
    process.env.WHOP_JOIN_URL = "https://whop.com/mde";
    const m = buildDeliveryEmail(lead());
    expect(m.subject).toBe("Your plan for a music release");
    expect(m.text).toContain("/g/");
    expect(m.text).toContain("cal.com/mde/call");
    expect(m.html).toContain("Unsubscribe");
    expect(m.html + m.text).not.toContain(String.fromCharCode(0x2014));
    const c = buildDeliveryEmail(lead({ path: "clipper", qualified: false, answers: { role: "clipper", asset: "music" } }));
    expect(c.text).not.toContain("cal.com");
    expect(c.text).toContain("whop.com/mde");
  });
});

import { offersCall } from "@/lib/server/leadview";
describe("calendar offer", () => {
  it("goes to qualified buyers and to plain arm buyers, never to clippers", () => {
    expect(offersCall(lead())).toBe(true);
    expect(offersCall(lead({ qualified: false }))).toBe(false);
    expect(offersCall(lead({ qualified: false, variant: "plain" }))).toBe(true);
    expect(offersCall(lead({ path: "clipper", qualified: false, variant: "plain" }))).toBe(false);
  });
});

describe("tokens and events", () => {
  it("rejects tampered tokens", () => {
    const t = signToken("abc", "guide");
    expect(verifyToken(t, "guide")).toBe("abc");
    expect(verifyToken(t, "unsub")).toBeNull();
    expect(verifyToken(t.slice(0, -1) + "x", "guide")).toBeNull();
  });
  it("drops personal data from event props", () => {
    expect(cleanProps({ scene: "gate", email: "a@b.c", first_name: "x", note: "a@b.c", pct: 25 })).toEqual({ scene: "gate", pct: 25 });
  });
});

import { verifyCalSignature } from "@/lib/server/cal";
import crypto from "node:crypto";
describe("Cal.com webhook signature", () => {
  it("accepts the right signature and rejects others", () => {
    const body = JSON.stringify({ triggerEvent: "BOOKING_CREATED" });
    const sig = crypto.createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(verifyCalSignature(body, sig, "s3cret")).toBe(true);
    expect(verifyCalSignature(body, sig, "other")).toBe(false);
    expect(verifyCalSignature(body, null, "s3cret")).toBe(false);
    expect(verifyCalSignature(body + " ", sig, "s3cret")).toBe(false);
  });
});

import { alertFor, discordMessage } from "@/lib/server/discord";
describe("Discord alerts", () => {
  it("covers the three alert types and never includes an email", () => {
    const base = lead({ email: "private@example.com", igHandle: "sam.clips", company: "Label Co", humanPriority: true });
    expect(alertFor(base)).toBe("priority");
    expect(alertFor(lead())).toBe("qualified");
    expect(alertFor(lead({ qualified: false }))).toBeNull();
    for (const kind of ["qualified", "priority", "booking"] as const) {
      const json = JSON.stringify(discordMessage(kind, base));
      expect(json).not.toContain("private@example.com");
      expect(json).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      expect(json).toContain("Label Co");
    }
    expect(JSON.stringify(discordMessage("priority", base))).toContain("HUMAN PRIORITY");
  });
});
