import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Question as PrismaQuestion, TestSessionStatus } from "@prisma/client";
import {
  CaseStatus,
  ClinicalSpecialty,
  Difficulty,
  PublicQuestion,
  QuestionResult,
  QuestionType,
  Role,
  TestResult,
  TestSessionStatus as VSessionStatus,
  TestSessionSummary,
  TestSessionView,
} from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";

const testWithQuestions = {
  questions: {
    orderBy: { order: "asc" as const },
    include: { question: true },
  },
};
type TestWithQuestions = Prisma.TestGetPayload<{ include: typeof testWithQuestions }>;
type Answers = Record<string, number[]>;

@Injectable()
export class TestSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Start ─────────────────────────────────────────────────────

  async start(testId: string, user: AuthenticatedUser): Promise<TestSessionView> {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: testWithQuestions,
    });
    if (!test) throw new NotFoundException("Test not found");

    const isOwnerOrAdmin = user.role === Role.ADMIN || test.authorId === user.id;
    if (test.status !== "PUBLISHED" && !isOwnerOrAdmin) {
      throw new NotFoundException("Test not found");
    }
    if (test.questions.length === 0) {
      throw new BadRequestException("This test has no questions");
    }

    let order = test.questions.map((tq) => tq.questionId);
    if (test.shuffle) order = this.shuffle(order);

    const now = Date.now();
    const expiresAt = new Date(now + test.timeLimitMinutes * 60_000);

    const session = await this.prisma.testSession.create({
      data: {
        testId,
        userId: user.id,
        status: "IN_PROGRESS",
        answers: {},
        questionOrder: order,
        expiresAt,
      },
    });

    const byId = this.indexQuestions(test);
    return this.toView(session, test.title, test.passingScore, order, byId, {}, /* includeResult */ false);
  }

  // ─── Read ──────────────────────────────────────────────────────

  async findOne(id: string, user: AuthenticatedUser): Promise<TestSessionView> {
    const session = await this.loadSession(id, user);
    const test = await this.loadTest(session.testId);
    const byId = this.indexQuestions(test);
    const answers = (session.answers as Answers) ?? {};
    const includeResult = session.status !== "IN_PROGRESS";
    return this.toView(
      session,
      test.title,
      test.passingScore,
      session.questionOrder,
      byId,
      answers,
      includeResult,
    );
  }

  /**
   * Latest graded session a student completed for a given test — used by the
   * Assignment System to attach a result when the student submits a task.
   */
  async latestTestResult(
    userId: string,
    testId: string,
  ): Promise<{ sessionId: string; score: number | null } | null> {
    const s = await this.prisma.testSession.findFirst({
      where: { userId, testId, status: { in: ["SUBMITTED", "EXPIRED"] } },
      orderBy: { submittedAt: "desc" },
    });
    if (!s) return null;
    const score = s.maxScore && s.maxScore > 0 ? Math.round(((s.score ?? 0) / s.maxScore) * 100) : 0;
    return { sessionId: s.id, score };
  }

  async list(user: AuthenticatedUser): Promise<TestSessionSummary[]> {
    const rows = await this.prisma.testSession.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      take: 50,
      include: { test: { select: { title: true } } },
    });
    return rows.map((s) => ({
      id: s.id,
      testId: s.testId,
      testTitle: s.test.title,
      status: s.status as VSessionStatus,
      score: s.score,
      maxScore: s.maxScore,
      passed: s.passed,
      startedAt: s.startedAt.toISOString(),
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
    }));
  }

  // ─── Autosave ──────────────────────────────────────────────────

  async saveAnswers(id: string, user: AuthenticatedUser, answers: Answers): Promise<{ ok: true }> {
    const session = await this.loadSession(id, user);
    if (session.status !== "IN_PROGRESS") {
      throw new BadRequestException("Session is no longer active");
    }
    if (Date.now() > session.expiresAt.getTime()) {
      throw new BadRequestException("Time is up");
    }
    await this.prisma.testSession.update({
      where: { id },
      data: { answers: answers as Prisma.InputJsonValue },
    });
    return { ok: true };
  }

  // ─── Submit + auto-grade ───────────────────────────────────────

  async submit(id: string, user: AuthenticatedUser, answers: Answers): Promise<TestSessionView> {
    const session = await this.loadSession(id, user);
    const test = await this.loadTest(session.testId);
    const byId = this.indexQuestions(test);

    // Idempotent: if already graded, just return the stored result.
    if (session.status !== "IN_PROGRESS") {
      return this.toView(
        session,
        test.title,
        test.passingScore,
        session.questionOrder,
        byId,
        (session.answers as Answers) ?? {},
        true,
      );
    }

    const expired = Date.now() > session.expiresAt.getTime();
    const finalAnswers: Answers = { ...((session.answers as Answers) ?? {}), ...answers };
    const result = this.grade(session.questionOrder, byId, finalAnswers, test.passingScore);

    const updated = await this.prisma.testSession.update({
      where: { id },
      data: {
        answers: finalAnswers as Prisma.InputJsonValue,
        status: (expired ? "EXPIRED" : "SUBMITTED") as TestSessionStatus,
        score: result.score,
        maxScore: result.maxScore,
        passed: result.passed,
        submittedAt: new Date(),
      },
    });

    return this.toView(updated, test.title, test.passingScore, updated.questionOrder, byId, finalAnswers, true);
  }

  // ─── Grading ───────────────────────────────────────────────────

  private grade(
    order: string[],
    byId: Map<string, PrismaQuestion>,
    answers: Answers,
    passingScore: number,
  ): TestResult {
    const questions: QuestionResult[] = [];
    let score = 0;
    let maxScore = 0;

    for (const qid of order) {
      const q = byId.get(qid);
      if (!q) continue;
      const selected = this.normalize(answers[qid] ?? []);
      const correct = this.normalize(q.correctOptions);
      const isCorrect = this.setEqual(selected, correct);
      const awarded = isCorrect ? q.points : 0;
      score += awarded;
      maxScore += q.points;
      questions.push({
        questionId: qid,
        correctOptions: correct,
        selected,
        isCorrect,
        explanation: q.explanation,
        points: q.points,
        awarded,
      });
    }

    const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    return { score, maxScore, percent, passed: percent >= passingScore, passingScore, questions };
  }

  private normalize(arr: number[]): number[] {
    return [...new Set(arr)].sort((a, b) => a - b);
  }

  private setEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  // ─── Internals ─────────────────────────────────────────────────

  private async loadSession(id: string, user: AuthenticatedUser) {
    const session = await this.prisma.testSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException("Session not found");
    if (session.userId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException("Not your session");
    }
    return session;
  }

  private async loadTest(testId: string): Promise<TestWithQuestions> {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: testWithQuestions,
    });
    if (!test) throw new NotFoundException("Test not found");
    return test;
  }

  private indexQuestions(test: TestWithQuestions): Map<string, PrismaQuestion> {
    return new Map(test.questions.map((tq) => [tq.questionId, tq.question]));
  }

  private toPublicQuestion(q: PrismaQuestion): PublicQuestion {
    return {
      id: q.id,
      authorId: q.authorId,
      type: q.type as QuestionType,
      specialty: q.specialty as ClinicalSpecialty,
      difficulty: q.difficulty as Difficulty,
      status: q.status as CaseStatus,
      stem: q.stem,
      caseVignette: q.caseVignette,
      options: q.options,
      imageUrls: q.imageUrls,
      points: q.points,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    };
  }

  private toView(
    session: { id: string; testId: string; status: string; startedAt: Date; expiresAt: Date; submittedAt: Date | null },
    testTitle: string,
    passingScore: number,
    order: string[],
    byId: Map<string, PrismaQuestion>,
    answers: Answers,
    includeResult: boolean,
  ): TestSessionView {
    const questions = order
      .map((qid) => byId.get(qid))
      .filter((q): q is PrismaQuestion => Boolean(q))
      .map((q) => this.toPublicQuestion(q));

    const timeLimitMinutes = Math.round(
      (session.expiresAt.getTime() - session.startedAt.getTime()) / 60_000,
    );

    return {
      id: session.id,
      testId: session.testId,
      testTitle,
      status: session.status as VSessionStatus,
      timeLimitMinutes,
      startedAt: session.startedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      submittedAt: session.submittedAt ? session.submittedAt.toISOString() : null,
      questions,
      answers,
      result: includeResult ? this.grade(order, byId, answers, passingScore) : null,
    };
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
