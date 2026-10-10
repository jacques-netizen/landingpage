"use client";
import { useState } from "react";
import { m } from "framer-motion";
import { copy, getQuestion, questionFor, type Step } from "@/lib/content";
import { budgetOf, cleanTags, cleanText, isAnswered } from "@/lib/flow";
import { useFunnel } from "../context";
import { BackButton, Pill } from "../ui";

export function QuestionScene({ step }: { step: Step }) {
  const f = useFunnel();
  const q = getQuestion(step.question!);
  const v = questionFor(step.question!, f.path);
  const prior = f.answers[step.question!];
  const [multi, setMulti] = useState<string[]>(Array.isArray(prior) ? (prior as string[]) : []);
  const priorBudget = step.question === "budget" ? budgetOf(f.answers) : undefined;
  const [picked, setPicked] = useState<string | null>(
    typeof prior === "string" ? prior : priorBudget ? priorBudget.band : null,
  );
  const [amount, setAmount] = useState<string>(priorBudget?.amount ? String(priorBudget.amount) : "");
  const [text, setText] = useState<string>(typeof prior === "string" ? prior : "");
  const [tags, setTags] = useState<string[]>(Array.isArray(prior) ? (prior as string[]) : []);
  const showAmount = Boolean(v?.amountField && v.options.find((o) => o.value === picked)?.amountField);
  if (!q || !v) return null;

  const headingId = `q-${q.id}`;
  const isText = q.type === "text";
  const isTags = q.type === "tags";
  const tagLimit = v.maxItems ?? 6;
  const has = (list: string[], value: string) => list.some((x) => x.toLowerCase() === value.toLowerCase());

  const choose = (value: string) => {
    if (q.type === "multi") {
      setMulti((cur) => (cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]));
      return;
    }
    setPicked(value);
    const opt = v.options.find((o) => o.value === value);
    if (q.id === "budget") {
      if (opt?.amountField) return; // wait for the optional number
      f.answer("budget", { band: value, amount: null });
      return;
    }
    // A beat so the tap registers before the cut.
    window.setTimeout(() => f.answer(q.id, value), f.reduced ? 60 : 220);
  };

  const submitAmount = (skip: boolean) => {
    const n = Number(amount.replace(/[^\d.]/g, ""));
    f.answer("budget", { band: picked, amount: !skip && Number.isFinite(n) && n > 0 ? Math.round(n) : null });
  };

  const submitText = (value: string, skip = false) => {
    const t = skip ? "" : cleanText(value, v.maxLength ?? 80);
    if (!t && !v.optional) return;
    f.answer(q.id, t);
  };

  const toggleTag = (value: string) => {
    setTags((cur) => {
      if (has(cur, value)) return cur.filter((x) => x.toLowerCase() !== value.toLowerCase());
      if (v.exclusive && value.toLowerCase() === v.exclusive.toLowerCase()) return [v.exclusive];
      const base = v.exclusive ? cur.filter((x) => x.toLowerCase() !== v.exclusive!.toLowerCase()) : cur;
      return base.length >= tagLimit ? base : [...base, value];
    });
  };
  const addTypedTag = () => {
    const t = cleanText(text, v.maxLength ?? 40);
    if (!t) return;
    if (!has(tags, t)) toggleTag(t);
    setText("");
  };
  const submitTags = () => {
    const cleaned = cleanTags(text.trim() ? [...tags, text] : tags, v.maxLength ?? 40, tagLimit, v.exclusive);
    if (cleaned) f.answer(q.id, cleaned);
  };

  const textIn = (i: number) =>
    f.reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0, transition: { duration: 0.55, delay: 0.05 + i * 0.05, ease: [0.22, 1, 0.36, 1] as const } },
        };

  return (
    <section className="flex h-full flex-col overflow-y-auto bg-paper" aria-labelledby={headingId}>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))] md:px-12">
        <div className="h-11">
          <BackButton onClick={f.back} />
        </div>
        <m.h2 id={headingId} {...textIn(0)} className="mt-6 font-serif text-display md:mt-14">
          {v.prompt}
        </m.h2>
        {v.help && (
          <m.p {...textIn(1)} className="mt-3 text-[15px] text-muted">
            {v.help}
          </m.p>
        )}

        {isText && (
          <m.div {...textIn(2)} className="mt-8">
            {v.suggestions && v.suggestions.length > 0 && (
              <ul className="mb-6 flex flex-wrap gap-2" aria-label={v.prompt}>
                {v.suggestions.map((s) => (
                  <li key={s.value}>
                    <button
                      type="button"
                      onClick={() => submitText(s.value)}
                      className={`h-11 rounded-pill border px-4 text-[15px] font-medium transition-colors ${text === s.value ? "border-ink bg-ink text-cream" : "border-line-strong bg-white/50 text-ink hover:border-ink-soft"}`}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label htmlFor={`${q.id}-text`} className="sr-only">
              {v.prompt}
            </label>
            <div className="border-b border-ink pb-2 focus-within:shadow-[0_1px_0_0_var(--color-ink)]">
              <input
                id={`${q.id}-text`}
                name={q.id}
                autoComplete="off"
                autoCapitalize="sentences"
                enterKeyHint="next"
                maxLength={v.maxLength ?? 80}
                placeholder={v.placeholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitText(text)}
                className="w-full bg-transparent font-serif text-[1.8rem] leading-tight outline-none placeholder:text-muted-light focus-visible:outline-none"
              />
            </div>
            <div className="mt-6 flex items-center gap-4">
              <Pill disabled={!cleanText(text, v.maxLength ?? 80)} onClick={() => submitText(text)}>
                {copy.common.continue} <span aria-hidden="true">&rarr;</span>
              </Pill>
              {v.optional && (
                <button type="button" onClick={() => submitText("", true)} className="h-11 px-2 text-[15px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
                  {copy.common.skip}
                </button>
              )}
            </div>
          </m.div>
        )}

        {isTags && (
          <m.div {...textIn(2)} className="mt-8">
            <ul className="mb-6 flex flex-wrap gap-2" role="group" aria-label={v.prompt}>
              {[...(v.suggestions ?? []), ...tags.filter((t) => !(v.suggestions ?? []).some((s) => s.value.toLowerCase() === t.toLowerCase())).map((t) => ({ value: t, label: t }))].map((s) => {
                const on = has(tags, s.value);
                return (
                  <li key={s.value}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTag(s.value)}
                      className={`h-11 rounded-pill border px-4 text-[15px] font-medium transition-colors ${on ? "border-ink bg-ink text-cream" : "border-line-strong bg-white/50 text-ink hover:border-ink-soft"}`}
                    >
                      {s.label}
                    </button>
                  </li>
                );
              })}
            </ul>
            <label htmlFor={`${q.id}-text`} className="sr-only">
              {v.prompt}
            </label>
            <div className="flex items-end gap-3 border-b border-ink pb-2 focus-within:shadow-[0_1px_0_0_var(--color-ink)]">
              <input
                id={`${q.id}-text`}
                name={q.id}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="done"
                maxLength={v.maxLength ?? 40}
                placeholder={v.placeholder}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  addTypedTag();
                }}
                className="w-full bg-transparent font-serif text-[1.6rem] leading-tight outline-none placeholder:text-muted-light focus-visible:outline-none"
              />
              <button type="button" onClick={addTypedTag} disabled={!cleanText(text, v.maxLength ?? 40)} className="h-9 shrink-0 px-2 text-[15px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-40">
                {copy.common.add}
              </button>
            </div>
            <div className="mt-6 flex items-center gap-4">
              <Pill disabled={tags.length === 0 && !cleanText(text, v.maxLength ?? 40)} onClick={submitTags}>
                {copy.common.continue} <span aria-hidden="true">&rarr;</span>
              </Pill>
            </div>
          </m.div>
        )}

        {!isText && !isTags && (
          <ul className="mt-8 border-t border-line" role={q.type === "multi" ? "group" : "radiogroup"} aria-labelledby={headingId}>
            {v.options.map((o, i) => {
              const on = q.type === "multi" ? multi.includes(o.value) : picked === o.value;
              return (
                <m.li key={o.value} {...textIn(i + 2)} className="border-b border-line">
                  <button
                    type="button"
                    role={q.type === "multi" ? "checkbox" : "radio"}
                    aria-checked={on}
                    onClick={() => choose(o.value)}
                    className={`group flex min-h-[64px] w-full items-center justify-between gap-4 px-1 py-4 text-left transition-colors duration-200 ${on ? "text-ink" : "text-ink-soft hover:text-ink"}`}
                  >
                    <span className={`font-serif text-[1.55rem] leading-tight md:text-[1.9rem] ${on ? "italic" : ""}`}>{o.label}</span>
                    <span
                      aria-hidden="true"
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${on ? "border-ink bg-ink text-cream" : "border-line-strong text-transparent group-hover:border-ink-soft"}`}
                    >
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.2 3L11 1.5" stroke="currentColor" strokeWidth="1.8" /></svg>
                    </span>
                  </button>
                </m.li>
              );
            })}
          </ul>
        )}

        {showAmount && v.amountField && (
          <m.div {...textIn(0)} className="mt-8">
            <label htmlFor="budget-amount" className="block font-serif text-[1.5rem] leading-tight">
              {v.amountField.label}
            </label>
            <p id="budget-amount-help" className="mt-1 text-[14px] text-muted">{v.amountField.help}</p>
            <div className="mt-4 flex items-center gap-2 border-b border-ink pb-2 focus-within:shadow-[0_1px_0_0_var(--color-ink)]">
              <span aria-hidden="true" className="font-serif text-[1.8rem]">$</span>
              <input
                id="budget-amount"
                inputMode="numeric"
                autoComplete="off"
                aria-describedby="budget-amount-help"
                placeholder={v.amountField.placeholder}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, "").slice(0, 12))}
                onKeyDown={(e) => e.key === "Enter" && submitAmount(false)}
                className="w-full bg-transparent font-serif text-[1.8rem] outline-none placeholder:text-muted-light focus-visible:outline-none"
              />
            </div>
            <div className="mt-6 flex items-center gap-4">
              <Pill onClick={() => submitAmount(false)}>{v.amountField.continue}</Pill>
              <button type="button" onClick={() => submitAmount(true)} className="h-11 px-2 text-[15px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
                {v.amountField.skip}
              </button>
            </div>
          </m.div>
        )}

        {q.type === "multi" && (
          <div className="mt-auto pt-8">
            <Pill disabled={multi.length === 0} onClick={() => f.answer(q.id, multi)} className="w-full md:w-auto">
              {copy.common.continue} <span aria-hidden="true">&rarr;</span>
            </Pill>
          </div>
        )}
        {q.type === "single" && isAnswered(q.id, f.answers) && !showAmount && picked && (
          <div className="mt-auto pt-8">
            <button type="button" onClick={() => f.next()} className="h-11 text-[15px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
              {copy.common.continue} <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
