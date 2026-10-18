"use client";
// The seven secrets, as one scrolling page of things to play with. Every
// number and line of copy comes from content/secrets.json.
import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import content from "../../../content/secrets.json";
import type { ProofItem } from "@/lib/content";
import { Logo } from "@/components/funnel/ui";

const CalInline = dynamic(() => import("./CalInline").then((x) => x.CalInline), { ssr: false });

type Clips = typeof content.clips;
type ClipId = keyof Clips;
type Case = (typeof content.cases.items)[number] & { item: ProofItem };

const S = content.secrets;
const byId = <T extends { id: string }>(id: string, list: T[]) => list.find((x) => x.id === id)!;

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
function short(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
}
const money = (n: number) => `$${fmt(n)}`;

/** True once the element has been on screen (or always, when observers are missing). */
function useInView<T extends Element>(threshold = 0.25, once = true) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(() => setInView(true), 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) setInView(false);
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, once]);
  return [ref, inView] as const;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function CountUp({ value, prefix = "", suffix = "", format = fmt }: { value: number; prefix?: string; suffix?: string; format?: (n: number) => string }) {
  const [ref, inView] = useInView<HTMLSpanElement>(0.5);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduced()) {
      const t = window.setTimeout(() => setN(value), 0);
      return () => window.clearTimeout(t);
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1400);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  return (
    <span ref={ref} className="sx-num">
      {prefix}
      {format(n)}
      {suffix}
    </span>
  );
}

/** A muted looping clip in a phone frame. Plays only while on screen. A missing clip is hidden, or marked with ?slots=1. */
function Clip({ id, slots, label, small }: { id: string | null; slots: boolean; label?: string; small?: boolean }) {
  const clip = id ? (content.clips as Record<string, Clips[ClipId] | undefined>)[id] : undefined;
  const [ref, inView] = useInView<HTMLDivElement>(0.2, false);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = true;
    if (inView) v.play().catch(() => {});
    else v.pause();
  }, [inView]);
  if (!clip) {
    if (!slots) return null;
    return (
      <div className={`sx-phone sx-slot${small ? " sm" : ""}`}>
        <span>[CLIP]{label ? ` ${label}` : ""}</span>
      </div>
    );
  }
  return (
    <div ref={ref} className={`sx-phone${small ? " sm" : ""}`}>
      <video ref={video} src={inView ? clip.src : undefined} poster={clip.poster} muted loop playsInline preload="none" aria-hidden="true" />
    </div>
  );
}

/** A per secret video from Mux, hidden until a playback id is set. */
function SlotVideo({ id, slots, label }: { id: string | null; slots: boolean; label: string }) {
  if (!id) return slots ? <div className="sx-video sx-slot"><span>[VIDEO] {label}</span></div> : null;
  return (
    <div className="sx-video">
      <video controls playsInline preload="none" poster={`https://image.mux.com/${id}/thumbnail.jpg?width=960`} src={`https://stream.mux.com/${id}/highest.mp4`} />
    </div>
  );
}

