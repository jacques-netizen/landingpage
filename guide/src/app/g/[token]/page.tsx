// The web guide: the written guide (AI or rules) rendered in the style of the
// Owning the Feed proposal. This is the link in the email and on the result
// page. The PDF is a secondary download of the same document.
import { notFound } from "next/navigation";
import { connection } from "next/server";
import outline from "../../../../content/guide/outline.json";
import { Logo } from "@/components/funnel/ui";
import type { GuideDoc, GuideSection } from "@/lib/guide/doc";
import { ensureGuide } from "@/lib/server/guide";
import { getLead } from "@/lib/server/leads";
import { verifyToken } from "@/lib/server/tokens";
import { GuideClient } from "./GuideClient";
import { NumbersBlock } from "./NumbersBlock";
import "../guide.css";

export const metadata = { robots: { index: false, follow: false } };
export const maxDuration = 120;

const two = (n: number) => String(n).padStart(2, "0");
const labels = outline.labels as Record<string, string>;

export default async function GuidePage({ params }: PageProps<"/g/[token]">) {
  await connection();
  const { token } = await params;
  const id = verifyToken(token, "guide");
  const lead = id ? await getLead(id) : null;
  if (!lead) notFound();
  // Opening the link before the write job ran writes the guide now.
  const doc = await ensureGuide(lead);
  const pdfHref = `/api/guide/${token}?from=web`;
  const cover = `/brand/${(outline.coverImages as Record<string, string>)[typeof lead.answers.asset === "string" ? lead.answers.asset : ""] ?? "bh-3.webp"}`;
  const date = new Date(doc.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const [h1a, h1b] = splitHeadline(doc.hero.headline);

  return (
    <main className="gd">
      <GuideClient />
      <div className="progress" aria-hidden="true" />

      <header className="hero">
        <div className="hero-bg" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cover} alt="" />
        </div>
        <div className="hero-top">
          <Logo light />
          <a href={pdfHref} className="btn ghost">{labels.downloadShort}</a>
        </div>
        <div className="hero-mid">
          <span className="label">{doc.hero.kicker}</span>
          <h1>
            {h1a}
            {h1b && <span>{h1b}</span>}
          </h1>
          <p className="hero-sub">{doc.hero.sub}</p>
          <div className="tiles">
            {doc.hero.tiles.map((t, i) => (
              <div className="tile" key={i}>
                <div className="tv">{t.value}</div>
                <div className="tl">{t.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-bot">
          <p className="prepared">
            <b>{doc.preparedFor}</b>
            <br />
            {date}
          </p>
          <span className="scrollcue">{labels.scroll}</span>
        </div>
      </header>

      <section className="section" id="summary">
        <div className="wrap sum-grid">
          <div>
            <div className="snum rv">00 {labels.summary}</div>
            {doc.summary.map((p, i) => (
              <p className={`body-lg rv d${Math.min(3, i + 1)}`} key={i}>{p}</p>
            ))}
          </div>
          <aside className="facts rv d2" aria-label={labels.facts}>
            <div className="ck">{labels.facts}</div>
            <ul>
              {doc.facts.map((f) => (
                <li key={f.id}>
                  <b>{f.answer}</b>
                  {f.question}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      {doc.sections.map((s, i) => (
        <Section key={s.key} s={s} i={i + 1} doc={doc} alt={i % 2 === 1} />
      ))}

      <section className="section close">
        <div className="wrap">
          <div className="snum rv">{labels.openGuide}</div>
          <h2 className="rv d1">{doc.next.text}</h2>
          {doc.next.url && (
            <p className="rv d2">
              <a href={doc.next.url} className="btn" target={doc.next.kind === "book" ? "_self" : "_blank"} rel="noopener noreferrer">
                {doc.next.label}
              </a>
            </p>
          )}
          <div className="signoff rv d3">
            <Logo light />
            <p className="s-r">
              {doc.preparedFor}
              <br />
              <a href={pdfHref}>{labels.download}</a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function splitHeadline(h: string): [string, string] {
  const words = h.split(" ");
  if (words.length < 3) return [h, ""];
  const cut = Math.ceil(words.length / 2);
  return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
}

function Section({ s, i, doc, alt }: { s: GuideSection; i: number; doc: GuideDoc; alt: boolean }) {
  const platformsMax = s.platforms ? s.platforms.items.length : 0;
  return (
    <section className={`section${alt ? " alt" : ""}`} id={s.key}>
      <div className="wrap">
        <div className="snum rv">{two(i)} {s.title}</div>
        {s.lead && <p className="lead rv d1">{s.lead}</p>}
        {s.html ? (
          <div className="prose rv d2" dangerouslySetInnerHTML={{ __html: s.html }} />
        ) : (
          <div className="prose rv d2">
            {s.paragraphs.map((p, n) => (
              <p key={n}>{p}</p>
            ))}
          </div>
        )}
        {s.bullets && s.bullets.length > 0 && (
          <ul className="bullets rv d2">
            {s.bullets.map((b, n) => (
              <li key={n}>
                <span className="m">{two(n + 1)}</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
        {s.steps && s.steps.length > 0 && (
          <div className={`engine rv d2${s.steps.length === 4 ? " four" : ""}`}>
            {s.steps.map((st, n) => (
              <div className="eng" key={n}>
                <h4>{st.title}</h4>
                <p>{st.body}</p>
              </div>
            ))}
          </div>
        )}
        {s.platforms && (
          <div className="bars rv d2">
            <p className="lead" style={{ fontSize: "1.25rem" }}>{s.platforms.lead}</p>
            {s.platforms.items.map((p, n) => (
              <div className="bar-row" key={p.key}>
                <div className="bn">
                  <small>{two(n + 1)}</small>
                  {p.name}
                </div>
                <div>
                  <div className="bar-track"><div className="bar-fill" data-pct={Math.round(((platformsMax - n) / platformsMax) * 100)} /></div>
                  <p>{p.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {s.numbers && (
          <div className="rv d2">
            <NumbersBlock numbers={doc.numbers} labels={outline.numbersLabels} />
          </div>
        )}
        {s.proof && <Proof doc={doc} />}
        {s.callout && (
          <div className="callout rv d3">
            {s.callout.label && <span className="label">{s.callout.label}</span>}
            <p>{s.callout.text}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Proof({ doc }: { doc: GuideDoc }) {
  const band = doc.proof.find((p) => p.headline && !p.figures);
  const clients = doc.proof.find((p) => p.logos);
  const cases = doc.proof.filter((p) => p.figures || p.url);
  return (
    <div className="rv d2">
      {doc.proofIntro && <p className="body-lg">{doc.proofIntro}</p>}
      {band && (
        <div className="proof-grid">
          <div className="pf big">
            <div className="pv">{band.headline}</div>
            <div className="pl">{band.text}</div>
          </div>
          <div className="pf">
            <div className="pv">4</div>
            <div className="pl">{labels.fourSteps}</div>
          </div>
        </div>
      )}
      {cases.length > 0 && (
        <div className="cases">
          {cases.map((p) => (
            <div className="case" key={p.title ?? p.text}>
              {p.title && <div className="ct">{p.title}</div>}
              {p.objective && (
                <dl>
                  <dt>{labels.objectiveLabel}</dt>
                  <dd>{p.objective}</dd>
                  {p.strategy && (
                    <>
                      <dt>{labels.strategy}</dt>
                      <dd>{p.strategy}</dd>
                    </>
                  )}
                </dl>
              )}
              {!p.objective && <dd style={{ margin: "0.6rem 0 0", color: "var(--mute)" }}>{p.text}</dd>}
              {p.figures && (
                <div className="kpis">
                  {p.figures.map((f) => (
                    <div className="kpi" key={f.label}>
                      <div className="kv">{f.value}</div>
                      <div className="kl">{f.label}</div>
                    </div>
                  ))}
                </div>
              )}
              {p.url && (
                <a className="watch" href={p.url} target="_blank" rel="noopener noreferrer">
                  {labels.watch} <span aria-hidden="true">&rarr;</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {clients?.logos && (
        <div className="clients" aria-label={clients.text}>
          {clients.logos.map((l) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={l.name} src={l.src} alt={l.name} />
          ))}
        </div>
      )}
    </div>
  );
}
