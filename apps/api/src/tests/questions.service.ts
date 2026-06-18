import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CaseDifficulty,
  CaseStatus as PrismaCaseStatus,
  Prisma,
  Question as PrismaQuestion,
  QuestionType as PrismaQuestionType,
  Specialty,
  User,
} from "@prisma/client";
import {
  CaseStatus,
  ClinicalSpecialty,
  Difficulty,
  PaginatedResult,
  Question,
  QUESTION_TYPE_META,
  QuestionType,
  Role,
  paginate,
} from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { CreateQuestionDto, QueryQuestionsDto, UpdateQuestionDto } from "./dto/questions.dto";

type QuestionWithAuthor = PrismaQuestion & {
  author?: Pick<User, "firstName" | "lastName"> | null;
};

@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateQuestionDto, user: AuthenticatedUser): Promise<Question> {
    this.validateAnswerKey(dto.type, dto.options, dto.correctOptions);
    const record = await this.prisma.question.create({
      data: {
        authorId: user.id,
        type: dto.type as PrismaQuestionType,
        specialty: dto.specialty as Specialty,
        difficulty: dto.difficulty as CaseDifficulty,
        status: (dto.status ?? "DRAFT") as PrismaCaseStatus,
        stem: dto.stem,
        caseVignette: dto.caseVignette,
        options: dto.options,
        correctOptions: dto.correctOptions,
        imageUrls: dto.imageUrls ?? [],
        explanation: dto.explanation,
        points: dto.points ?? 1,
      },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    return this.toQuestion(record);
  }

  async findAll(
    query: QueryQuestionsDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<Question>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const and: Prisma.QuestionWhereInput[] = [];
    if (query.type) and.push({ type: query.type as PrismaQuestionType });
    if (query.specialty) and.push({ specialty: query.specialty as Specialty });
    if (query.difficulty) and.push({ difficulty: query.difficulty as CaseDifficulty });
    if (query.status) and.push({ status: query.status as PrismaCaseStatus });
    if (query.search) and.push({ stem: { contains: query.search, mode: "insensitive" } });

    // The bank exposes answer keys, so it is staff-only; teachers see their own,
    // admins see everything.
    if (user.role === Role.TEACHER) and.push({ authorId: user.id });

    const where: Prisma.QuestionWhereInput = and.length ? { AND: and } : {};
    const [rows, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { author: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.question.count({ where }),
    ]);
    return paginate(rows.map((r) => this.toQuestion(r)), total, page, limit);
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<Question> {
    const record = await this.load(id);
    this.assertCanEdit(record, user);
    return this.toQuestion(record);
  }

  async update(id: string, dto: UpdateQuestionDto, user: AuthenticatedUser): Promise<Question> {
    const record = await this.load(id);
    this.assertCanEdit(record, user);

    const type = (dto.type ?? record.type) as QuestionType;
    const options = dto.options ?? record.options;
    const correctOptions = dto.correctOptions ?? record.correctOptions;
    if (dto.options || dto.correctOptions || dto.type) {
      this.validateAnswerKey(type, options, correctOptions);
    }

    const updated = await this.prisma.question.update({
      where: { id },
      data: {
        type: dto.type as PrismaQuestionType | undefined,
        specialty: dto.specialty as Specialty | undefined,
        difficulty: dto.difficulty as CaseDifficulty | undefined,
        status: dto.status as PrismaCaseStatus | undefined,
        stem: dto.stem,
        caseVignette: dto.caseVignette,
        options: dto.options,
        correctOptions: dto.correctOptions,
        imageUrls: dto.imageUrls,
        explanation: dto.explanation,
        points: dto.points,
      },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    return this.toQuestion(updated);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const record = await this.load(id);
    this.assertCanEdit(record, user);
    await this.prisma.question.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ─── Internals ───

  private validateAnswerKey(type: QuestionType, options: string[], correct: number[]): void {
    if (correct.length === 0) {
      throw new BadRequestException("At least one correct option is required");
    }
    if (correct.some((i) => i < 0 || i >= options.length)) {
      throw new BadRequestException("correctOptions contains an out-of-range index");
    }
    if (new Set(correct).size !== correct.length) {
      throw new BadRequestException("correctOptions contains duplicates");
    }
    if (!QUESTION_TYPE_META[type].multi && correct.length !== 1) {
      throw new BadRequestException(`${type} must have exactly one correct option`);
    }
  }

  private async load(id: string): Promise<QuestionWithAuthor> {
    const record = await this.prisma.question.findUnique({
      where: { id },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    if (!record) throw new NotFoundException("Question not found");
    return record;
  }

  private assertCanEdit(record: QuestionWithAuthor, user: AuthenticatedUser): void {
    if (user.role !== Role.ADMIN && record.authorId !== user.id) {
      throw new ForbiddenException("You can only access questions you authored");
    }
  }

  private toQuestion(record: QuestionWithAuthor): Question {
    return {
      id: record.id,
      authorId: record.authorId,
      authorName: record.author
        ? `${record.author.firstName} ${record.author.lastName}`
        : undefined,
      type: record.type as QuestionType,
      specialty: record.specialty as ClinicalSpecialty,
      difficulty: record.difficulty as Difficulty,
      status: record.status as CaseStatus,
      stem: record.stem,
      caseVignette: record.caseVignette,
      options: record.options,
      correctOptions: record.correctOptions,
      imageUrls: record.imageUrls,
      explanation: record.explanation,
      points: record.points,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
