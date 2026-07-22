/**
 * Presentational only. Swap this file for a redesigned version — page.tsx
 * owns the data fetch; chooseSchoolAction is the server action that records
 * the pick, passed in so this view never touches the DB directly.
 */
export type OnboardingSchool = { slug: string; name: string; tagline: string | null };

export function SchoolPickerView({
  schools,
  chooseSchoolAction,
}: {
  schools: OnboardingSchool[];
  chooseSchoolAction: (schoolSlug: string) => Promise<void>;
}) {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Pick your track</h1>
      <p className="mt-3 opacity-80">Choose the school that matches what you're building.</p>
      <div className="mt-8 grid gap-3">
        {schools.map((s) => (
          <form key={s.slug} action={chooseSchoolAction.bind(null, s.slug)}>
            <button type="submit" className="w-full rounded-lg border p-5 text-left hover:bg-neutral-50">
              <span className="font-medium">{s.name}</span>
              {s.tagline && <p className="mt-1 text-sm opacity-70">{s.tagline}</p>}
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
