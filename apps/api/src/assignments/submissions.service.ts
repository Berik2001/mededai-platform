import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  AssignmentTargetType,
  Role,
  StudentTask,
  SubmissionView,
} from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { VirtualPatientService } from "../virtual-patient/virtual-patient.service";
import { TestSessionsService } from "../tests/test-sessions.service";
import { NotificationsService } from "./notifications.service";
import { AssignmentsService } from "./assignments.service";
import { ReviewSubmissionDto } from "./dto/assignments.dto";

const subInclude = {
  assignment: { include: { teacher: { select: { firstName: true, lastName: true } } } },
};
type SubmissionRecord = Prisma.SubmissionGetPayload<{ include: typeof subInclude }>;

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly virtualPatient: VirtualPatientService,
    private readonly testSessions: TestSessionsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** A student's task list. */
  async myTasks(user: AuthenticatedUser): Promise<StudentTask[]> {
    const rows = await this.prisma.submission.findMany({
      where: { studentId: user.id },
      orderBy: { assignment: { dueAt: "asc" } },
      include: subInclude,
    });
    const titles = await this.resolveTitles(rows.map((r) => r.assignment));
    return rows.map((s) => {
      const a = s.assignment;
      const key = a.targetType === "CASE" ? `CASE:${a.caseId}` : `TEST:${a.testId}`;
      return {
        submissionId: s.id,
        assignmentId: a.id,
        title: a.title,
        instructions: a.instructions,
        targetType: a.targetType as AssignmentTargetType,
        caseId: a.caseId,
        testId: a.testId,
        targetTitle: titles.get(key),
        teacherName: `${a.teacher.firstName} ${a.teacher.lastName}`,
        dueAt: a.dueAt.toISOString(),
        status: AssignmentsService.deriveStatus(s.status, a.dueAt),
        score: s.score,
        grade: s.grade,
        feedback: s.feedback,
        submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      };
    });
  }

  /**
   * Submit a task: locate the student's latest completed result for the
   * assignment's case/test and attach it. No need to pass a session id.
   */
  async submit(id: string, user: AuthenticatedUser): Promise<StudentTask> {
    const sub = await this.loadOwned(id, user);
    if (sub.status === "GRADED") {
      throw new BadRequestException("This submission has already been graded");
    }
    const a = sub.assignment;

    const result =
      a.targetType === "CASE"
        ? await this.virtualPatient.latestCaseResult(user.id, a.caseId!)
        : await this.testSessions.latestTestResult(user.id, a.testId!);

    if (!result) {
      throw new BadRequestException(
        a.targetType === "CASE"
          ? "Finish the virtual patient encounter before submitting"
          : "Complete the test before submitting",
      );
    }

    await this.prisma.submission.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        resultRef: result.sessionId,
        score: result.score,
        submittedAt: new Date(),
      },
    });

    await this.notifications.create({
      userId: a.teacherId,
      type: "SUBMISSION_RECEIVED",
      title: `Submission received for "${a.title}"`,
      link: `/assignments/${a.id}`,
    });

    return (await this.myTasks(user)).find((t) => t.submissionId === id)!;
  }

  /** Teacher review: grade + feedback. */
  async review(id: string, dto: ReviewSubmissionDto, user: AuthenticatedUser): Promise<SubmissionView> {
    const sub = await this.prisma.submission.findUnique({ where: { id }, include: subInclude });
    if (!sub) throw new NotFoundException("Submission not found");
    if (user.role !== Role.ADMIN && sub.assignment.teacherId !== user.id) {
      throw new ForbiddenException("Not your assignment");
    }

    const updated = await this.prisma.submission.update({
      where: { id },
      data: {
        grade: dto.grade,
        feedback: dto.feedback,
        status: "GRADED",
        reviewedAt: new Date(),
      },
      include: subInclude,
    });

    await this.notifications.create({
      userId: updated.studentId,
      type: "SUBMISSION_GRADED",
      title: `Your work on "${updated.assignment.title}" was reviewed`,
      body: dto.grade != null ? `Grade: ${dto.grade}/100` : undefined,
      link: "/tasks",
    });

    return this.toView(updated);
  }

  // ─── Internals ───

  private async loadOwned(id: string, user: AuthenticatedUser): Promise<SubmissionRecord> {
    const sub = await this.prisma.submission.findUnique({ where: { id }, include: subInclude });
    if (!sub) throw new NotFoundException("Submission not found");
    if (sub.studentId !== user.id) throw new ForbiddenException("Not your task");
    return sub;
  }

  private async resolveTitles(assignments: { targetType: string; caseId: string | null; testId: string | null }[]) {
    const caseIds = assignments.filter((a) => a.targetType === "CASE" && a.caseId).map((a) => a.caseId!);
    const testIds = assignments.filter((a) => a.targetType === "TEST" && a.testId).map((a) => a.testId!);
    const [cases, tests] = await Promise.all([
      caseIds.length
        ? this.prisma.clinicalCase.findMany({ where: { id: { in: caseIds } }, select: { id: true, title: true } })
        : Promise.resolve([]),
      testIds.length
        ? this.prisma.test.findMany({ where: { id: { in: testIds } }, select: { id: true, title: true } })
        : Promise.resolve([]),
    ]);
    const map = new Map<string, string>();
    cases.forEach((c) => map.set(`CASE:${c.id}`, c.title));
    tests.forEach((t) => map.set(`TEST:${t.id}`, t.title));
    return map;
  }

  private toView(sub: SubmissionRecord): SubmissionView {
    return {
      id: sub.id,
      assignmentId: sub.assignmentId,
      studentId: sub.studentId,
      status: AssignmentsService.deriveStatus(sub.status, sub.assignment.dueAt),
      resultRef: sub.resultRef,
      score: sub.score,
      submittedAt: sub.submittedAt ? sub.submittedAt.toISOString() : null,
      grade: sub.grade,
      feedback: sub.feedback,
      reviewedAt: sub.reviewedAt ? sub.reviewedAt.toISOString() : null,
    };
  }
}