function Section({ id, n, title, lead, children, alt }: { id: string; n: string; title: string; lead: string; children: ReactNode; alt?: boolean }) {
  return (
    <section className={`section${alt ? " alt" : ""}`} id={id} data-secret={id}>
      <div className="wrap">
        <div className="snum">Secret {n}</div>
        <h2 className="sx-h2">{title}</h2>
        <p className="lead">{lead}</p>
        {children}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- progress */

function Progress() {
  const [current, setCurrent] = useState(-1);
  useEffect(() => {
    const els = S.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) if (e.isIntersecting) setCurrent(S.findIndex((s) => s.id === e.target.id));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  if (current < 0) return null;
  const left = S.slice(current).reduce((a, s) => a + s.minutes, 0);
  const p = content.progress;
  return (
    <div className="sx-progress" role="status" aria-live="polite">
      <div className="sx-progress-bar"><span style={{ width: `${((current + 1) / S.length) * 100}%` }} /></div>
      <span>{fill(p.label, { n: current + 1, total: S.length })}</span>
      <span className="m">{current === S.length - 1 ? p.almostDone : fill(p.minutesLeft, { m: left })}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- opening */

function Opening({ slots }: { slots: boolean }) {
  const o = content.opening;
  return (
    <header className="sx-open">
      <div className="sx-wall" aria-hidden="true">
        {o.wall.map((id, i) => (
          <Clip key={i} id={id} slots={slots} small />
        ))}
      </div>
      <div className="sx-open-shade" aria-hidden="true" />
      <div className="sx-open-top"><Logo light /></div>
      <div className="sx-open-text">
        <span className="label">{o.kicker}</span>
        <h1>{o.headline}</h1>
        <p className="hero-sub">{o.sub}</p>
        <p className="sx-counter">
          <CountUp value={o.counterValue} format={short} />
          <small>{o.counterLabel}</small>
        </p>
        <span className="scrollcue">{o.scroll}</span>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- 1 ceiling */

function Ceiling({ slots }: { slots: boolean }) {
  const s = byId("ceiling", S) as (typeof S)[0];
  const t = s.test!;
  const [phase, setPhase] = useState<"idle" | "testing" | "pushed" | "stopped">("idle");
  const [tries, setTries] = useState(0);
  const post = () => {
    setPhase("testing");
    const next = tries + 1;
    setTries(next);
    // First post makes it, the second stalls, then it is a coin flip: that is the point.
    const pushed = next === 1 ? true : next === 2 ? false : Math.random() > 0.5;
    window.setTimeout(() => setPhase(pushed ? "pushed" : "stopped"), reduced() ? 50 : 1600);
  };
  const sl = s.slider!;
  const lmin = Math.log(sl.min), lmax = Math.log(sl.max);
  const [pos, setPos] = useState((Math.log(sl.default) - lmin) / (lmax - lmin));
  const followers = Math.exp(lmin + pos * (lmax - lmin));
  // Never close the gap: the outer circle is everyone; yours grows on a log scale but tops out well inside it.
  const r = 10 + 82 * pos;
  return (
    <Section id={s.id} n={s.number} title={s.title} lead={s.lead}>
      <SlotVideo id={s.video} slots={slots} label={s.title} />
      <div className="sx-two">
        <div className="sx-panel">
          <span className="label">{t.label}</span>
          <div className={`sx-test ${phase}`}>
            <div className="sx-test-circle"><span className="sx-test-post" /></div>
            <div className="sx-meter"><span className="cl">{t.meter}</span><div><i /></div></div>
            <p className="sx-test-msg" aria-live="polite">
              {phase === "testing" ? t.testing : phase === "pushed" ? t.pushed : phase === "stopped" ? t.stopped : " "}
            </p>
          </div>
          <button type="button" className="btn" onClick={post} disabled={phase === "testing"}>{tries ? t.again : t.button}</button>
        </div>
        <div className="sx-panel">
          <div className="ctrl-head"><span className="cl">{sl.label}</span><span className="cv">{short(followers)}</span></div>
          <input type="range" min={0} max={1000} value={Math.round(pos * 1000)} aria-label={sl.label} style={{ "--p": `${pos * 100}%` } as React.CSSProperties} onChange={(e) => setPos(Number(e.target.value) / 1000)} />
          <svg viewBox="0 0 300 300" className="sx-circles" role="img" aria-label={sl.gap}>
            <circle cx="150" cy="150" r="140" className="all" />
            <circle cx="150" cy="150" r={r} className="you" />
            <text x="150" y="28" textAnchor="middle">{sl.everyone}</text>
            <text x="150" y={154} textAnchor="middle" className="v">{sl.yours}</text>
          </svg>
          <p className="model-note">{sl.gap}</p>
        </div>
      </div>
      {s.body.map((b, i) => <p key={i} className="body-lg sx-body">{b}</p>)}
    </Section>
  );
}

/* ---------------------------------------------------------------- 2 everywhere */

function Everywhere({ slots }: { slots: boolean }) {
  const s = byId("everywhere", S) as (typeof S)[1];
  const f = s.feed!;
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const pg = s.pages!;
  const [pages, setPages] = useState(pg.default);
  const tiles = 50;
  const per = Math.max(1, Math.ceil(pg.max / tiles));
  const lit = Math.min(tiles, Math.ceil(pages / per));
  const same = s.same!;
  const hasSame = same.clips.some(Boolean) || slots;
  return (
    <Section id={s.id} n={s.number} title={s.title} lead={s.lead} alt>
      <SlotVideo id={s.video} slots={slots} label={s.title} />
      <div className="sx-two">
        <div className="sx-panel">
          <span className="label">{f.label}</span>
          <div className="sx-feed">
            {f.clips.map((id, i) => (
              <button key={i} type="button" className="sx-feed-item" onClick={() => setRevealed((r) => ({ ...r, [i]: !r[i] }))} aria-pressed={Boolean(revealed[i])}>
                <Clip id={id} slots={slots} />
                {revealed[i] && (
                  <span className="sx-reveal">
                    <b>{f.posters[i]}</b>
                    {f.brand}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="model-note">{f.note}</p>
        </div>
        <div className="sx-panel">
          <div className="ctrl-head"><span className="cl">{pg.label}</span><span className="cv">{pages} {pages === 1 ? pg.one : pg.many}</span></div>
          <input type="range" min={pg.min} max={pg.max} value={pages} aria-label={pg.label} style={{ "--p": `${((pages - pg.min) / (pg.max - pg.min)) * 100}%` } as React.CSSProperties} onChange={(e) => setPages(Number(e.target.value))} />
          <div className="sx-tiles">
            {Array.from({ length: tiles }, (_, i) => (
              <span key={i} className={i < lit ? "on" : ""}>{i < lit ? short(pg.perPage * Math.min(per, Math.max(1, pages - i * per))) : ""}</span>
            ))}
          </div>
          <div className="out" style={{ marginTop: "1.2rem" }}>
            <div className="o big"><div className="ov">{short(pages * pg.perPage)}</div><div className="ol">{fill(pg.total, { per: short(pg.perPage) })}</div></div>
          </div>
        </div>
      </div>
      {hasSame && (
        <div className="sx-panel sx-wide">
          <span className="label">{same.label}</span>
          <div className="sx-six">{same.clips.map((id, i) => <Clip key={i} id={id} slots={slots} label={`page ${i + 1}`} small />)}</div>
          <p className="model-note">{same.caption}</p>
        </div>
      )}
      {s.body.map((b, i) => <p key={i} className="body-lg sx-body">{b}</p>)}
    </Section>
  );
}

/* ---------------------------------------------------------------- 3 ads */

function Ads({ slots }: { slots: boolean }) {
  const s = byId("ads", S) as (typeof S)[2];
  const c = s.calc!;
  const [raw, setRaw] = useState(String(c.default));
  const [stopped, setStopped] = useState(false);
  const budget = Math.max(0, Math.min(10_000_000, Number(raw.replace(/[^\d]/g, "")) || 0));
  const views = (cpm: number) => (budget / cpm) * 1000;
  const ads = [views(c.adsCpm[1]), views(c.adsCpm[0])];
  const clip = [views(c.clipCpm[1]), views(c.clipCpm[0])];
  const maxBar = clip[1] || 1;
  const midAds = views((c.adsCpm[0] + c.adsCpm[1]) / 2);
  const midClip = views((c.clipCpm[0] + c.clipCpm[1]) / 2);
  // Cumulative views month by month. Ads stop the day the spend does; clips keep collecting.
  const series = (() => {
    const a: number[] = [], k: number[] = [];
    let ca = 0, ck = 0, live = 0;
    for (let m = 1; m <= c.months; m++) {
      const spending = !stopped || m <= 3;
      ca += spending ? midAds : 0;
      live = (spending ? midClip : 0) + live * c.carry;
      ck += live;
      a.push(ca);
      k.push(ck);
    }
    return { a, k };
  })();
  const top = Math.max(1, ...series.k, ...series.a);
  const pt = (arr: number[]) => arr.map((v, i) => `${20 + (i / (c.months - 1)) * 260},${150 - (v / top) * 130}`).join(" ");
  return (
    <Section id={s.id} n={s.number} title={s.title} lead={s.lead}>
      <SlotVideo id={s.video} slots={slots} label={s.title} />
      <div className="model">
        <label className="ctrl-head" htmlFor="sx-budget"><span className="cl">{c.label}</span></label>
        <div className="sx-money"><span>$</span><input id="sx-budget" inputMode="numeric" value={raw} onChange={(e) => setRaw(e.target.value.replace(/[^\d,]/g, "").slice(0, 10))} /></div>
        <div className="sx-bars">
          <div className="sx-bar"><span className="n">{c.adsLabel} <small>${c.adsCpm[0]} to ${c.adsCpm[1]} {c.per}</small></span><div><i style={{ width: `${(ads[1] / maxBar) * 100}%` }} className="ads" /></div><span className="v">{short(ads[0])} to {short(ads[1])} {c.views}</span></div>
          <div className="sx-bar"><span className="n">{c.clipLabel} <small>${c.clipCpm[0]} to ${c.clipCpm[1]} {c.per}</small></span><div><i style={{ width: `${(clip[1] / maxBar) * 100}%` }} /></div><span className="v">{short(clip[0])} to {short(clip[1])} {c.views}</span></div>
        </div>
        <button type="button" className="btn ghost" onClick={() => setStopped((x) => !x)} aria-pressed={stopped}>{stopped ? c.resume : c.stop}</button>
        <svg viewBox="0 0 300 170" className="sx-chart" role="img" aria-label={c.chartNote}>
          {stopped && <rect x={20 + (3 / (c.months - 1)) * 260 - 26} y="10" width={300 - (20 + (3 / (c.months - 1)) * 260 - 26) - 10} height="140" className="after" />}
          <polyline points={pt(series.a)} className="ads" />
          <polyline points={pt(series.k)} className="clip" />
          {series.k.map((_, i) => <text key={i} x={20 + (i / (c.months - 1)) * 260} y="166" textAnchor="middle">{c.month} {i + 1}</text>)}
          <text x="284" y={150 - (series.k[c.months - 1] / top) * 130 - 6} textAnchor="end" className="v">{c.clipLabel} {short(series.k[c.months - 1])}</text>
          <text x="284" y={150 - (series.a[c.months - 1] / top) * 130 - 6} textAnchor="end" className="va">{c.adsLabel} {short(series.a[c.months - 1])}</text>
        </svg>
        <p className="model-note">{c.chartNote}</p>
      </div>
      {s.body.map((b, i) => <p key={i} className="body-lg sx-body">{b}</p>)}
    </Section>
  );
}

/* ---------------------------------------------------------------- 4 everyone */

function Everyone({ slots }: { slots: boolean }) {
  const s = byId("everyone", S) as (typeof S)[3];
  const y = s.yacht!;
  const [filter, setFilter] = useState("All");
  const cards = s.cards!.filter((c) => filter === "All" || c.category === filter);
  const used = new Set(s.cards!.map((c) => c.category));
  return (
    <Section id={s.id} n={s.number} title={s.title} lead={s.lead} alt>
      <SlotVideo id={s.video} slots={slots} label={s.title} />
      <div className="sx-two">
        <div className="sx-panel sx-yacht">
          <span className="label">{y.liveTitle}</span>
          <div className="sx-stream">
            <div className="sx-boat" aria-hidden="true"><i /><i /></div>
            <span className="live">LIVE</span><span className="viewers">{y.liveViewers}</span>
          </div>
          <p>{y.live}</p>
        </div>
        <div className="sx-panel sx-yacht">
          <span className="label">{y.clipsTitle}</span>
          <div className="sx-feedwall" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>
          <p>{y.clips}</p>
        </div>
      </div>
      <p className="model-note">{y.note}</p>
      <div className="sx-chips" role="group">
        {s.filters!.filter((f) => f === "All" || used.has(f)).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>
      <div className="sx-cards">
        {cards.map((c, i) => (
          <div key={i} className="tile">
            <div className="tv"><CountUp value={c.value} prefix={c.prefix} suffix={c.suffix} /></div>
            <div className="tl">{c.who ? `${c.who}: ` : ""}{c.label}</div>
            {c.url && <a className="sx-src" href={c.url} target="_blank" rel="noopener noreferrer">{s.source} &rarr;</a>}
          </div>
        ))}
      </div>
      {s.body.map((b, i) => <p key={i} className="body-lg sx-body">{b}</p>)}
    </Section>
  );
}

/* ---------------------------------------------------------------- 5 results */

function Results({ slots }: { slots: boolean }) {
  const s = byId("results", S) as (typeof S)[4];
  const m = s.sim!;
  const [rate, setRate] = useState(m.rate);
  const [min, setMin] = useState(m.min);
  const [cap, setCap] = useState(m.cap);
  const [views, setViews] = useState(m.views);
  const pay = (v: number) => (v < min ? 0 : Math.min(cap, (v / 1000) * rate));
  const capAt = (cap / rate) * 1000;
  const W = 280, H = 120;
  const x = (v: number) => 10 + (v / m.maxViews) * W;
  const yv = (p: number) => 140 - (p / Math.max(cap, 1)) * H;
  const pts = [0, min - 1, min, Math.min(capAt, m.maxViews), m.maxViews].map((v) => `${x(Math.max(0, v))},${yv(pay(Math.max(0, v)))}`).join(" ");
  const range = (label: string, value: number, set: (n: number) => void, lo: number, hi: number, step: number, show: string) => (
    <div className="ctrl">
      <div className="ctrl-head"><span className="cl">{label}</span><span className="cv">{show}</span></div>
      <input type="range" min={lo} max={hi} step={step} value={value} aria-label={label} style={{ "--p": `${((value - lo) / (hi - lo)) * 100}%` } as React.CSSProperties} onChange={(e) => set(Number(e.target.value))} />
    </div>
  );
  const current = pay(views);
  return (
    <Section id={s.id} n={s.number} title={s.title} lead={s.lead}>
      <SlotVideo id={s.video} slots={slots} label={s.title} />
      <div className="sx-two">
        <div className="model">
          {range(m.rateLabel, rate, setRate, 0.5, 5, 0.25, `$${rate.toFixed(2)}`)}
          {range(m.minLabel, min, setMin, 0, 100000, 1000, short(min))}
          {range(m.capLabel, cap, setCap, 50, 1000, 10, money(cap))}
          {range(m.viewsLabel, views, setViews, 0, m.maxViews, 1000, short(views))}
          <svg viewBox="0 0 300 160" className="sx-chart" role="img" aria-label={m.payout}>
            {capAt < m.maxViews && <rect x={x(capAt)} y="10" width={x(m.maxViews) - x(capAt)} height="130" className="free" />}
            {capAt < m.maxViews && <text x={(x(capAt) + x(m.maxViews)) / 2} y="30" textAnchor="middle" className="v">{m.free}</text>}
            <polyline points={pts} className="clip" />
            <circle cx={x(views)} cy={yv(current)} r="5" className="dot" />
          </svg>
          <div className="out">
            <div className="o big"><div className="ov">{money(current)}</div><div className="ol">{views < min ? m.below : m.payout}</div></div>
          </div>
          <button type="button" className="btn" onClick={() => { setRate(m.rate); setMin(m.min); setCap(m.cap); setViews(m.presetViews); }}>{m.preset}</button>
        </div>
        <div className="sx-panel sx-center">
          <Clip id={m.clip} slots={slots} />
          <p className="model-note">{m.presetCaption}</p>
        </div>
      </div>
      {s.body.map((b, i) => <p key={i} className="body-lg sx-body">{b}</p>)}
    </Section>
  );
}

/* ---------------------------------------------------------------- 6 bots */

function Spark({ points }: { points: number[] }) {
  const top = Math.max(...points, 1);
  return (
    <svg viewBox="0 0 120 40" className="sx-spark" aria-hidden="true">
      <polyline points={points.map((p, i) => `${(i / (points.length - 1)) * 116 + 2},${38 - (p / top) * 34}`).join(" ")} />
    </svg>
  );
}

function Bots({ slots }: { slots: boolean }) {
  const s = byId("bots", S) as (typeof S)[5];
  const d = s.drain!;
  const g = s.game!;
  const [left, setLeft] = useState(d.start);
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const done = Object.keys(answers).length === g.cards.length;
  const right = g.cards.filter((c, i) => answers[i] === c.bot).length;
  const missedBots = g.cards.filter((c, i) => c.bot && answers[i] === false).length;
  return (
    <Section id={s.id} n={s.number} title={s.title} lead={s.lead} alt>
      <SlotVideo id={s.video} slots={slots} label={s.title} />
      <div className="sx-panel sx-drain">
        <span className="label">{d.label}</span>
        <div className={`sx-drain-num${left < d.start ? " down" : ""}`}>{money(left)}</div>
        <div className="sx-drain-bar"><i style={{ width: `${(left / d.start) * 100}%` }} /></div>
        <div className="sx-row">
          <button type="button" className="btn" disabled={left <= 0} onClick={() => setLeft((l) => Math.max(0, l - d.cost))}>{d.approve}</button>
          <button type="button" className="btn ghost" onClick={() => setLeft(d.start)}>{d.reset}</button>
        </div>
      </div>
      <span className="label sx-block">{g.label}</span>
      <div className="sx-bots">
        {g.cards.map((c, i) => {
          const a = answers[i];
          const answered = a !== undefined;
          return (
            <div key={i} className={`sx-bot${answered ? (a === c.bot ? " ok" : " miss") : ""}`}>
              {!answered ? (
                <>
                  <Spark points={c.graph} />
                  <dl>
                    <dt>{g.fields.likes}</dt><dd>{c.likes}</dd>
                    <dt>{g.fields.comments}</dt><dd>{c.comments}</dd>
                    <dt>{g.fields.age}</dt><dd>{c.age}</dd>
                    <dt>{g.fields.watch}</dt><dd>{c.watch}</dd>
                    <dt>{g.fields.countries}</dt><dd>{c.countries}</dd>
                  </dl>
                  <div className="sx-row">
                    <button type="button" className="btn ghost" onClick={() => setAnswers((x) => ({ ...x, [i]: false }))}>{g.real}</button>
                    <button type="button" className="btn ghost" onClick={() => setAnswers((x) => ({ ...x, [i]: true }))}>{g.bot}</button>
                  </div>
                </>
              ) : (
                <>
                  <span className="label">{a === c.bot ? g.right : g.wrong}: {c.bot ? g.bot : g.real}</span>
                  <p>{c.why}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
      {done && (
        <div className="callout" aria-live="polite">
          <p><b>{right === g.cards.length ? fill(g.perfect, { total: g.cards.length }) : fill(g.score, { right, total: g.cards.length, cost: fmt(missedBots * d.botCost) })}</b></p>
        </div>
      )}
      <div className="callout">
        <span className="label">{s.warning!.title}</span>
        <p>{s.warning!.text}</p>
        <p>{s.warning!.rule}</p>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- 7 fit */

function Fit({ slots }: { slots: boolean }) {
  const s = byId("fit", S) as (typeof S)[6];
  const p = s.picker!;
  const groups = Object.keys(p.lanes) as (keyof typeof p.lanes)[];
  const [group, setGroup] = useState<keyof typeof p.lanes>(groups[0]);
  const [lane, setLane] = useState(p.lanes[groups[0]][0]);
  const [countries, setCountries] = useState<string[]>([p.countries[0]]);
  const toggle = (c: string) =>
    setCountries((cur) => (c === "Global" ? ["Global"] : cur.includes(c) ? cur.filter((x) => x !== c) : [...cur.filter((x) => x !== "Global"), c]));
  const where = countries.length === 0 || countries.includes("Global") ? "many countries" : countries.length === 1 ? countries[0] : `${countries.slice(0, -1).join(", ")} and ${countries[countries.length - 1]}`;
  const r = s.results!;
  const [tab, setTab] = useState(r.tabs[0]);
  const lmin = Math.log(r.min), lmax = Math.log(r.max);
  const [pos, setPos] = useState((Math.log(r.default) - lmin) / (lmax - lmin));
  const views = Math.exp(lmin + pos * (lmax - lmin));
  const mo = s.moments!;
  return (
    <Section id={s.id} n={s.number} title={s.title} lead={s.lead}>
      <SlotVideo id={s.video} slots={slots} label={s.title} />
      <div className="sx-two">
        <div className="sx-panel">
          <span className="label">{p.laneLabel}</span>
          <div className="sx-chips" role="group">{groups.map((gk) => <button key={gk} type="button" aria-pressed={group === gk} onClick={() => { setGroup(gk); setLane(p.lanes[gk][0]); }}>{gk}</button>)}</div>
          <div className="sx-chips sm" role="group">{p.lanes[group].map((l) => <button key={l} type="button" aria-pressed={lane === l} onClick={() => setLane(l)}>{l}</button>)}</div>
          <span className="label sx-block">{p.countryLabel}</span>
          <div className="sx-chips sm" role="group">{p.countries.map((c) => <button key={c} type="button" aria-pressed={countries.includes(c)} onClick={() => toggle(c)}>{c}</button>)}</div>
        </div>
        <div className="sx-panel">
          <span className="label">{p.resultLabel}: {lane}</span>
          <ul className="bullets">{p.pageTypes[group].map((t, i) => <li key={t}><span className="m">{String(i + 1).padStart(2, "0")}</span><span>{t}, {fill(p.inCountry, { countries: where })}</span></li>)}</ul>
        </div>
      </div>
      <div className="model">
        <div className="sx-chips" role="group">{r.tabs.map((t) => <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>
        {tab === r.tabs[0] ? (
          <>
            <div className="ctrl-head"><span className="cl">{r.label}</span><span className="cv">{short(views)}</span></div>
            <input type="range" min={0} max={1000} value={Math.round(pos * 1000)} aria-label={r.label} style={{ "--p": `${pos * 100}%` } as React.CSSProperties} onChange={(e) => setPos(Number(e.target.value) / 1000)} />
            <div className="out"><div className="o big"><div className="ov">{short(views * 0.004)} to {short(views * 0.01)}</div><div className="ol">{r.music}</div></div></div>
          </>
        ) : (
          <div className="out"><div className="o big"><div className="ov">500</div><div className="ol">{r.brand}</div></div></div>
        )}
      </div>
      <span className="label sx-block">{mo.label}</span>
      <div className="sx-two">
        <div className="sx-panel sx-center"><Clip id={mo.hook.clip} slots={slots} /><p className="model-note">{mo.hook.caption}</p></div>
        <div className="sx-panel sx-center"><Clip id={mo.product.clip} slots={slots} /><p className="model-note">{mo.product.caption}</p></div>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- cases */

const figValue = (v: string) => {
  const m = /^(\$?)([\d.,]+)([KMB]?)(\+?)$/.exec(v.trim());
  if (!m) return null;
  const mult = m[3] === "B" ? 1e9 : m[3] === "M" ? 1e6 : m[3] === "K" ? 1e3 : 1;
  const n = Number(m[2].replace(/,/g, ""));
  const decimals = (m[2].split(".")[1] ?? "").length;
  return { n, mult, prefix: m[1], suffix: m[3] + m[4], decimals };
};

function Figure({ value }: { value: string }) {
  const f = figValue(value);
  if (!f) return <>{value}</>;
  return <CountUp value={f.n} prefix={f.prefix} suffix={f.suffix} format={(n) => n.toFixed(f.decimals)} />;
}

function Cases({ cases, slots }: { cases: Case[]; slots: boolean }) {
  const c = content.cases;
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  const k = c.kojo;
  const list = cases.filter((x) => filter === "All" || x.category === filter);
  return (
    <section className="section alt" id="cases">
      <div className="wrap">
        <div className="snum">Proof</div>
        <h2 className="sx-h2">{c.title}</h2>
        <div className="sx-chips" role="group">{c.filters.map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}</div>
        <div className="cases">
          {list.map((x) => {
            const isOpen = open === x.proof;
            return (
              <div key={x.proof} className="case">
                <div className="ct">{x.item.title}</div>
                <div className="kpis">{(x.item.figures ?? []).map((f) => <div key={f.label} className="kpi"><div className="kv"><Figure value={f.value} /></div><div className="kl">{f.label}</div></div>)}</div>
                <button type="button" className="btn ghost sx-open-btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : x.proof)}>{isOpen ? c.close : c.open}</button>
                {isOpen && (
                  <>
                    <dl>
                      <dt>{c.goal}</dt><dd>{x.item.objective}</dd>
                      <dt>{c.did}</dt><dd>{x.item.strategy}</dd>
                      <dt>{c.result}</dt><dd>{x.item.text}</dd>
                    </dl>
                    <div className="sx-six three">{x.clips.map((id) => <Clip key={id} id={id} slots={slots} small />)}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="model sx-kojo">
          <span className="label">{k.title}</span>
          <svg viewBox="0 0 300 150" className="sx-chart" role="img" aria-label={k.note}>
            <rect x="70" y="10" width="70" height="120" className="after" />
            <text x="105" y="24" textAnchor="middle">{k.campaign}</text>
            <path d="M10,128 C60,126 80,118 105,95 S150,52 190,42 S260,26 290,18" className="clip" />
            <path d="M10,132 C60,131 90,128 110,118 S160,96 200,88 S260,78 290,70" className="ads" />
          </svg>
          <div className="out">
            <div className="o big"><div className="ov"><CountUp value={k.listeners} format={short} /></div><div className="ol">{k.listenersLabel}</div></div>
            <div className="o"><div className="ov"><CountUp value={k.fanPage} format={short} /></div><div className="ol">{k.fanPageLabel}</div></div>
          </div>
          <p className="model-note">{k.note}</p>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- alone, next */

function Alone({ slots }: { slots: boolean }) {
  const a = content.alone;
  const [have, setHave] = useState<Record<number, boolean>>({});
  const missing = a.items.length - Object.values(have).filter(Boolean).length;
  return (
    <section className="section" id="alone">
      <div className="wrap">
        <h2 className="sx-h2">{a.title}</h2>
        <p className="lead">{a.lead}</p>
        <ul className="sx-check">
          {a.items.map((t, i) => (
            <li key={t}>
              <label>
                <input type="checkbox" checked={Boolean(have[i])} onChange={(e) => setHave((h) => ({ ...h, [i]: e.target.checked }))} />
                <span>{t}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="callout" aria-live="polite"><p><b>{missing === 0 ? a.none : fill(a.count, { n: missing })}</b></p></div>
        <SlotVideo id={a.video} slots={slots} label={a.videoCaption} />
        {a.video && <p className="model-note">{a.videoCaption}</p>}
      </div>
    </section>
  );
}

function Next({ bookingUrl }: { bookingUrl: string }) {
  const n = content.next;
  return (
    <section className="section alt close" id="next">
      <div className="wrap">
        <h2>{n.title}</h2>
        <p>{n.lead}</p>
        <div className="sx-spots" aria-label={fill(n.spots, { left: n.spotsLeft, total: n.spotsTotal })}>
          {Array.from({ length: n.spotsTotal }, (_, i) => <i key={i} className={i < n.spotsLeft ? "on" : ""} />)}
          <span>{fill(n.spots, { left: n.spotsLeft, total: n.spotsTotal })}</span>
        </div>
        <span className="label sx-block">{n.booking}</span>
        {bookingUrl ? (
          <>
            <CalInline url={bookingUrl} />
            <p className="model-note"><a href={bookingUrl} target="_blank" rel="noopener noreferrer">{n.fallback} &rarr;</a></p>
          </>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- page */

export function Secrets({ cases, bookingUrl, showSlots }: { cases: Case[]; bookingUrl: string; showSlots: boolean }) {
  return (
    <main className="gd sx">
      <Progress />
      <Opening slots={showSlots} />
      <Ceiling slots={showSlots} />
      <Everywhere slots={showSlots} />
      <Ads slots={showSlots} />
      <Everyone slots={showSlots} />
      <Results slots={showSlots} />
      <Bots slots={showSlots} />
      <Fit slots={showSlots} />
      <Cases cases={cases} slots={showSlots} />
      <Alone slots={showSlots} />
      <Next bookingUrl={bookingUrl} />
    </main>
  );
}
