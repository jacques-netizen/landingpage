import { connection } from "next/server";
import { copy, fill } from "@/lib/content";
import { maskEmail, verifyToken } from "@/lib/server/tokens";
import { Logo } from "@/components/funnel/ui";

export default async function UnsubscribePage({ params, searchParams }: PageProps<"/u/[token]">) {
  await connection();
  const { token } = await params;
  const { done } = await searchParams;
  const email = verifyToken(token, "unsub");
  const c = copy.unsubscribe;
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-10 md:px-12">
      <Logo />
      <div className="my-auto py-16">
        <h1 className="font-serif text-display">{c.title}</h1>
        {!email ? (
          <p className="mt-6 text-lead text-muted">{c.invalid}</p>
        ) : done ? (
          <p className="mt-6 text-lead text-muted">{c.done}</p>
        ) : (
          <form method="post" action={`/api/unsubscribe?t=${encodeURIComponent(token)}`} className="mt-6">
            <p className="text-lead text-muted">{fill(c.body, { email: maskEmail(email) })}</p>
            <button type="submit" className="mt-8 inline-flex h-[52px] items-center rounded-pill bg-ink px-7 text-[15px] font-medium text-white">
              {c.button}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
