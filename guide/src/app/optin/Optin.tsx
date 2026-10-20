"use client";
// The opt-in page from the Guide Funnel v2 design. Name, contact, seven
// selects, then the stage page (A) or the call page (B). Leads go through the
// same API, jobs and CRM as the film funnel; the questions are its own.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { fill, optin, questionFor } from "@/lib/content";
import { cleanPhone, isOptin, roleForPromo, stageOf, type Answers, type Stage } from "@/lib/flow";
import { postJson, setApiToken, track } from "@/lib/client/api";
import { safeStorage } from "@/lib/client/storage";
import { loadPixel, pixelEvent } from "@/lib/client/pixel";
import { videoSource } from "@/lib/video/source";
import type { PublicConfig } from "@/lib/server/config";
import type { LeadView } from "@/components/funnel/context";
import { Turnstile } from "@/components/funnel/Turnstile";
import { Logo } from "@/components/funnel/ui";

const BookingEmbed = dynamic(() => import("@/components/funnel/scenes/BookingEmbed").then((x) => x.BookingEmbed), { ssr: false });
const ResultFilm = dynamic(() => import("@/components/funnel/scenes/ResultFilm").then((x) => x.ResultFilm), { ssr: false });

const STORE_KEY = "mde_guide_session";
const QUESTION_IDS = ["promo", "audience_size", "revenue", "team", "budget_v2", "decider", "heard"] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type SessionResponse = { token: string; answers: Answers; lead: LeadView | null };
type LeadResponse = { lead?: LeadView; error?: string; field?: string };
type Proof = { cases: { id: string; title: string; figures: { value: string; label: string }[] }[]; testimonial: { title: string; url: string; poster: string } | null };

