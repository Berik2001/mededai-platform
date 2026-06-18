import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AssignmentTargetType as PrismaTargetType,
  Prisma,
  SubmissionStatus as PrismaSubmissionStatus,
} from "@prisma/client";
import {
  AssignmentDetail,
  AssignmentMeta,
  AssignmentTargetType,
  Role,
  SubmissionStatus,
  SubmissionView,
} from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { GroupsService } from "./groups.service";
import { NotificationsService } from "./notifications.service";
import { CreateAssignmentDto, UpdateAssignmentDto } from "./dto/assignments.dto";

const detailInclude = {
  teacher: { select: { firstName: true, lastName: true } },
  submissions: {
    orderBy: { createdAt: "asc" as const },
    include: { student: { select: { firstName: true, lastName: true } } },
  },
};
type AssignmentRecord = Prisma.AssignmentGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groups: GroupsService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateAssignmentDto, user: AuthenticatedUser): Promise<AssignmentDetail> {
    await this.validateTarget(dto);

    // Expand group targets and merge with direct student targets.
    const fromGroups = await this.groups.memberIdsForGroups(dto.groupIds ?? [], user);
    const direct = await this.validateStudents(dto.studentIds ?? []);
    const studentIds = [...new Set([...direct, ...fromGroups])];
    if (studentIds.length === 0) {
      throw new BadRequestException("Assign to at least one student or group");
    }

    const record = await this.prisma.assignment.create({
      data: {
        teacherId: user.id,
        title: dto.title,
        instructions: dto.instructions,
        targetType: dto.targetType as PrismaTargetType,
        caseId: dto.targetType === "CASE" ? dto.caseId : null,
        testId: dto.targetType === "TEST" ? dto.testId : null,
        dueAt: new Date(dto.dueAt),
        submissions: { create: studentIds.map((studentId) => ({ studentId })) },
      },
      include: detailInclude,
    });

    await this.notifications.createMany(
      studentIds.map((studentId) => ({
        userId: studentId,
        type: "ASSIGNMENT_CREATED" as const,
        title: `New assignment: ${dto.title}`,
        body: `Due ${new Date(dto.dueAt).toLocaleString()}`,
        link: "/tasks",
      })),
    );

    const titles = await this.resolveTitles([record]);
    return this.toDetail(record, titles);
  }

  async findAll(user: AuthenticatedUser): Promise<AssignmentMeta[]> {
    const rows = await this.prisma.assignment.findMany({
      where: user.role === Role.ADMIN ? {} : { teacherId: user.id },
      orderBy: { createdAt: "desc" },
      include: detailInclude,
    });
    const titles = await this.resolveTitles(rows);
    return rows.map((r) => this.toMeta(r, titles));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<AssignmentDetail> {
    const record = await this.load(id, user);
    const titles = await this.resolveTitles([record]);
    return this.toDetail(record, titles);
  }

  async update(id: string, dto: UpdateAssignmentDto, user: AuthenticatedUser): Promise<AssignmentDetail> {
    await this.load(id, user);
    const record = await this.prisma.assignment.update({
      where: { id },
      data: {
        title: dto.title,
        instructions: dto.instructions,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      },
      include: detailInclude,
    });
    const titles = await this.resolveTitles([record]);
    return this.toDetail(record, titles);
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.load(id, user);
    await this.prisma.assignment.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ─── Internals ───

  private async load(id: string, user: AuthenticatedUser): Promise<AssignmentRecord> {
    const record = await this.prisma.assignment.findUnique({ where: { id }, include: detailInclude });
    if (!record) throw new NotFoundException("Assignment not found");
    if (user.role !== Role.ADMIN && record.teacherId !== user.id) {
      throw new ForbiddenException("Not your assignment");
    }
    return record;
  }

  private async validateTarget(dto: CreateAssignmentDto): Promise<void> {
    if (dto.targetType === "CASE") {
      if (!dto.caseId) throw new BadRequestException("caseId is required for a CASE assignment");
      const exists = await this.prisma.clinicalCase.count({ where: { id: dto.caseId } });
      if (!exists) throw new BadRequestException("Case not found");
    } else {
      if (!dto.testId) throw new BadRequestException("testId is required for a TEST assignment");
      const exists = await this.prisma.test.count({ where: { id: dto.testId } });
      if (!exists) throw new BadRequestException("Test not found");
    }
  }

  private async validateStudents(ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const found = await this.prisma.user.findMany({
      where: { id: { in: unique }, role: "STUDENT" },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException("One or more ids are not students");
    }
    return unique;
  }

  /** Resolve the title of each assignment's target case/test in two batched queries. */
  private async resolveTitles(records: { targetType: string; caseId: string | null; testId: string | null }[]) {
    const caseIds = records.filter((r) => r.targetType === "CASE" && r.caseId).map((r) => r.caseId!);
    const testIds = records.filter((r) => r.targetType === "TEST" && r.testId).map((r) => r.testId!);
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

  /** ASSIGNED/IN_PROGRESS past the deadline surface as LATE in views. */
  static deriveStatus(status: PrismaSubmissionStatus, dueAt: Date): SubmissionStatus {
    if ((status === "ASSIGNED" || status === "IN_PROGRESS") && dueAt.getTime() < Date.now()) {
      return "LATE";
    }
    return status as SubmissionStatus;
  }

  private targetTitle(record: AssignmentRecord, titles: Map<string, string>): string | undefined {
    const key = record.targetType === "CASE" ? `CASE:${record.caseId}` : `TEST:${record.testId}`;
    return titles.get(key);
  }

  private toMeta(record: AssignmentRecord, titles: Map<string, string>): AssignmentMeta {
    const submittedCount = record.submissions.filter(
      (s) => s.status === "SUBMITTED" || s.status === "GRADED",
    ).length;
    const gradedCount = record.submissions.filter((s) => s.status === "GRADED").length;
    return {
      id: record.id,
      teacherId: record.teacherId,
      teacherName: `${record.teacher.firstName} ${record.teacher.lastName}`,
      title: record.title,
      instructions: record.instructions,
      targetType: record.targetType as AssignmentTargetType,
      caseId: record.caseId,
      testId: record.testId,
      targetTitle: this.targetTitle(record, titles),
      dueAt: record.dueAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      submissionCount: record.submissions.length,
      submittedCount,
      gradedCount,
    };
  }

  private toDetail(record: AssignmentRecord, titles: Map<string, string>): AssignmentDetail {
    return {
      ...this.toMeta(record, titles),
      submissions: record.submissions.map(
        (s): SubmissionView => ({
          id: s.id,
          assignmentId: s.assignmentId,
          studentId: s.studentId,
          studentName: `${s.student.firstName} ${s.student.lastName}`,
          status: AssignmentsService.deriveStatus(s.status, record.dueAt),
          resultRef: s.resultRef,
          score: s.score,
          submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
          grade: s.grade,
          feedback: s.feedback,
          reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
        }),
      ),
    };
  }
}
