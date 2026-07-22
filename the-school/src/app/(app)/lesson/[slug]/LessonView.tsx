/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch (Rule 0). The quietest screen in the product (design
 * study §6): wide measure, generous leading, video flush in the column.
 * The interactive controls (ship/complete + exam) are passed in as children.
 */
import Link from "next/link";
import { Caption } from "@/components/Caption";

export function LessonView({
  campusName,
  title,
  videoUrl,
  body,
  examHref,
  children,
}: {
  campusName: string;
  title: string;
  videoUrl: string | null;
  body: string | null;
  examHref: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-ink pt-[76px]">
      <div className="mx-auto max-w-[720px] px-6 py-16 sm:px-11">
        <Caption>{campusName.toUpperCase()}</Caption>
        <h1 className="mt-3.5 font-display text-[34px] leading-[1.0] tracking-[-0.01em] text-cream-bright sm:text-[48px]">
          {title}
        </h1>

        {videoUrl && (
          <div className="relative mt-10">
            <div className="aspect-video bg-[#0d0a06]">
              <iframe src={videoUrl} className="h-full w-full" allowFullScreen />
            </div>
            <div className="pointer-events-none absolute -top-px -left-px h-[18px] w-[18px] border-t-2 border-l-2 border-gold" />
            <div className="pointer-events-none absolute -top-px -right-px h-[18px] w-[18px] border-t-2 border-r-2 border-gold" />
            <div className="pointer-events-none absolute -bottom-px -left-px h-[18px] w-[18px] border-b-2 border-l-2 border-gold" />
            <div className="pointer-events-none absolute -bottom-px -right-px h-[18px] w-[18px] border-b-2 border-r-2 border-gold" />
          </div>
        )}

        {body && (
          <article className="mt-10 max-w-none text-lg leading-[1.75] whitespace-pre-wrap text-cream/82">{body}</article>
        )}

        {children}

        {examHref && (
          <Link
            href={examHref}
            className="mt-6 flex items-center justify-between rounded-[2px] border border-cream/14 px-6 py-4 text-sm text-cream/75 transition-colors hover:border-gold/40 hover:text-cream-bright"
          >
            <span>Take the exam for this module</span>
            <span className="text-gold">→</span>
          </Link>
        )}
      </div>
    </main>
  );
}
