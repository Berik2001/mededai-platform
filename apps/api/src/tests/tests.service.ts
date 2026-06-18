import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CaseDifficulty,
  CaseStatus as PrismaCaseStatus,
  Prisma,
  Specialty,
} from "@prisma/client";
import {
  CaseStatus,
  ClinicalSpecialty,
  Difficulty,
  PaginatedResult,
  Role,
  TestDetail,
  TestMeta,
  paginate,
} from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { CreateTestDto, QueryTestsDto, UpdateTestDto } from "./dto/tests.dto";

const testInclude = {
  author: { select: { firstName: true, lastName: true } },
  _count: { select: { questions: true } },
  questions: { orderBy: { order: "asc" as const }, select: { questionId: true, order: true } },
};

type TestRecord = Prisma.TestGetPayload<{ include: typeof testInclude }>;

@Injectable()
export class TestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTestDto, user: AuthenticatedUser): Promise<TestDetail> {
    await this.assertQuestionsExist(dto.questionIds);
    const record = await this.prisma.test.create({
      data: {
        authorId: user.id,
        title: dto.title,
        description: dto.description,
        specialty: dto.specialty as Specialty,
        difficulty: dto.difficulty as CaseDifficulty,
        status: (dto.status ?? "DRAFT") as PrismaCaseStatus,
        timeLimitMinutes: dto.timeLimitMinutes ?? 20,
        passingScore: dto.passingScore ?? 60,
        shuffle: dto.shuffle ?? false,
        questions: {
          create: dto.questionIds.map((questionId, order) => ({ questionId, order })),
        },
      },
      include: testInclude,
    });
    return this.toDetail(record);
  }

  async findAll(query: QueryTestsDto, user: AuthenticatedUser): Promise<PaginatedResult<TestMeta>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const and: Prisma.TestWhereInput[] = [];
    if (query.specialty) and.push({ specialty: query.specialty as Specialty });
    if (query.difficulty) and.push({ difficulty: query.difficulty as CaseDifficulty });
    if (query.status) and.push({ status: query.status as PrismaCaseStatus });
    if (query.search) and.push({ title: { contains: query.search, mode: "insensitive" } });

    if (user.role === Role.STUDENT || user.role === Role.EXAMINER) {
      and.push({ status: "PUBLISHED" });
    } else if (user.role === Role.TEACHER) {
      and.push({ OR: [{ status: "PUBLISHED" }, { authorId: user.id }] });
    }

    const where: Prisma.TestWhereInput = and.length ? { AND: and } : {};
    const [rows, total] = await Promise.all([
      this.prisma.test.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: testInclude,
      }),
      this.prisma.test.count({ where }),
    ]);
    return paginate(rows.map((r) => this.toMeta(r)), total, page, limit);
  }

  /** Detail for staff (includes question ids); students get metadata only. */
  async findOne(id: string, user: AuthenticatedUser): Promise<TestDetail | TestMeta> {
    const record = await this.load(id);
    if (!this.isVisible(record, user)) throw new NotFoundException("Test not found");
    return this.canEdit(record, user) ? this.toDetail(record) : this.toMeta(record);
  }

  async update(id: string, dto: UpdateTestDto, user: AuthenticatedUser): Promise<TestDetail> {
    const record = await this.load(id);
    this.assertCanEdit(record, user);
    if (dto.questionIds) await this.assertQuestionsExist(dto.questionIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.questionIds) {
        await tx.testQuestion.deleteMany({ where: { testId: id } });
        await tx.testQuestion.createMany({
          data: dto.questionIds.map((questionId, order) => ({ testId: id, questionId, order })),
        });
      }
      return tx.test.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          specialty: dto.specialty as Specialty | undefined,
          difficulty: dto.difficulty as CaseDifficulty | undefined,
          status: dto.status as PrismaCaseStatus | undefined,
          timeLimitMinutes: dto.timeLimitMinutes,
          passingScore: dto.passingScore,
          shuffle: dto.shuffle,
        },
        include: testInclude,
      });
    });
    return this.toDetail(updated);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const record = await this.load(id);
    this.assertCanEdit(record, user);
    await this.prisma.test.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ─── Internals ───

  private async assertQuestionsExist(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    const count = await this.prisma.question.count({ where: { id: { in: unique } } });
    if (count !== unique.length) {
      throw new BadRequestException("One or more questionIds do not exist");
    }
  }

  private async load(id: string): Promise<TestRecord> {
    const record = await this.prisma.test.findUnique({ where: { id }, include: testInclude });
    if (!record) throw new NotFoundException("Test not found");
    return record;
  }

  private isVisible(record: TestRecord, user: AuthenticatedUser): boolean {
    if (user.role === Role.ADMIN) return true;
    if (record.authorId === user.id) return true;
    return record.status === "PUBLISHED";
  }

  private canEdit(record: TestRecord, user: AuthenticatedUser): boolean {
    return user.role === Role.ADMIN || record.authorId === user.id;
  }

  private assertCanEdit(record: TestRecord, user: AuthenticatedUser): void {
    if (!this.canEdit(record, user)) {
      throw new ForbiddenException("You can only modify tests you authored");
    }
  }

  private toMeta(record: TestRecord): TestMeta {
    return {
      id: record.id,
      authorId: record.authorId,
      authorName: record.author
        ? `${record.author.firstName} ${record.author.lastName}`
        : undefined,
      title: record.title,
      description: record.description,
      specialty: record.specialty as ClinicalSpecialty,
      difficulty: record.difficulty as Difficulty,
      status: record.status as CaseStatus,
      timeLimitMinutes: record.timeLimitMinutes,
      passingScore: record.passingScore,
      shuffle: record.shuffle,
      questionCount: record._count.questions,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toDetail(record: TestRecord): TestDetail {
    return {
      ...this.toMeta(record),
      questionIds: record.questions.map((q) => q.questionId),
    };
  }
}
