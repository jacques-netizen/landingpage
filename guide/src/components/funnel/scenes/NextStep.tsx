"use client";
// The path call to action: calendar for qualified buyers, a soft next step for
// other buyers, the network join link for clippers. Clippers never see the
// calendar.
import { copy } from "@/lib/content";
import { track } from "@/lib/client/api";
import { pathOf } from "@/lib/flow";
import { useFunnel } from "../context";

export function NextStep() {
  const f = useFunnel();
  const c = copy.result.cta;
  const answers = f.lead?.answers ?? f.answers;
  const path = pathOf(answers) ?? f.lead?.path;

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

  if (f.lead?.qualified) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20 md:px-12">
        <h2 className="font-serif text-title">{c.book.headline}</h2>
        <p className="mt-4 max-w-[36ch] text-lead text-muted">{c.book.body}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-20 md:px-12">
      <h2 className="font-serif text-title">{c.soft.headline}</h2>
      <p className="mt-4 max-w-[38ch] text-lead text-muted">{c.soft.body}</p>
    </div>
  );
}
