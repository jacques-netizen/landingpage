"use client";
/**
 * Scored on the work you've put in, not watch time. Retakes are allowed —
 * the score shown is always the most recent attempt.
 */
import { useState } from "react";
import Link from "next/link";
import { Caption } from "@/components/Caption";

type Question = { question: string; choices: string[] };
type Attempt = { score: number; passed: boolean };

export function ExamView({
  examId,
  campusName,
  moduleName,
  backHref,
  passScore,
  questions,
  latestAttempt,
}: {
  examId: string;
  campusName: string;
  moduleName: string;
  backHref: string;
  passScore: number;
  questions: Question[];
  latestAttempt: Attempt | null;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(questions.map(() => null));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Attempt | null>(latestAttempt);

  const allAnswered = answers.every((a) => a !== null);

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/exam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId, answers }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) setResult({ score: data.score, passed: data.passed });
  }

  return (
    <main className="min-h-screen bg-ink pt-[76px]">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:px-11">
        <Caption>
          {campusName.toUpperCase()} / {moduleName.toUpperCase()} — EXAM
        </Caption>
        <h1 className="mt-3.5 font-display text-[36px] leading-[1.0] tracking-[-0.01em] text-cream-bright sm:text-[48px]">
          Show what you kept.
        </h1>
        <p className="mt-4 text-sm text-cream/68">
          {questions.length} questions. {passScore}% correct to pass. Retake any time.
        </p>

        {result && (
          <div
            className={`mt-8 rounded-[2px] border p-5 text-sm ${
              result.passed ? "border-gold/30 bg-gold/[0.06] text-gold-bright" : "border-rouge/40 bg-rouge/[0.08] text-cream/85"
            }`}
          >
            {result.passed ? "Passed" : "Not yet"} — {result.score}% correct.
          </div>
        )}

        <div className="mt-10 flex flex-col gap-10">
          {questions.map((q, qi) => (
            <div key={qi}>
              <div className="font-body text-base text-cream-bright">{q.question}</div>
              <div className="mt-3 flex flex-col gap-2">
                {q.choices.map((choice, ci) => (
                  <button
                    key={ci}
                    onClick={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? ci : a)))}
                    className={`rounded-[2px] border px-4 py-3 text-left text-sm transition-colors ${
                      answers[qi] === ci
                        ? "border-gold bg-gold/10 text-cream-bright"
                        : "border-cream/14 text-cream/75 hover:border-cream/30"
                    }`}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-center gap-4">
          <button
            onClick={submit}
            disabled={busy || !allAnswered}
            className="rounded-[2px] border border-gold bg-gold px-6 py-3 font-body text-sm font-semibold tracking-[0.02em] text-ink transition-colors hover:bg-gold-bright disabled:cursor-default disabled:opacity-40"
          >
            {busy ? "Scoring…" : "Submit"}
          </button>
          <Link href={backHref} className="font-mono text-xs text-cream/50 hover:text-cream/80">
            Back to lesson
          </Link>
        </div>
      </div>
    </main>
  );
}
