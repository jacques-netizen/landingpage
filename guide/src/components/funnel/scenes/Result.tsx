"use client";
// S9: plain headline, the personal film, the guide, then the path's next step.
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { m } from "framer-motion";
import { copy, fill, resultText, textAnswer } from "@/lib/content";
import { postJson, track } from "@/lib/client/api";
import { pathOf } from "@/lib/flow";
import type { LeadView } from "../context";
import { videoSource } from "@/lib/video/source";
import { useFunnel } from "../context";
import { Logo } from "../ui";
import { ResultFilm } from "./ResultFilm";

const NextStep = dynamic(() => import("./NextStep").then((x) => x.NextStep), { ssr: false });

export function ResultScene() {
  const f = useFunnel();
  const answers = f.lead?.answers ?? f.answers;
  const path = pathOf(answers) ?? (f.lead?.path as ReturnType<typeof pathOf>);
  const asset = typeof answers.asset === "string" ? answers.asset : undefined;
  const text = resultText(path, asset, textAnswer(answers, "project"));
  const film = videoSource(`result_${path ?? "creator"}`);
  const r = copy.result;

  useEffect(() => {
    track("result_view", { path: path ?? "none", qualified: Boolean(f.lead?.qualified) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The guide is written in the background. Ask the server every few seconds until it is there.
  const ready = Boolean(f.lead?.guideReady);
  useEffect(() => {
    if (!f.lead || ready) return;
    let stop = false;
    const tick = async () => {
      const token = f.getSessionToken();
      if (!token || stop) return;
      const res = await postJson<{ lead?: LeadView | null }>("/api/session", { token }, 8000);
      if (stop) return;
      if (res.ok && res.data?.lead?.guideReady) f.updateLead({ guideReady: true, guide: res.data.lead.guide });
    };
    const t = window.setInterval(() => void tick(), 3000);
    void tick();
    return () => {
      stop = true;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(f.lead), ready]);

  const guideHref = f.lead ? `/g/${f.lead.guideToken}` : null;
  const g = f.lead?.guide;

  return (
    <section className="h-full overflow-y-auto bg-paper">
      <header className="px-5 pt-[max(22px,env(safe-area-inset-top))] md:px-12">
        <Logo />
      </header>
      <div className="mx-auto max-w-3xl px-5 pb-24 md:px-12">
        <m.h1
          initial={{ opacity: 0, y: f.reduced ? 0 : 18 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }}
          className="mt-12 font-serif text-display md:mt-20"
        >
          {text.headline}
        </m.h1>
        <p className="mt-5 max-w-[40ch] text-lead text-muted">{text.body}</p>
        <p className="mt-6 text-[15px] text-ink-soft">
          {f.lead?.emailMasked ? fill(r.emailSent, { email: f.lead.emailMasked }) : r.emailSentNoAddress}{" "}
          <span className="text-muted">{r.spamNote}</span>
        </p>
      </div>

      {film && (
        <div className="md:px-12">
          <ResultFilm src={film} />
        </div>
      )}

      <div className="mx-auto max-w-3xl px-5 py-20 md:px-12">
        <h2 className="font-serif text-title">{r.guideTitle}</h2>
        {/* The guide card, in the guide's own dark gold style so the hand off feels like one product. */}
        <div className="mt-8 border border-[#d4b26a]/25 bg-[#15120d] p-6 text-[#efe7d5] md:p-10" aria-live="polite">
          {g ? (
            <>
              <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#d4b26a]">{r.guideReady}</p>
              <p className="mt-4 font-sans text-[clamp(1.7rem,6vw,2.6rem)] font-extrabold uppercase leading-[0.96] tracking-[-0.03em]">{g.headline}</p>
              <p className="mt-4 max-w-[46ch] text-[1.05rem] leading-relaxed text-[#efe7d5]/85">{g.sub}</p>
              <div className="mt-6 grid gap-px border border-[#d4b26a]/10 bg-[#d4b26a]/10 md:grid-cols-3">
                {g.tiles.map((t, i) => (
                  <div key={i} className="bg-[#1f1911] px-4 py-5">
                    <p className="font-sans text-[1.7rem] font-extrabold leading-none tracking-[-0.02em] text-[#ebd69e]">{t.value}</p>
                    <p className="mt-2 font-sans text-[0.64rem] leading-snug tracking-[0.06em] text-[#a09379]">{t.label}</p>
                  </div>
                ))}
              </div>
              <ol className="mt-6 grid gap-x-8 md:grid-cols-2">
                {g.sections.map((t, i) => (
                  <li key={t} className="flex items-baseline gap-3 border-b border-[#d4b26a]/10 py-2 text-[0.98rem] text-[#a09379]">
                    <span className="font-sans text-[0.66rem] font-bold tracking-[0.2em] text-[#d4b26a]">{String(i + 1).padStart(2, "0")}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
              {guideHref && (
                <a
                  href={guideHref}
                  className="mt-8 inline-flex h-[52px] items-center gap-2 border border-[#b8944f] bg-[#b8944f] px-7 font-sans text-[0.8rem] font-bold uppercase tracking-[0.08em] text-[#15120d] hover:bg-[#ebd69e]"
                >
                  {r.guideOpen} <span aria-hidden="true">&rarr;</span>
                </a>
              )}
            </>
          ) : (
            <>
              <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-[#d4b26a]">{r.guideWriting}</p>
              <p className="mt-4 max-w-[46ch] text-lead text-[#efe7d5]/85">{r.guidePending}</p>
              <div className="mt-6 h-[2px] w-full overflow-hidden bg-white/10" aria-hidden="true">
                <div className="h-full w-1/3 animate-pulse bg-[#d4b26a]" />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-line">
        <NextStep />
      </div>
    </section>
  );
}
