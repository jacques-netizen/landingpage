/**
 * Scores an exam attempt server-side against Exam.questions — the client
 * only ever sends answer indices, never a score, so it can't be gamed.
 * Emits exam_passed/exam_failed for the bot/analytics (Rule 5: silence is a bug).
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { ensureMember } from "@/lib/member";

type Question = { question: string; choices: string[]; correctIndex: number };

export async function POST(req: NextRequest) {
  const member = await ensureMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { examId, answers } = (await req.json()) as { examId: string; answers: number[] };

  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  const questions = exam.questions as unknown as Question[];
  const correct = questions.reduce((count, q, i) => (answers[i] === q.correctIndex ? count + 1 : count), 0);
  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= exam.passScore;

  await db.examAttempt.create({
    data: { memberId: member.id, examId, answers: answers as object, score, passed },
  });
  await emitEvent(member.id, passed ? "exam_passed" : "exam_failed", { examId, score });

  return NextResponse.json({ score, passed, total: questions.length, correct });
}
