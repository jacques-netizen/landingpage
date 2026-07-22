"use client";
/**
 * The one high-contrast element on the lesson screen, because shipping is
 * the point (design study §6). Shipping an assignment (or marking complete,
 * for modules with nothing to ship) is what earns the stamp — never watch time.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Stamp } from "@/components/Stamp";

export function CompleteControls({
  moduleId,
  campusSlug,
  assignmentId,
  assignmentDescription,
  alreadyEarned,
}: {
  moduleId: string;
  campusSlug: string;
  assignmentId: string | null;
  assignmentDescription: string | null;
  alreadyEarned: boolean;
}) {
  const router = useRouter();
  const [proofUrl, setProofUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [earned, setEarned] = useState(alreadyEarned);
  const [justShipped, setJustShipped] = useState(false);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  async function post(body: object) {
    setBusy(true);
    await fetch("/api/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    setEarned(true);
    setJustShipped(true);
    setTimeout(() => setJustShipped(false), 900);
    router.refresh();
  }

  return (
    <div className="mt-12 rounded-[3px] border border-gold/22 border-t-2 border-t-gold bg-white/[0.035] p-8">
      <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-gold/85">
        {assignmentId ? "Assignment" : "Mark complete"}
      </div>
      {assignmentDescription && <div className="mt-3 max-w-[58ch] text-[15px] leading-[1.65] text-cream/90">{assignmentDescription}</div>}

      <div className="mt-6 flex items-center gap-5">
        {assignmentId ? (
          <>
            <input
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="Link to what you shipped"
              disabled={earned}
              className="min-w-0 flex-1 rounded-[2px] border border-cream/16 bg-transparent px-3.5 py-2.5 text-sm text-cream placeholder:text-cream/35 disabled:opacity-40"
            />
            <button
              disabled={busy || earned || !proofUrl}
              onClick={() => post({ action: "ship_assignment", assignmentId, proofUrl })}
              className={`flex-shrink-0 rounded-[2px] border border-gold px-6 py-2.5 font-body text-sm font-semibold tracking-[0.02em] transition-colors disabled:cursor-default ${
                earned ? "bg-gold/14 text-gold" : "bg-gold text-ink hover:bg-gold-bright"
              }`}
            >
              {earned ? "Shipped" : "Ship assignment"}
            </button>
          </>
        ) : (
          <button
            disabled={busy || earned}
            onClick={() => post({ action: "complete_module", moduleId })}
            className={`rounded-[2px] border border-gold px-6 py-2.5 font-body text-sm font-semibold tracking-[0.02em] transition-colors disabled:cursor-default ${
              earned ? "bg-gold/14 text-gold" : "bg-gold text-ink hover:bg-gold-bright"
            }`}
          >
            {earned ? "Complete" : "Mark complete"}
          </button>
        )}
        {earned && (
          <div className={justShipped && !reducedMotion ? "stamp-press" : ""}>
            <Stamp campusSlug={campusSlug} earned size={44} />
          </div>
        )}
      </div>
    </div>
  );
}
