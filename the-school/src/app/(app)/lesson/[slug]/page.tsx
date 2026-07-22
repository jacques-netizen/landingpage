/**
 * Data loader only — see LessonView.tsx for the presentation. Body is
 * markdown from the DB; video is an external embed (Mux/Bunny) — never
 * served from this app. Content edits happen in curriculum.json or the DB,
 * never here.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getMemberByClerkId, hasActiveAccess } from "@/lib/access";
import { CompleteControls } from "./controls";
import { LessonView } from "./LessonView";

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
    <LessonView
      campusName={lesson.module.campus.name}
      title={lesson.title}
      videoUrl={lesson.videoUrl}
      body={lesson.body}
      assignmentDescription={lesson.module.assignment?.description ?? null}
    >
      <CompleteControls moduleId={lesson.moduleId} assignmentId={lesson.module.assignment?.id ?? null} />
    </LessonView>
  );
}
