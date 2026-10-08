// The web guide: the same assembled guide as the PDF, readable on a phone,
// with the PDF download. This is the link in the email and on the result page.
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Logo } from "@/components/funnel/ui";
import { guideFor } from "@/lib/server/guide";
import { guideLabels } from "@/lib/server/guide/assemble";
import { getLead } from "@/lib/server/leads";
import { verifyToken } from "@/lib/server/tokens";

export const metadata = { robots: { index: false, follow: false } };

const two = (n: number) => String(n).padStart(2, "0");

export default async function GuidePage({ params }: PageProps<"/g/[token]">) {
  await connection();
  const { token } = await params;
  const id = verifyToken(token, "guide");
  const lead = id ? await getLead(id) : null;
  if (!lead) notFound();
  const guide = guideFor(lead);
  const pdfHref = `/api/guide/${token}?from=web`;

  return (
    <main className="min-h-dvh bg-paper">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6 md:px-12">
        <Logo />
        <a href={pdfHref} className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-pill bg-ink px-5 text-[14px] font-medium text-white">
          <span className="md:hidden">{guideLabels.downloadShort}</span>
          <span className="hidden md:inline">{guideLabels.download}</span>
        </a>
      </header>
      <section className="mx-auto max-w-4xl px-5 pb-16 pt-10 md:px-12 md:pt-20">
        <h1 className="font-serif text-hero">{guide.title}</h1>
        <p className="mt-6 max-w-[40ch] text-lead text-muted">{guide.intro}</p>
        <p className="mt-8 font-serif text-subtitle italic text-gold-deep">{guide.preparedFor}</p>
      </section>
      {guide.sections.map((s, i) => (
        <section key={s.key} className={s.proof ? "bg-ink text-cream" : "border-t border-line"}>
          <div className="mx-auto grid max-w-4xl gap-4 px-5 py-16 md:grid-cols-[80px_1fr] md:px-12 md:py-24">
            <p className={`font-serif text-[1.6rem] leading-none ${s.proof ? "text-gold-light" : "text-gold-deep"}`}>{two(i + 1)}</p>
            <div className="max-w-[62ch]">
              <h2 className="font-serif text-title">{s.title}</h2>
              <div
                className={`guide-prose mt-8 ${s.proof ? "guide-prose-dark" : ""}`}
                // Trusted content: our own markdown from content/guide.
                dangerouslySetInnerHTML={{ __html: s.html }}
              />
              {s.platforms && (
                <>
                  <p className="mt-6 font-serif text-[1.35rem] italic text-gold-deep">{s.platforms.lead}</p>
                  <ol className="mt-6 border-t border-line">
                    {s.platforms.items.map((p, n) => (
                      <li key={p.key} className="flex gap-5 border-b border-line py-5">
                        <span className="font-serif text-[1.2rem] text-gold-deep">{two(n + 1)}</span>
                        <div>
                          <h3 className="font-serif text-[1.5rem] leading-tight">{p.name}</h3>
                          <p className="mt-1 text-[15px] leading-relaxed text-muted">{p.text}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {s.proof?.map((p) => (
                <div key={p.text} className="mt-10 border-t border-white/15 pt-8">
                  {p.title && <h3 className="font-serif text-[1.4rem] italic text-gold-light">{p.title}</h3>}
                  {p.headline && <p className="mt-2 font-serif text-hero">{p.headline}</p>}
                  {p.figures?.map((f) => (
                    <p key={f.label} className="mt-2">
                      <span className="font-serif text-display">{f.value}</span> <span className="text-cream/75">{f.label}</span>
                    </p>
                  ))}
                  <p className="mt-3 text-[15px] leading-relaxed text-cream/80">{p.text}</p>
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[14px] text-cream/70 underline underline-offset-4">
                      {p.url}
                    </a>
                  )}
                  {p.logos && (
                    <ul className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
                      {p.logos.map((l) => (
                        <li key={l.name}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={l.src} alt={l.name} className="h-7 w-auto brightness-0 invert" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-6 px-5 py-12 md:px-12">
          <p className="font-serif text-[1.2rem] text-muted">{guide.footer}</p>
          <a href={pdfHref} className="inline-flex h-[52px] items-center rounded-pill bg-ink px-7 text-[15px] font-medium text-white">
            {guideLabels.download}
          </a>
        </div>
      </footer>
    </main>
  );
}
