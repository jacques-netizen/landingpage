/**
 * Data loader only — see ExamView.tsx for the presentation. Correct
 * answers never reach the client; only question text and choices do.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getMemberByClerkId, hasActiveAccess } from "@/lib/access";
import { ExamView } from "./ExamView";

export default async function ExamPage({ params }: { params: Promise<{ moduleSlug: string }> }) {
  const { moduleSlug } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const member = await getMemberByClerkId(userId);
  if (!member || !hasActiveAccess(member)) redirect("/dashboard");

  const module_ = await db.module.findUnique({
    where: { slug: moduleSlug },
    include: { exam: true, campus: true, lessons: { orderBy: { order: "asc" }, take: 1 } },
  });
  if (!module_ || !module_.exam) notFound();

  const latestAttempt = await db.examAttempt.findFirst({
    where: { memberId: member.id, examId: module_.exam.id },
    orderBy: { createdAt: "desc" },
  });

  const questions = module_.exam.questions as unknown as { question: string; choices: string[] }[];

  return (
    <ExamView
      examId={module_.exam.id}
      campusName={module_.campus.name}
      moduleName={module_.title}
      backHref={module_.lessons[0] ? `/lesson/${module_.lessons[0].slug}` : `/campus/${module_.campus.slug}`}
      passScore={module_.exam.passScore}
      questions={questions.map((q) => ({ question: q.question, choices: q.choices }))}
      latestAttempt={latestAttempt ? { score: latestAttempt.score, passed: latestAttempt.passed } : null}
    />
  );
}
