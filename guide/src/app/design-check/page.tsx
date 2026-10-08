// Phase 0 test page: renders the captured tokens so the type and colors can be
// compared side by side with maisondelites.com. Not linked from the funnel.
import Image from "next/image";

const swatches = [
  ["paper", "bg-paper"], ["paper-deep", "bg-paper-deep"], ["paper-light", "bg-paper-light"],
  ["ink", "bg-ink"], ["ink-soft", "bg-ink-soft"], ["muted", "bg-muted"],
  ["line", "bg-line"], ["gold", "bg-gold"], ["gold-deep", "bg-gold-deep"], ["gold-light", "bg-gold-light"],
] as const;

export default function DesignCheck() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-16 md:px-12">
      <Image src="/brand/logo-nav-clear.png" alt="Maison d'Élites" width={250} height={26} priority />
      <h1 className="mt-16 font-serif text-hero">
        Reach that ads can&rsquo;t buy.
        <br />
        <em>Clips on every feed, at scale.</em>
      </h1>
      <p className="mt-6 max-w-[38ch] text-lead text-muted">
        A network of clippers turns your best moments into short videos across TikTok, Reels and Shorts.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <span className="inline-flex h-[50px] items-center rounded-pill bg-ink px-7 text-[15px] font-medium text-white">Build my guide &rarr;</span>
        <span className="inline-flex h-[50px] items-center rounded-pill border border-line-strong bg-white/50 px-6 text-[15px] font-medium">See the results</span>
      </div>
      <h2 className="mt-24 font-serif text-display">A clipping network built for <em>reach</em></h2>
      <h3 className="mt-10 font-serif text-title">How it works</h3>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">Body copy in Archivo 15px. Every post is checked before it counts.</p>
      <div className="mt-16 grid grid-cols-2 gap-px bg-line sm:grid-cols-5">
        {swatches.map(([name, cls]) => (
          <div key={name} className="bg-paper p-3">
            <div className={`h-16 ${cls}`} />
            <p className="mt-2 text-[13px]">{name}</p>
          </div>
        ))}
      </div>
      <section className="mt-24 bg-ink p-10 text-cream">
        <p className="font-serif text-title">Put your content <em className="text-gold-light">to work.</em></p>
      </section>
    </main>
  );
}
