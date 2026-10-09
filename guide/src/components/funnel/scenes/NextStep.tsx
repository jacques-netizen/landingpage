"use client";
// The path call to action: calendar for qualified buyers, a soft next step for
// other buyers (with an optional budget number that can open the calendar),
// the network join link for clippers. Clippers never see the calendar.
import { useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { copy } from "@/lib/content";
import { postJson, track } from "@/lib/client/api";
import { pathOf } from "@/lib/flow";
import { useFunnel, type LeadView } from "../context";
import { Pill } from "../ui";

const BookingEmbed = dynamic(() => import("./BookingEmbed").then((x) => x.BookingEmbed), { ssr: false });

export function NextStep() {
  const f = useFunnel();
  const c = copy.result.cta;
  const answers = f.lead?.answers ?? f.answers;
  const path = pathOf(answers) ?? f.lead?.path;
  const [amount, setAmount] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "thanks" | "error">("idle");

  if (path === "clipper") {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 md:px-12">
        <h2 className="font-serif text-title">{c.join.headline}</h2>
        <p className="mt-4 max-w-[36ch] text-lead text-muted">{c.join.body}</p>
        {f.config.whopJoinUrl && (
          <a
            href={f.config.whopJoinUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("join_click", { from: "result" })}
            className="mt-8 inline-flex h-[52px] items-center gap-2 rounded-pill bg-ink px-7 text-[15px] font-medium text-white hover:bg-ink-soft"
          >
            {c.join.button} <span aria-hidden="true">&rarr;</span>
          </a>
        )}
      </div>
    );
  }

  if (f.lead?.offersCall && f.config.calBookingUrl) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 md:px-12">
        <h2 className="font-serif text-title">{c.book.headline}</h2>
        <p className="mt-4 max-w-[36ch] text-lead text-muted">{c.book.body}</p>
        <BookingEmbed lead={f.lead} bookingUrl={f.config.calBookingUrl} redirectUrl={f.config.calBookedRedirectUrl} />
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      setState("error");
      return;
    }
    setState("busy");
    const res = await postJson<{ lead?: LeadView }>("/api/lead/budget", { token: f.getSessionToken(), amount: Math.round(n) });
    if (res.ok && res.data?.lead) {
      f.updateLead(res.data.lead);
      setState("thanks");
    } else setState("error");
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-20 md:px-12">
      <h2 className="font-serif text-title">{c.soft.headline}</h2>
      <p className="mt-4 max-w-[38ch] text-lead text-muted">{c.soft.body}</p>
      {f.lead && state !== "thanks" && (
        <form onSubmit={submit} className="mt-8 max-w-md">
          <label htmlFor="soft-amount" className="block font-serif text-[1.4rem] leading-tight">
            {c.soft.amountLabel}
          </label>
          <div className="mt-3 flex items-center gap-2 border-b border-ink pb-2 focus-within:shadow-[0_1px_0_0_var(--color-ink)]">
            <span aria-hidden="true" className="font-serif text-[1.6rem]">$</span>
            <input
              id="soft-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, "").slice(0, 12))}
              aria-invalid={state === "error"}
              aria-describedby={state === "error" ? "soft-amount-error" : undefined}
              className="w-full bg-transparent font-serif text-[1.6rem] outline-none focus-visible:outline-none"
            />
          </div>
          {state === "error" && (
            <p id="soft-amount-error" className="mt-2 text-[14px] text-proof-2">
              {c.soft.amountError}
            </p>
          )}
          <Pill type="submit" disabled={state === "busy"} className="mt-6">
            {c.soft.amountSubmit}
          </Pill>
        </form>
      )}
      {state === "thanks" && <p className="mt-8 text-lead text-ink-soft">{c.soft.amountThanks}</p>}
    </div>
  );
}
