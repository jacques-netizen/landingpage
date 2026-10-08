"use client";
import { useRef, useState, type FormEvent } from "react";
import { m } from "framer-motion";
import { copy, questionFor, type Step } from "@/lib/content";
import { track } from "@/lib/client/api";
import { useFunnel } from "../context";
import { Turnstile } from "../Turnstile";
import { BackButton, Pill } from "../ui";

type Field = "firstName" | "email" | "igHandle" | "company" | "role" | "consent";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function GateScene({ step }: { step: Step }) {
  const f = useFunnel();
  const g = copy.gate;
  const roleSelect = Boolean(step.roleSelect);
  const roleOptions = questionFor("role", undefined)?.options ?? [];
  const [values, setValues] = useState({ firstName: f.firstName ?? "", email: "", igHandle: "", company: "", role: (f.answers.role as string) || "" });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field | "form", string>>>({});
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const needsCompany = f.answers.deciding === "yes";

  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const validate = () => {
    const e: Partial<Record<Field, string>> = {};
    if (roleSelect && !values.role) e.role = g.errors.role;
    if (!values.firstName.trim()) e.firstName = g.errors.firstName;
    if (!EMAIL.test(values.email.trim())) e.email = g.errors.email;
    if (needsCompany && !values.company.trim()) e.company = g.errors.company;
    if (!consent) e.consent = g.errors.consent;
    return e;
  };

  const focusFirst = (e: Partial<Record<string, string>>) => {
    const first = Object.keys(e).find((k) => k !== "form");
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      track("gate_error", { fields: Object.keys(e).join(",") });
      focusFirst(e);
      return;
    }
    if (f.config.turnstileSiteKey && !turnstileToken) {
      setErrors({ form: g.errors.bot });
      track("gate_error", { fields: "bot_pending" });
      return;
    }
    setBusy(true);
    const res = await f.submitGate({
      firstName: values.firstName.trim(),
      email: values.email.trim(),
      igHandle: values.igHandle.trim(),
      company: needsCompany ? values.company.trim() : "",
      role: roleSelect ? values.role : undefined,
      consent,
      turnstileToken: turnstileToken ?? undefined,
    });
    setBusy(false);
    if (res.ok) {
      f.next();
      return;
    }
    const key = (res.error in g.errors ? res.error : "network") as keyof typeof g.errors;
    const fe = res.field && res.field in g.errors ? { [res.field]: g.errors[res.field as keyof typeof g.errors] } : { form: g.errors[key] };
    setErrors(fe);
    track("gate_error", { fields: res.field || res.error });
    if (key === "bot") {
      setTurnstileToken(null);
      setResetKey((k) => k + 1);
    }
    focusFirst(fe);
  };

  const input =
    "mt-2 block h-14 w-full rounded-none border-0 border-b border-ink/40 bg-transparent px-0 font-serif text-[1.6rem] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-muted-light focus:border-ink focus:shadow-[0_1px_0_0_var(--color-ink)] focus-visible:outline-none aria-[invalid=true]:border-proof-2";
  const label = "block text-[14px] font-medium text-ink-soft";
  const err = (k: Field) =>
    errors[k] ? (
      <p id={`${k}-error`} className="mt-2 text-[14px] text-proof-2">
        {errors[k]}
      </p>
    ) : null;

  return (
    <section className="h-full overflow-y-auto bg-paper-deep">
      <div className="mx-auto w-full max-w-2xl px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))] md:px-12">
        <div className="h-11">{!roleSelect && <BackButton onClick={f.back} />}</div>
        <m.h2
          initial={{ opacity: 0, y: f.reduced ? 0 : 14 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
          className="mt-6 font-serif text-display md:mt-12"
        >
          {roleSelect ? g.plainHeadline : g.headline}
        </m.h2>
        <p className="mt-4 max-w-[38ch] text-lead text-muted">{roleSelect ? g.plainBody : g.body}</p>

        <form ref={formRef} noValidate onSubmit={onSubmit} className="mt-10 space-y-8">
          {roleSelect && (
            <div>
              <label htmlFor="role" className={label}>{g.fields.role.label}</label>
              <select
                id="role"
                name="role"
                value={values.role}
                onChange={set("role")}
                aria-invalid={Boolean(errors.role)}
                aria-describedby={errors.role ? "role-error" : undefined}
                className={`${input} appearance-none text-[1.3rem]`}
              >
                <option value="">{g.fields.role.placeholder}</option>
                {roleOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {err("role")}
            </div>
          )}
          <div>
            <label htmlFor="firstName" className={label}>{g.fields.firstName.label}</label>
            <input id="firstName" name="firstName" autoComplete={g.fields.firstName.autocomplete} value={values.firstName} onChange={set("firstName")} maxLength={60}
              aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? "firstName-error" : undefined} className={input} />
            {err("firstName")}
          </div>
          <div>
            <label htmlFor="email" className={label}>{g.fields.email.label}</label>
            <input id="email" name="email" type="email" inputMode="email" autoComplete={g.fields.email.autocomplete} value={values.email} onChange={set("email")} maxLength={200}
              autoCapitalize="none" spellCheck={false}
              aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} className={input} />
            {err("email")}
          </div>
          <div>
            <label htmlFor="igHandle" className={label}>
              {g.fields.igHandle.label} <span className="font-normal text-muted">({g.fields.igHandle.hint})</span>
            </label>
            <input id="igHandle" name="igHandle" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder={g.fields.igHandle.placeholder}
              value={values.igHandle} onChange={set("igHandle")} maxLength={40} className={input} />
          </div>
          {needsCompany && (
            <div>
              <label htmlFor="company" className={label}>{g.fields.company.label}</label>
              <input id="company" name="company" autoComplete={g.fields.company.autocomplete} value={values.company} onChange={set("company")} maxLength={120}
                aria-invalid={Boolean(errors.company)} aria-describedby={errors.company ? "company-error" : undefined} className={input} />
              {err("company")}
            </div>
          )}

          <div>
            <label className="flex cursor-pointer items-start gap-4">
              <input
                type="checkbox"
                name="consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                aria-invalid={Boolean(errors.consent)}
                aria-describedby={errors.consent ? "consent-error" : undefined}
                className="mt-1 h-5 w-5 shrink-0 accent-ink"
              />
              <span className="text-[15px] leading-relaxed text-ink-soft">
                {g.consent.text}{" "}
                {g.consent.linkLead}{" "}
                <a href={copy.brand.privacyUrl} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-4">
                  {copy.brand.privacyLabel}
                </a>
                .
              </span>
            </label>
            {err("consent")}
          </div>

          {f.config.turnstileSiteKey && <Turnstile siteKey={f.config.turnstileSiteKey} onToken={setTurnstileToken} resetKey={resetKey} />}

          {errors.form && (
            <p role="alert" className="text-[15px] text-proof-2">
              {errors.form}
            </p>
          )}

          <Pill type="submit" disabled={busy} aria-busy={busy} className="w-full md:w-auto md:min-w-[240px]">
            {busy ? g.submitting : g.submit} {!busy && <span aria-hidden="true">&rarr;</span>}
          </Pill>
        </form>
      </div>
    </section>
  );
}
