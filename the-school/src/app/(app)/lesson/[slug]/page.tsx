/**
 * Lesson player. Body is markdown from the DB; video is an external embed
 * (Mux/Bunny) — never served from this app. Content edits happen in
 * curriculum.json or the DB, never here.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getMemberByClerkId, hasActiveAccess } from "@/lib/access";
import { CompleteControls } from "./controls";

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const member = await getMemberByClerkId(userId);
  if (!member || !hasActiveAccess(member)) redirect("/dashboard");

  const lesson = await db.lesson.findUnique({
    where: { slug },
    include: { module: { include: { assignment: true, campus: true } } },
  });
  if (!lesson || lesson.archived) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm uppercase tracking-widest opacity-60">{lesson.module.campus.name}</p>
      <h1 className="mt-1 text-3xl font-semibold">{lesson.title}</h1>

      {lesson.videoUrl && (
        <div className="mt-6 aspect-video overflow-hidden rounded-lg bg-black">
          <iframe src={lesson.videoUrl} className="h-full w-full" allowFullScreen />
        </div>
      )}

      {lesson.body && (
        <article className="prose mt-8 max-w-none whitespace-pre-wrap">{lesson.body}</article>
      )}

      {lesson.module.assignment && (
        <div className="mt-10 rounded-lg border-2 border-black p-5">
          <h2 className="font-medium">Ship it</h2>
          <p className="mt-1 text-sm opacity-80">{lesson.module.assignment.description}</p>
        </div>
      )}

      <CompleteControls moduleId={lesson.moduleId} assignmentId={lesson.module.assignment?.id ?? null} />
    </main>
  );
}
