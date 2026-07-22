/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch; chooseSchoolAction is the server action that records
 * the pick, passed in so this view never touches the DB directly.
 */
import { Caption } from "@/components/Caption";

export type OnboardingSchool = { slug: string; name: string; tagline: string | null };

export function SchoolPickerView({
  schools,
  chooseSchoolAction,
}: {
  schools: OnboardingSchool[];
  chooseSchoolAction: (schoolSlug: string) => Promise<void>;
}) {
  return (
    <main className="min-h-screen bg-ink pt-[76px]">
      <div className="mx-auto max-w-xl px-6 py-20">
        <Caption>Enrollment</Caption>
        <h1 className="mt-3.5 font-display text-[36px] leading-[1.0] tracking-[-0.01em] text-cream-bright sm:text-[48px]">
          Pick your wing.
        </h1>
        <p className="mt-4 text-cream/70">Choose the school that matches what you're building.</p>
        <div className="mt-10 flex flex-col gap-3">
          {schools.map((s) => (
            <form key={s.slug} action={chooseSchoolAction.bind(null, s.slug)}>
              <button
                type="submit"
                className="w-full rounded-[2px] border border-cream/16 p-6 text-left transition-colors hover:border-gold/50"
              >
                <div className="font-display text-2xl text-cream-bright">{s.name}</div>
                {s.tagline && <p className="mt-1.5 text-sm text-cream/65">{s.tagline}</p>}
              </button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
