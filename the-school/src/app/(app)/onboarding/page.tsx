import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ensureMember } from "@/lib/member";
import { chooseSchool } from "./actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ discord?: string }>;
}) {
  const { discord } = await searchParams;
  const member = await ensureMember();
  if (!member) redirect("/sign-in"); // middleware already protects this route; satisfies TS

  if (!member.schoolId) {
    const schools = await db.school.findMany({ where: { archived: false }, orderBy: { order: "asc" } });
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Pick your track</h1>
        <p className="mt-3 opacity-80">Choose the school that matches what you're building.</p>
        <div className="mt-8 grid gap-3">
          {schools.map((s) => (
            <form key={s.slug} action={chooseSchool.bind(null, s.slug)}>
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

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Connect Discord</h1>
      <p className="mt-3 opacity-80">
        Your Discord role is granted automatically once your membership is active. Link your account now so it's ready.
      </p>
      {discord === "error" && (
        <p className="mt-4 text-sm text-red-600">Something went wrong connecting Discord. Try again.</p>
      )}
      {discord === "taken" && (
        <p className="mt-4 text-sm text-red-600">That Discord account is already linked to another member.</p>
      )}
      {member.discordUserId ? (
        <p className="mt-6 rounded-lg bg-neutral-100 p-4 text-sm">Discord connected.</p>
      ) : (
        <a href="/api/discord/connect" className="mt-6 inline-block rounded-lg bg-black px-6 py-3 text-white">
          Connect Discord
        </a>
      )}
      <div className="mt-8">
        <Link href="/join" className="rounded-lg bg-black px-6 py-3 text-white">
          Continue to plans
        </Link>
      </div>
    </main>
  );
}