function readParams() {
  const q = new URLSearchParams(window.location.search);
  const source: Record<string, string> = {};
  for (const k of ["src", "mc", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"]) {
    const v = q.get(k);
    if (v) source[k] = v.slice(0, 255);
  }
  return { source };
}

function readCookie(name: string): string | undefined {
  try {
    const m = new RegExp(`(?:^|; )${name}=([^;]*)`).exec(document.cookie);
    return m ? decodeURIComponent(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

const stageText = (format: string, s: Stage) => fill(format, { n: String(s.n), name: s.name });

export function Optin({ config, showSlots, proof }: { config: PublicConfig; showSlots: boolean; proof: Proof }) {
  const o = optin;
  const [step, setStep] = useState(0);
  const [v, setV] = useState({ first: "", last: "", email: "", cc: o.steps.contact.cc, phone: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [lead, setLead] = useState<LeadView | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const token = useRef<string | null>(null);
  const roleSent = useRef<string | null>(null);

  // A returning visitor with a lead lands straight on their page.
  useEffect(() => {
    const saved = safeStorage.get(STORE_KEY);
    let cancelled = false;
    (async () => {
      const res = await postJson<SessionResponse>("/api/session", { token: saved, source: readParams().source, force: { variant: "full", progress: "none" } }, 6000);
      if (cancelled || !res.ok || !res.data) return;
      token.current = res.data.token;
      setApiToken(res.data.token);
      safeStorage.set(STORE_KEY, res.data.token);
      if (res.data.lead && isOptin(res.data.lead.answers)) {
        setLead(res.data.lead);
        loadPixel(config.metaPixelId);
      }
      track("scene_view", { scene: "optin_name", variant: "optin", path: "none" });
    })();
    return () => {
      cancelled = true;
    };
  }, [config.metaPixelId]);

  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => {
    setV((x) => ({ ...x, [k]: e.target.value }));
    setError("");
  };

  // Each select is saved as it is answered, the role first so the server knows the path.
  const setAnswer = (id: string, value: string) => {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    setError("");
    track("question_answered", { question: id, value });
    if (!token.current) return;
    const role = roleForPromo(next.promo);
    if (!role) return;
    (async () => {
      if (roleSent.current !== role) {
        roleSent.current = role;
        await postJson("/api/answer", { token: token.current, questionId: "role", value: role });
      }
      await postJson("/api/answer", { token: token.current, questionId: id, value });
    })();
  };

  const validate = (): string => {
    if (step === 0 && (!v.first.trim() || !v.last.trim())) return o.steps.errors.name;
    if (step === 1) {
      if (!EMAIL.test(v.email.trim())) return o.steps.errors.email;
      if (!cleanPhone(`${v.cc} ${v.phone}`) || v.phone.replace(/\D/g, "").length < 6) return o.steps.errors.phone;
    }
    if (step === 2 && QUESTION_IDS.some((id) => !answers[id])) return o.steps.errors.questions;
    return "";
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (sending) return;
    const err = validate();
    if (err) {
      setError(err);
      track("gate_error", { fields: `optin_step_${step + 1}` });
      return;
    }
    if (step < 2) {
      const n = step + 1;
      setStep(n);
      track("scene_view", { scene: n === 1 ? "optin_contact" : "optin_questions", variant: "optin", path: "none" });
      if (n === 1) track("gate_view", { variant: "optin", path: "none" });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (config.turnstileSiteKey && !turnstileToken) {
      setError(o.steps.errors.bot);
      return;
    }
    setSending(true);
    if (!token.current) {
      const s = await postJson<SessionResponse>("/api/session", { source: readParams().source, force: { variant: "full", progress: "none" } }, 6000);
      if (s.ok && s.data) {
        token.current = s.data.token;
        setApiToken(s.data.token);
        safeStorage.set(STORE_KEY, s.data.token);
      }
    }
    const role = roleForPromo(answers.promo) ?? "brand";
    const res = await postJson<LeadResponse>(
      "/api/lead",
      {
        token: token.current,
        firstName: v.first.trim(),
        lastName: v.last.trim(),
        email: v.email.trim(),
        phone: cleanPhone(`${v.cc} ${v.phone}`),
        consent: true,
        consentVersion: o.consentVersion,
        turnstileToken: turnstileToken ?? undefined,
        answers: { role, ...answers },
        fbp: readCookie("_fbp"),
        fbc: readCookie("_fbc"),
      },
      20_000,
    );
    setSending(false);
    if (res.ok && res.data?.lead) {
      setLead(res.data.lead);
      loadPixel(config.metaPixelId);
      pixelEvent("Lead", res.data.lead.metaEventId, { content_category: res.data.lead.path });
      window.scrollTo(0, 0);
      return;
    }
    const key = res.status === 429 ? "rateLimited" : res.data?.error === "bot" ? "bot" : "network";
    setError(o.steps.errors[key]);
    track("gate_error", { fields: res.data?.field || res.data?.error || "network" });
    if (key === "bot") {
      setTurnstileToken(null);
      setResetKey((k) => k + 1);
    }
  };

  if (lead) return lead.qualified ? <PageB lead={lead} config={config} showSlots={showSlots} proof={proof} /> : <PageA lead={lead} />;

  const pct = `${Math.round((step / 3) * 100)}%`;
  const s = o.steps;
  const buttons = [s.name.button, s.contact.button, s.questions.button];
  return (
    <div className="op">
      <Header />
      <main className="op-main">
        <h1 className="op-h1">
          {o.hero.headlineLead}
          <span className="op-accent">{o.hero.headlineAccent}</span>
          {o.hero.headlineTail}
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="op-hero-img" src={o.hero.image} alt={o.hero.imageAlt} width={1704} height={967} />

        <form className="op-card" onSubmit={submit} noValidate>
          <div className="op-steps">
            <span>{fill(s.label, { n: String(step + 1), total: "3" })}</span>
            <span>{pct}</span>
          </div>
          <div className="op-bar"><div style={{ width: pct }} /></div>

          {step === 0 && (
            <>
              <h2 className="op-h2">{s.name.title}<span className="op-accent">{s.name.accent}</span></h2>
              <div className="op-grid2">
                <input id="op-first" name="firstName" autoComplete="given-name" value={v.first} onChange={set("first")} placeholder={s.name.first} maxLength={60} />
                <input id="op-last" name="lastName" autoComplete="family-name" value={v.last} onChange={set("last")} placeholder={s.name.last} maxLength={60} />
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="op-h2">{s.contact.title}<span className="op-accent">{s.contact.accent}</span></h2>
              <div className="op-col">
                <input id="op-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={v.email} onChange={set("email")} placeholder={s.contact.email} maxLength={200} />
                <div className="op-phone">
                  <input id="op-cc" name="cc" inputMode="tel" value={v.cc} onChange={set("cc")} placeholder={s.contact.cc} maxLength={6} aria-label="Country code" />
                  <input id="op-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" value={v.phone} onChange={set("phone")} placeholder={s.contact.phone} maxLength={24} />
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="op-h2">{s.questions.title}<span className="op-accent">{s.questions.accent}</span></h2>
              <div className="op-col op-qs">
                {QUESTION_IDS.map((id) => {
                  const q = questionFor(id, undefined);
                  if (!q) return null;
                  const missing = Boolean(error) && !answers[id];
                  return (
                    <label key={id} className="op-q">
                      <span>{q.prompt}<i className="op-accent"> *</i></span>
                      <select id={`op-${id}`} name={id} value={answers[id] ?? ""} onChange={(e) => setAnswer(id, e.target.value)} className={`${missing ? "op-missing" : ""} ${answers[id] ? "op-set" : ""}`}>
                        <option value="">{s.questions.placeholder}</option>
                        {q.options.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                    </label>
                  );
                })}
              </div>
              {config.turnstileSiteKey && <Turnstile siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} resetKey={resetKey} />}
            </>
          )}

          {error && <div className="op-error" role="alert">{error}</div>}

          <div className="op-actions">
            <button type="submit" className="op-btn" disabled={sending}>
              {sending ? s.questions.sending : buttons[step]}
              {sending && <span className="op-spin" aria-hidden="true" />}
            </button>
            {step === 0 && <div className="op-note">{s.name.note}</div>}
            {step > 0 && !sending && (
              <button type="button" className="op-back" onClick={() => { setStep(step - 1); setError(""); }}>{s.back}</button>
            )}
          </div>
        </form>

        <div className="op-trust">
          {o.trust.map((t) => <div key={t}><span className="op-accent">&#10022;</span> {t}</div>)}
        </div>
        <Legal />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="op-header">
      <Logo />
    </header>
  );
}

function Legal() {
  const l = optin.legal;
  const [a, rest] = l.consent.split("{privacy}");
  const [b, c] = (rest ?? "").split("{terms}");
  return (
    <p className="op-legal">
      {a}<a href={l.privacyUrl} target="_blank" rel="noopener noreferrer">{l.privacy}</a>{b}<a href={l.termsUrl} target="_blank" rel="noopener noreferrer">{l.terms}</a>{c}
    </p>
  );
}

function Footer({ disclaimer }: { disclaimer?: boolean }) {
  const l = optin.legal;
  return (
    <footer className="op-footer">
      <div className="op-footer-links">
        <a href={l.privacyUrl} target="_blank" rel="noopener noreferrer">{l.privacy}</a><span>&middot;</span>
        <a href={l.termsUrl} target="_blank" rel="noopener noreferrer">{l.terms}</a><span>&middot;</span>
        <span>{l.copyright}</span>
      </div>
      {disclaimer && <p>{l.disclaimer}</p>}
    </footer>
  );
}

function StageTable({ stage }: { stage: Stage | null }) {
  const st = optin.stages;
  return (
    <div className="op-table-wrap">
      <div className="op-table">
        <div className="op-thead">{st.columns.map((c) => <div key={c}>{c}</div>)}</div>
        {st.items.map((r) => (
          <div key={r.n} className={`op-tr${stage && r.n === stage.n ? " on" : ""}`}>
            <div className="op-td op-stage"><span className="op-n">{r.n}</span><span className="op-name">{r.name}</span></div>
            <div className="op-td">{r.looks}</div>
            <div className="op-td">{r.constraint}</div>
            <div className="op-td">{r.up}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Page A: under the line. Check your email, your stage, and the interactive guide. */
function PageA({ lead }: { lead: LeadView }) {
  const a = optin.pageA;
  const stage = stageOf(lead.answers);
  useEffect(() => {
    track("result_view", { path: lead.path, qualified: false, page: "A" });
  }, [lead.path]);
  return (
    <div className="op">
      <Header />
      <main className="op-main op-center">
        <h1 className="op-h1 op-h1-sm">{a.headline}</h1>
        {stage && <div className="op-stage-line">{a.stageLead}<b>{stageText(a.stageFormat, stage)}</b></div>}
        <StageTable stage={stage} />
        <p className="op-body">{a.body}</p>
        <a className="op-btn op-btn-inline" href={a.buttonUrl}>{a.button}</a>
      </main>
      <Footer />
    </div>
  );
}

/* Page B: at or above the line. The stage film, the call, proof, the objections and the FAQ. */
function PageB({ lead, config, showSlots, proof }: { lead: LeadView; config: PublicConfig; showSlots: boolean; proof: Proof }) {
  const b = optin.pageB;
  const stage = stageOf(lead.answers);
  const film = useMemo(() => videoSource(b.video), [b.video]);
  const [open, setOpen] = useState(0);
  useEffect(() => {
    track("result_view", { path: lead.path, qualified: true, page: "B" });
  }, [lead.path]);
  const goBooking = () => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const objections = b.objections.items.filter((x) => x.video || showSlots);
  const faq = b.faq;
  return (
    <div className="op">
      <Header />
      <main className="op-b">
        <section className="op-section op-center">
          <h1 className="op-h1 op-h1-sm">
            {b.headlineLead}
            {stage && <span className="op-accent">{stageText(b.stageFormat, stage)}</span>}
          </h1>
          <div className="op-film">
            {film ? <ResultFilm src={film} /> : showSlots ? <div className="op-slot">[VIDEO] {stage ? fill(b.videoKicker, { n: String(stage.n) }) : b.videoKicker}</div> : null}
          </div>
          <div className="op-b-cta">
            <button type="button" className="op-btn" onClick={goBooking}>{b.bookButton}</button>
            <a className="op-quiet" href={`/g/${lead.guideToken}`}>{b.guideLink}</a>
          </div>
        </section>

        <section id="booking" className="op-section op-booking op-center">
          <div className="op-kicker">{b.booking.kicker}</div>
          <h2 className="op-h2 op-h2-lg">{b.booking.headlineLead}<span className="op-accent">{b.booking.headlineAccent}</span>{b.booking.headlineTail}</h2>
          <div className="op-note-box">{b.booking.note}</div>
          <div className="op-card op-card-left">
            <div className="op-card-title">{b.booking.title}</div>
            <p className="op-card-body">{b.booking.body}</p>
            {config.calBookingUrl ? (
              <BookingEmbed lead={lead} bookingUrl={config.calBookingUrl} redirectUrl={config.calBookedRedirectUrl} />
            ) : (
              <div className="op-slot op-slot-cal">[CAL.COM CALENDAR EMBED]</div>
            )}
          </div>
        </section>

        <section className="op-section op-center">
          <div className="op-pill">{b.reviews.kicker}</div>
          <h2 className="op-h2 op-h2-lg">{b.reviews.headline}<em>{b.reviews.headlineAccent}</em></h2>
          <p className="op-body">{b.reviews.body}</p>
          <div className="op-reviews">
            {proof.testimonial && (
              <a className="op-review op-review-video" href={proof.testimonial.url} target="_blank" rel="noopener noreferrer">
                <div className="op-review-frame" style={proof.testimonial.poster ? { backgroundImage: `url(${proof.testimonial.poster})` } : undefined}>
                  <span className="op-play" aria-hidden="true" />
                  <span className="op-kicker op-kicker-gold">{b.reviews.testimonialLabel}</span>
                </div>
                <div className="op-stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                <div className="op-review-who">{proof.testimonial.title}</div>
              </a>
            )}
            {proof.cases.map((c) => (
              <div key={c.id} className="op-review">
                <div className="op-stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
                <div className="op-review-title">{c.title}</div>
                <div className="op-kpis">
                  {c.figures.map((f) => <div key={f.label}><b>{f.value}</b><span>{f.label}</span></div>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        {objections.length > 0 && (
          <section className="op-section op-center">
            <div className="op-kicker">{b.objections.kicker}</div>
            <h2 className="op-h2 op-h2-lg">{b.objections.headlineLead}<span className="op-accent">{b.objections.headlineAccent}</span></h2>
            <p className="op-body">{b.objections.body}</p>
            <div className="op-objections">
              {objections.map((x) => (
                <div key={x.q} className="op-objection">
                  {x.video ? (
                    <video controls playsInline preload="none" poster={`https://image.mux.com/${x.video}/thumbnail.jpg?width=960`} src={`https://stream.mux.com/${x.video}/highest.mp4`} />
                  ) : (
                    <div className="op-slot">[VIDEO]</div>
                  )}
                  <div className="op-objection-q">&ldquo;{x.q}&rdquo;</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="op-section op-faq-wrap">
          <div className="op-faq">
            {faq.items.map((f, i) => (
              <div key={f.q} className="op-faq-item">
                <button type="button" className="op-faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                  <span>{f.q}</span><span className="op-accent" aria-hidden="true">{open === i ? "−" : "+"}</span>
                </button>
                {open === i && (
                  <div className="op-faq-a">
                    {f.a.map((p, j) => {
                      if (p === "{minimum}") return faq.minimum && "minimumLine" in f ? <div key={j}>{fill(f.minimumLine as string, { minimum: faq.minimum })}</div> : null;
                      return <div key={j}>{p}</div>;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer disclaimer />
    </div>
  );
}
