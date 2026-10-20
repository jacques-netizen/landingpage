"use client";
// The opt-in page from the Guide Funnel v2 design, cut to two steps. Name,
// then email and WhatsApp number, then the thanks page: the film, the call,
// the proof and the video FAQ. Leads go through the same API, jobs and CRM
// as the film funnel.
import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { fill, optin } from "@/lib/content";
import { cleanPhone, type Answers } from "@/lib/flow";
import { postJson, setApiToken, track } from "@/lib/client/api";
import { safeStorage } from "@/lib/client/storage";
import { loadPixel, pixelEvent } from "@/lib/client/pixel";
import type { PublicConfig } from "@/lib/server/config";
import type { LeadView } from "@/components/funnel/context";
import { Turnstile } from "@/components/funnel/Turnstile";
import { Logo } from "@/components/funnel/ui";
import { MuxPlayer } from "./MuxPlayer";

const BookingEmbed = dynamic(() => import("@/components/funnel/scenes/BookingEmbed").then((x) => x.BookingEmbed), { ssr: false });

const STORE_KEY = "mde_guide_session";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type SessionResponse = { token: string; answers: Answers; lead: LeadView | null };
type LeadResponse = { lead?: LeadView; error?: string; field?: string };
export type Proof = {
  logos: { name: string; src: string }[];
  cases: { id: string; title: string; figures: { value: string; label: string }[]; clip: string; poster: string }[];
  testimonial: { title: string; url: string; poster: string } | null;
};

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

