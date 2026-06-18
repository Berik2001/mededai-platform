import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { CaseStatus as PrismaCaseStatus, Prisma, Specialty } from "@prisma/client";
import {
  CaseStatus,
  ClinicalSpecialty,
  OsceExamDetail,
  OsceExamMeta,
  OsceExamPublic,
  OsceStationPublic,
  OsceStationView,
  Role,
} from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { CreateOsceExamDto, QueryOsceExamsDto, UpdateOsceExamDto } from "./dto/osce.dto";

const examInclude = {
  author: { select: { firstName: true, lastName: true } },
  stations: {
    orderBy: { order: "asc" as const },
    include: { checklist: { orderBy: { order: "asc" as const } } },
  },
};
type ExamRecord = Prisma.OsceExamGetPayload<{ include: typeof examInclude }>;
type StationRecord = ExamRecord["stations"][number];

@Injectable()
export class OsceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOsceExamDto, user: AuthenticatedUser): Promise<OsceExamDetail> {
    const record = await this.prisma.osceExam.create({
      data: {
        authorId: user.id,
        title: dto.title,
        description: dto.description,
        specialty: dto.specialty as Specialty,
        status: (dto.status ?? "DRAFT") as PrismaCaseStatus,
        passScore: dto.passScore ?? 60,
        stations: { create: this.buildStations(dto) },
      },
      include: examInclude,
    });
    return this.toDetail(record);
  }

  async findAll(query: QueryOsceExamsDto, user: AuthenticatedUser): Promise<OsceExamMeta[]> {
    const and: Prisma.OsceExamWhereInput[] = [];
    if (query.specialty) and.push({ specialty: query.specialty as Specialty });
    if (query.status) and.push({ status: query.status as PrismaCaseStatus });
    if (query.search) and.push({ title: { contains: query.search, mode: "insensitive" } });

    if (user.role === Role.STUDENT || user.role === Role.EXAMINER) {
      and.push({ status: "PUBLISHED" });
    } else if (user.role === Role.TEACHER) {
      and.push({ OR: [{ status: "PUBLISHED" }, { authorId: user.id }] });
    }

    const rows = await this.prisma.osceExam.findMany({
      where: and.length ? { AND: and } : {},
      orderBy: { createdAt: "desc" },
      include: examInclude,
    });
    return rows.map((r) => this.toMeta(r));
  }

  /** Author/admin get the full detail (checklists + hidden truth); others a safe view. */
  async findOne(id: string, user: AuthenticatedUser): Promise<OsceExamDetail | OsceExamPublic> {
    const record = await this.load(id);
    if (!this.isVisible(record, user)) throw new NotFoundException("Exam not found");
    return this.canEdit(record, user) ? this.toDetail(record) : this.toPublic(record);
  }

  async update(id: string, dto: UpdateOsceExamDto, user: AuthenticatedUser): Promise<OsceExamDetail> {
    const record = await this.load(id);
    this.assertCanEdit(record, user);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.stations) {
        // Replacing stations cascades to checklist items (and any sessions'
        // station scores), so block edits once the exam has been run.
        const used = await tx.osceSession.count({ where: { examId: id } });
        if (used > 0) {
          throw new ForbiddenException("Cannot change stations of an exam that has sessions");
        }
        await tx.osceStation.deleteMany({ where: { examId: id } });
      }
      return tx.osceExam.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          specialty: dto.specialty as Specialty | undefined,
          status: dto.status as PrismaCaseStatus | undefined,
          passScore: dto.passScore,
          stations: dto.stations ? { create: this.buildStations(dto as CreateOsceExamDto) } : undefined,
        },
        include: examInclude,
      });
    });
    return this.toDetail(updated);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const record = await this.load(id);
    this.assertCanEdit(record, user);
    await this.prisma.osceExam.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ─── Internals ───

  private buildStations(dto: CreateOsceExamDto) {
    return dto.stations.map((s, order) => ({
      order,
      title: s.title,
      scenario: s.scenario,
      durationSec: s.durationSec,
      expectedDiagnosis: s.expectedDiagnosis,
      correctPathway: s.correctPathway,
      examinerBrief: s.examinerBrief,
      checklist: {
        create: s.checklist.map((c, cOrder) => ({
          order: cOrder,
          label: c.label,
          points: c.points ?? 1,
          critical: c.critical ?? false,
          category: c.category,
        })),
      },
    }));
  }

  private async load(id: string): Promise<ExamRecord> {
    const record = await this.prisma.osceExam.findUnique({ where: { id }, include: examInclude });
    if (!record) throw new NotFoundException("Exam not found");
    return record;
  }

  private isVisible(record: ExamRecord, user: AuthenticatedUser): boolean {
    if (user.role === Role.ADMIN) return true;
    if (record.authorId === user.id) return true;
    return record.status === "PUBLISHED";
  }

  private canEdit(record: ExamRecord, user: AuthenticatedUser): boolean {
    return user.role === Role.ADMIN || record.authorId === user.id;
  }

  private assertCanEdit(record: ExamRecord, user: AuthenticatedUser): void {
    if (!this.canEdit(record, user)) {
      throw new ForbiddenException("You can only modify exams you authored");
    }
  }

  private stationMax(station: StationRecord): number {
    return station.checklist.reduce((sum, c) => sum + c.points, 0);
  }

  private toMeta(record: ExamRecord): OsceExamMeta {
    return {
      id: record.id,
      authorId: record.authorId,
      authorName: record.author
        ? `${record.author.firstName} ${record.author.lastName}`
        : undefined,
      title: record.title,
      description: record.description,
      specialty: record.specialty as ClinicalSpecialty,
      status: record.status as CaseStatus,
      passScore: record.passScore,
      stationCount: record.stations.length,
      totalDurationSec: record.stations.reduce((sum, s) => sum + s.durationSec, 0),
      maxScore: record.stations.reduce((sum, s) => sum + this.stationMax(s), 0),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toStationView(station: StationRecord): OsceStationView {
    return {
      id: station.id,
      order: station.order,
      title: station.title,
      scenario: station.scenario,
      durationSec: station.durationSec,
      expectedDiagnosis: station.expectedDiagnosis,
      correctPathway: station.correctPathway,
      examinerBrief: station.examinerBrief,
      maxScore: this.stationMax(station),
      checklist: station.checklist.map((c) => ({
        id: c.id,
        order: c.order,
        label: c.label,
        points: c.points,
        critical: c.critical,
        category: c.category,
      })),
    };
  }

  private toDetail(record: ExamRecord): OsceExamDetail {
    return { ...this.toMeta(record), stations: record.stations.map((s) => this.toStationView(s)) };
  }

  private toPublic(record: ExamRecord): OsceExamPublic {
    const stations: OsceStationPublic[] = record.stations.map((s) => ({
      id: s.id,
      order: s.order,
      title: s.title,
      scenario: s.scenario,
      durationSec: s.durationSec,
    }));
    return { ...this.toMeta(record), stations };
  }
}
