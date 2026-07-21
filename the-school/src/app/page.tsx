/**
 * Public marketing landing page. School names/taglines are pulled from the DB
 * (Rule 0: even the pitch shouldn't drift from what's actually seeded) — the
 * surrounding marketing copy is not curriculum content, so it lives here.
 */
import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const schools = await db.school.findMany({
    where: { archived: false },
    orderBy: { order: "asc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-sm uppercase tracking-widest opacity-60">The School</p>
      <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">
        Learn the marketing that actually grows what you're building.
      </h1>
      <p className="mt-5 max-w-xl text-lg opacity-80">
        A membership built around one idea: ship the work, not watch the videos.
        Pick your track, work the curriculum, get the Discord role, and get seen
        when you're ready for the next step.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/join" className="rounded-lg bg-black px-6 py-3 text-white">
          Join The School
        </Link>
        <Link href="/sign-in" className="rounded-lg border px-6 py-3">
          Sign in
        </Link>
      </div>

      {schools.length > 0 && (
        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          {schools.map((school) => (
            <div key={school.id} className="rounded-lg border p-6">
              <h2 className="text-xl font-medium">{school.name}</h2>
              {school.tagline && <p className="mt-2 text-sm opacity-70">{school.tagline}</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