export function Optin({ config, showSlots, proof, filmId }: { config: PublicConfig; showSlots: boolean; proof: Proof; filmId: string | null }) {
  const o = optin;
  const [step, setStep] = useState(0);
  const [v, setV] = useState({ first: "", last: "", email: "", cc: o.steps.contact.cc, phone: "" });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [lead, setLead] = useState<LeadView | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const token = useRef<string | null>(null);

  // A returning visitor who already left their details lands on the thanks page.
  useEffect(() => {
    const saved = safeStorage.get(STORE_KEY);
    let cancelled = false;
    (async () => {
      const res = await postJson<SessionResponse>("/api/session", { token: saved, source: readParams().source, force: { variant: "full", progress: "none" } }, 6000);
      if (cancelled || !res.ok || !res.data) return;
      token.current = res.data.token;
      setApiToken(res.data.token);
      safeStorage.set(STORE_KEY, res.data.token);
      if (res.data.lead) {
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

  const validate = (): string => {
    if (step === 0 && (!v.first.trim() || !v.last.trim())) return o.steps.errors.name;
    if (step === 1) {
      if (!EMAIL.test(v.email.trim())) return o.steps.errors.email;
      if (!cleanPhone(`${v.cc} ${v.phone}`) || v.phone.replace(/\D/g, "").length < 6) return o.steps.errors.phone;
    }
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
    if (step === 0) {
      setStep(1);
      track("scene_view", { scene: "optin_contact", variant: "optin", path: "none" });
      track("gate_view", { variant: "optin", path: "none" });
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
        answers: { role: o.defaultRole },
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

  if (lead) return <Thanks lead={lead} config={config} showSlots={showSlots} proof={proof} filmId={filmId} />;

  const pct = `${Math.round((step / 2) * 100)}%`;
  const s = o.steps;
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
            <span>{fill(s.label, { n: String(step + 1), total: "2" })}</span>
            <span>{pct}</span>
          </div>
          <div className="op-bar"><div style={{ width: pct }} /></div>

          {step === 0 ? (
            <>
              <h2 className="op-h2">{s.name.title}<span className="op-accent">{s.name.accent}</span></h2>
              <div className="op-grid2">
                <input id="op-first" name="firstName" autoComplete="given-name" value={v.first} onChange={set("first")} placeholder={s.name.first} maxLength={60} />
                <input id="op-last" name="lastName" autoComplete="family-name" value={v.last} onChange={set("last")} placeholder={s.name.last} maxLength={60} />
              </div>
            </>
          ) : (
            <>
              <h2 className="op-h2">{s.contact.title}<span className="op-accent">{s.contact.accent}</span></h2>
              <div className="op-col">
                <input id="op-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={v.email} onChange={set("email")} placeholder={s.contact.email} maxLength={200} />
                <div className="op-phone">
                  <input id="op-cc" name="cc" inputMode="tel" value={v.cc} onChange={set("cc")} placeholder={s.contact.cc} maxLength={6} aria-label="Country code" />
                  <input id="op-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" value={v.phone} onChange={set("phone")} placeholder={s.contact.phone} maxLength={24} />
                </div>
              </div>
              {config.turnstileSiteKey && <Turnstile siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} resetKey={resetKey} />}
            </>
          )}

          {error && <div className="op-error" role="alert">{error}</div>}

          <div className="op-actions">
            <button type="submit" className="op-btn" disabled={sending}>
              {sending ? s.sending : step === 0 ? s.name.button : s.contact.button}
              {sending && <span className="op-spin" aria-hidden="true" />}
            </button>
            {step > 0 && !sending && (
              <button type="button" className="op-back" onClick={() => { setStep(0); setError(""); }}>{s.back}</button>
            )}
          </div>
        </form>

        <div className="op-trust">
          {o.trust.map((t) => <div key={t}><span className="op-accent">&#10022;</span> {t}</div>)}
        </div>
        <Legal />
        <Clients proof={proof} />
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

/** A campaign clip that plays, muted, while it is on screen. */
function Loop({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      el.muted = true;
      if (e.isIntersecting) {
        if (!el.getAttribute("src")) el.src = src;
        el.play().catch(() => {});
      } else el.pause();
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [src]);
  return <video ref={ref} muted loop playsInline preload="none" poster={poster} aria-hidden="true" />;
}

/* Under the form: the logos, the campaign clips with their numbers, the testimonial. */
function Clients({ proof }: { proof: Proof }) {
  const c = optin.clients;
  return (
    <section className="op-clients">
      <div className="op-kicker">{c.kicker}</div>
      <h2 className="op-h2 op-h2-lg">{c.headline}</h2>
      <p className="op-body">{c.body}</p>
      {proof.logos.length > 0 && (
        <div className="op-logos">
          {proof.logos.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={l.name} src={l.src} alt={l.name} />
          ))}
        </div>
      )}
      <div className="op-cases">
        {proof.cases.map((x) => (
          <div key={x.id} className="op-case">
            <div className="op-phone-frame"><Loop src={x.clip} poster={x.poster} /></div>
            <div className="op-case-title">{x.title}</div>
            <div className="op-kpis">{x.figures.map((f) => <div key={f.label}><b>{f.value}</b><span>{f.label}</span></div>)}</div>
          </div>
        ))}
      </div>
      {proof.testimonial && (
        <a className="op-testimonial" href={proof.testimonial.url} target="_blank" rel="noopener noreferrer">
          <div className="op-review-frame" style={proof.testimonial.poster ? { backgroundImage: `url(${proof.testimonial.poster})` } : undefined}>
            <span className="op-play" aria-hidden="true" />
          </div>
          <div>
            <div className="op-stars" aria-hidden="true">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
            <div className="op-review-title">{proof.testimonial.title}</div>
            <div className="op-review-who">{c.testimonialLabel}</div>
          </div>
        </a>
      )}
    </section>
  );
}

/* The thanks page: the film, the call, the proof, the video FAQ. */
function Thanks({ lead, config, showSlots, proof, filmId }: { lead: LeadView; config: PublicConfig; showSlots: boolean; proof: Proof; filmId: string | null }) {
  const b = optin.pageB;
  useEffect(() => {
    track("result_view", { path: lead.path, qualified: lead.qualified, page: "thanks" });
  }, [lead.path, lead.qualified]);
  const goBooking = () => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const reviews = b.reviews.items as { name: string; who: string; text: string; stars?: number }[];
  return (
    <div className="op">
      <Header />
      <main className="op-b">
        <section className="op-section op-center">
          <h1 className="op-h1 op-h1-sm">{b.headline}</h1>
          <p className="op-body">{b.sub}</p>
          <div className="op-film">
            {filmId ? <MuxPlayer id={filmId} label={b.videoLabel} /> : showSlots ? <div className="op-slot">[VIDEO]</div> : null}
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
                <div className="op-kpis">{c.figures.map((f) => <div key={f.label}><b>{f.value}</b><span>{f.label}</span></div>)}</div>
              </div>
            ))}
            {reviews.map((r, i) => (
              <div key={i} className="op-review">
                <div className="op-stars" aria-hidden="true">{"★".repeat(Math.max(1, Math.min(5, r.stars ?? 5)))}</div>
                <div className="op-review-text">{r.text}</div>
                <div className="op-review-who">{r.name} &middot; {r.who}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="op-section op-center op-faq-wrap">
          <div className="op-kicker">{b.faqVideos.kicker}</div>
          <h2 className="op-h2 op-h2-lg">{b.faqVideos.headlineLead}<span className="op-accent">{b.faqVideos.headlineAccent}</span></h2>
          <p className="op-body">{b.faqVideos.body}</p>
          <div className="op-faq-videos">
            {b.faqVideos.items.map((x) => (
              <div key={x.q} className="op-faq-video">
                {x.video ? <MuxPlayer id={x.video} portrait label={x.q} /> : <div className="op-phone-frame op-slot-portrait"><span className="op-play" aria-hidden="true" /><span>{showSlots ? "[VIDEO]" : "Soon"}</span></div>}
                <div className="op-objection-q">&ldquo;{x.q}&rdquo;</div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer disclaimer />
    </div>
  );
}
