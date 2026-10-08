"use client";
// S9: plain headline, the personal film, the guide, then the path's next step.
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { m } from "framer-motion";
import { copy, fill, resultText } from "@/lib/content";
import { track } from "@/lib/client/api";
import { pathOf } from "@/lib/flow";
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
  const text = resultText(path, asset);
  const film = videoSource(`result_${path ?? "creator"}`);
  const r = copy.result;

  useEffect(() => {
    track("result_view", { path: path ?? "none", qualified: Boolean(f.lead?.qualified) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guideHref = f.lead ? `/g/${f.lead.guideToken}` : null;

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
        {guideHref ? (
          <a
            href={guideHref}
            onClick={() => track("guide_download", { from: "result" })}
            className="mt-6 inline-flex h-[52px] items-center gap-2 rounded-pill bg-ink px-7 text-[15px] font-medium text-white hover:bg-ink-soft"
          >
            {r.guideOpen} <span aria-hidden="true">&rarr;</span>
          </a>
        ) : (
          <p className="mt-4 text-lead text-muted">{r.guidePending}</p>
        )}
      </div>

      <div className="border-t border-line">
        <NextStep />
      </div>
    </section>
  );
}
