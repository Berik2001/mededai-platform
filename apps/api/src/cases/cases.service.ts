import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  CaseDifficulty,
  CaseStatus as PrismaCaseStatus,
  ClinicalCase as PrismaCase,
  Prisma,
  Specialty,
  User,
} from "@prisma/client";
import {
  CaseStatus,
  CaseVisibleContent,
  ClinicalCaseFull,
  ClinicalCaseMeta,
  ClinicalSpecialty,
  Difficulty,
  PaginatedResult,
  Role,
  paginate,
} from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import { VirtualPatientService, VPScenarioSeed } from "../virtual-patient/virtual-patient.service";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { CaseContent, CaseContentDocument } from "./schemas/case-content.schema";
import { CreateCaseDto } from "./dto/create-case.dto";
import { UpdateCaseDto } from "./dto/update-case.dto";
import { QueryCasesDto } from "./dto/query-cases.dto";

type CaseWithAuthor = PrismaCase & { author?: Pick<User, "firstName" | "lastName"> | null };

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(CaseContent.name) private readonly contentModel: Model<CaseContentDocument>,
    private readonly virtualPatient: VirtualPatientService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────

  async create(dto: CreateCaseDto, user: AuthenticatedUser): Promise<ClinicalCaseFull> {
    // Content first; if the metadata write fails we roll the content back.
    const content = await this.contentModel.create({ ...dto.content });
    let meta: CaseWithAuthor;
    try {
      meta = await this.prisma.clinicalCase.create({
        data: {
          authorId: user.id,
          title: dto.title,
          specialty: dto.specialty as Specialty,
          difficulty: dto.difficulty as CaseDifficulty,
          status: (dto.status ?? "DRAFT") as PrismaCaseStatus,
          summary: dto.summary,
          estimatedMinutes: dto.estimatedMinutes,
          tags: dto.tags ?? [],
          contentId: content.id,
        },
        include: { author: { select: { firstName: true, lastName: true } } },
      });
    } catch (err) {
      await content.deleteOne();
      throw err;
    }

    content.metaId = meta.id;
    await content.save();
    return this.toFull(meta, content, /* canEdit */ true);
  }

  // ─── List ──────────────────────────────────────────────────────

  async findAll(
    query: QueryCasesDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<ClinicalCaseMeta>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const and: Prisma.ClinicalCaseWhereInput[] = [];
    if (query.specialty) and.push({ specialty: query.specialty as Specialty });
    if (query.difficulty) and.push({ difficulty: query.difficulty as CaseDifficulty });
    if (query.search) and.push({ title: { contains: query.search, mode: "insensitive" } });
    if (query.status) and.push({ status: query.status as PrismaCaseStatus });

    // Visibility: students/examiners only see published; teachers also see their
    // own drafts; admins see everything.
    if (user.role === Role.STUDENT || user.role === Role.EXAMINER) {
      and.push({ status: "PUBLISHED" });
    } else if (user.role === Role.TEACHER) {
      and.push({ OR: [{ status: "PUBLISHED" }, { authorId: user.id }] });
    }

    const where: Prisma.ClinicalCaseWhereInput = and.length ? { AND: and } : {};

    const [rows, total] = await Promise.all([
      this.prisma.clinicalCase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { author: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.clinicalCase.count({ where }),
    ]);

    return paginate(rows.map((r) => this.toMeta(r)), total, page, limit);
  }

  // ─── Get one ───────────────────────────────────────────────────

  async findOne(id: string, user: AuthenticatedUser): Promise<ClinicalCaseFull> {
    const meta = await this.loadMeta(id);
    if (!this.isVisible(meta, user)) {
      throw new NotFoundException("Case not found");
    }
    const content = await this.loadContent(meta.contentId);
    return this.toFull(meta, content, this.canEdit(meta, user));
  }

  // ─── Update ────────────────────────────────────────────────────

  async update(id: string, dto: UpdateCaseDto, user: AuthenticatedUser): Promise<ClinicalCaseFull> {
    const meta = await this.loadMeta(id);
    this.assertCanEdit(meta, user);

    const updated = await this.prisma.clinicalCase.update({
      where: { id },
      data: {
        title: dto.title,
        specialty: dto.specialty as Specialty | undefined,
        difficulty: dto.difficulty as CaseDifficulty | undefined,
        status: dto.status as PrismaCaseStatus | undefined,
        summary: dto.summary,
        estimatedMinutes: dto.estimatedMinutes,
        tags: dto.tags,
      },
      include: { author: { select: { firstName: true, lastName: true } } },
    });

    const content = await this.loadContent(meta.contentId);
    if (dto.content) {
      Object.assign(content, dto.content);
      await content.save();
    }
    return this.toFull(updated, content, true);
  }

  // ─── Delete ────────────────────────────────────────────────────

  async remove(id: string, user: AuthenticatedUser) {
    const meta = await this.loadMeta(id);
    this.assertCanEdit(meta, user);
    await this.contentModel.deleteOne({ _id: meta.contentId }).exec();
    await this.prisma.clinicalCase.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ─── Launch a Virtual Patient session from the case ────────────

  async launch(id: string, user: AuthenticatedUser): Promise<{ sessionId: string }> {
    const meta = await this.loadMeta(id);
    if (!this.isVisible(meta, user)) {
      throw new NotFoundException("Case not found");
    }
    const content = await this.loadContent(meta.contentId);

    const seed: VPScenarioSeed = {
      title: meta.title,
      specialty: meta.specialty,
      difficulty: meta.difficulty as Difficulty,
      patient: content.patient,
      presentingComplaint: content.initialComplaint,
      background: content.fullBackground || content.presentation || content.initialComplaint,
      initialVitals: content.initialVitals ?? {},
      hiddenDiagnosis: content.hiddenDiagnosis,
      diagnosisSynonyms: content.diagnosisSynonyms ?? [],
      correctTreatments: content.correctTreatments ?? [],
      contraindicatedTreatments: content.contraindicatedTreatments ?? [],
      examFindings: content.examFindings ?? [],
      redFlags: content.redFlags ?? [],
    };

    const session = await this.virtualPatient.createFromScenario(seed, user, { sourceCaseId: meta.id });
    return { sessionId: session.id };
  }

  // ─── Internals ─────────────────────────────────────────────────

  private async loadMeta(id: string): Promise<CaseWithAuthor> {
    const meta = await this.prisma.clinicalCase.findUnique({
      where: { id },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    if (!meta) throw new NotFoundException("Case not found");
    return meta;
  }

  private async loadContent(contentId: string): Promise<CaseContentDocument> {
    const content = await this.contentModel.findById(contentId).exec();
    if (!content) throw new NotFoundException("Case content not found");
    return content;
  }

  private isVisible(meta: CaseWithAuthor, user: AuthenticatedUser): boolean {
    if (user.role === Role.ADMIN) return true;
    if (meta.authorId === user.id) return true;
    return meta.status === "PUBLISHED";
  }

  private canEdit(meta: CaseWithAuthor, user: AuthenticatedUser): boolean {
    return user.role === Role.ADMIN || meta.authorId === user.id;
  }

  private assertCanEdit(meta: CaseWithAuthor, user: AuthenticatedUser): void {
    if (!this.canEdit(meta, user)) {
      throw new ForbiddenException("You can only modify cases you authored");
    }
  }

  private toMeta(record: CaseWithAuthor): ClinicalCaseMeta {
    return {
      id: record.id,
      authorId: record.authorId,
      authorName: record.author
        ? `${record.author.firstName} ${record.author.lastName}`
        : undefined,
      title: record.title,
      specialty: record.specialty as ClinicalSpecialty,
      difficulty: record.difficulty as Difficulty,
      status: record.status as CaseStatus,
      summary: record.summary,
      estimatedMinutes: record.estimatedMinutes,
      tags: record.tags,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toVisibleContent(c: CaseContentDocument): CaseVisibleContent {
    return {
      patient: c.patient,
      initialComplaint: c.initialComplaint,
      presentation: c.presentation,
      initialVitals: c.initialVitals,
      learningObjectives: c.learningObjectives,
      references: c.references,
    };
  }

  private toFull(
    meta: CaseWithAuthor,
    content: CaseContentDocument,
    canEdit: boolean,
  ): ClinicalCaseFull {
    return {
      meta: this.toMeta(meta),
      content: canEdit
        ? {
            ...this.toVisibleContent(content),
            fullBackground: content.fullBackground,
            hiddenDiagnosis: content.hiddenDiagnosis,
            diagnosisSynonyms: content.diagnosisSynonyms,
            differentialDiagnoses: content.differentialDiagnoses,
            clinicalPathway: content.clinicalPathway,
            examFindings: content.examFindings,
            correctTreatments: content.correctTreatments,
            contraindicatedTreatments: content.contraindicatedTreatments,
            redFlags: content.redFlags,
          }
        : this.toVisibleContent(content),
      canEdit,
      redacted: !canEdit,
    };
  }
}
