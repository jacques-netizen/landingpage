"use client";
// Cal.com inline booking, prefilled with name, email and the answers the
// event type asks for (asset, budget band, company as hidden or optional
// booking fields). metadata[lead] ties the booking back to the lead in the
// webhook. After a booking the person goes to the existing pre-call page.
import { useEffect, useMemo } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { copy } from "@/lib/content";
import { budgetOf } from "@/lib/flow";
import { track } from "@/lib/client/api";
import type { LeadView } from "../context";

const NAMESPACE = "guide";

function parseLink(url: string) {
  try {
    const u = new URL(url);
    return { origin: u.origin, link: u.pathname.replace(/^\/+|\/+$/g, "") };
  } catch {
    return null;
  }
}

export function BookingEmbed({ lead, bookingUrl, redirectUrl }: { lead: LeadView; bookingUrl: string; redirectUrl: string }) {
  const target = parseLink(bookingUrl);
  const config = useMemo(() => {
    const b = budgetOf(lead.answers);
    const fields: Record<string, string> = {
      name: lead.firstName,
      email: lead.email,
      asset: typeof lead.answers.asset === "string" ? lead.answers.asset : "",
      budget_band: b ? (b.amount ? `${b.band}:${b.amount}` : b.band) : "",
      company: lead.company ?? "",
      layout: "month_view",
    };
    return { ...fields, metadata: { lead: lead.ref } } as Record<string, string | Record<string, string>>;
  }, [lead]);

  useEffect(() => {
    track("booking_view", { path: lead.path });
    let alive = true;
    (async () => {
      const cal = await getCalApi({ namespace: NAMESPACE });
      if (!alive) return;
      cal("ui", { hideEventTypeDetails: false, layout: "month_view", styles: { branding: { brandColor: "#1a1510" } } } as never);
      const done = () => {
        // The webhook records the booking server side; this only moves the person on.
        window.location.href = redirectUrl;
      };
      cal("on", { action: "bookingSuccessfulV2", callback: done } as never);
      cal("on", { action: "bookingSuccessful", callback: done } as never);
    })();
    return () => {
      alive = false;
    };
  }, [lead.path, redirectUrl]);

  if (!target) return null;
  return (
    <div className="mt-8">
      <div className="min-h-[640px] w-full overflow-hidden rounded-[20px] bg-white">
        <Cal namespace={NAMESPACE} calLink={target.link} calOrigin={target.origin} config={config} style={{ width: "100%", height: "100%", minHeight: 640, overflow: "auto" }} />
      </div>
      <a href={`${bookingUrl}?name=${encodeURIComponent(lead.firstName)}&email=${encodeURIComponent(lead.email)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-[14px] text-muted underline underline-offset-4">
        {copy.result.cta.book.fallback}
      </a>
    </div>
  );
}
