import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CaseStatus as PrismaCaseStatus } from "@prisma/client";
import { CaseStatus, ModerationItem, ModerationType } from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ModerationDecisionDto, ModerationQueryDto } from "./dto/admin.dto";

const authorSelect = { author: { select: { firstName: true, lastName: true } } };

@Injectable()
export class AdminModerationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Content awaiting (or filtered by) a moderation decision. Defaults to the DRAFT queue. */
  async list(query: ModerationQueryDto): Promise<ModerationItem[]> {
    const type = query.type ?? "ALL";
    const status: PrismaCaseStatus = (query.status as PrismaCaseStatus) ?? "DRAFT";

    const items: ModerationItem[] = [];

    if (type === "CASE" || type === "ALL") {
      const cases = await this.prisma.clinicalCase.findMany({
        where: { status },
        orderBy: { createdAt: "desc" },
        include: authorSelect,
        take: 200,
      });
      for (const c of cases) {
        items.push({
          id: c.id,
          type: "CASE",
          title: c.title,
          authorName: c.author ? `${c.author.firstName} ${c.author.lastName}` : undefined,
          specialty: c.specialty,
          status: c.status as CaseStatus,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        });
      }
    }

    if (type === "TEST" || type === "ALL") {
      const tests = await this.prisma.test.findMany({
        where: { status },
        orderBy: { createdAt: "desc" },
        include: authorSelect,
        take: 200,
      });
      for (const t of tests) {
        items.push({
          id: t.id,
          type: "TEST",
          title: t.title,
          authorName: t.author ? `${t.author.firstName} ${t.author.lastName}` : undefined,
          specialty: t.specialty,
          status: t.status as CaseStatus,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        });
      }
    }

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /** Approve (→PUBLISHED), reject (→ARCHIVED) or unpublish (→DRAFT) content. */
  async moderate(
    type: ModerationType,
    id: string,
    dto: ModerationDecisionDto,
  ): Promise<ModerationItem> {
    const status = this.statusFor(dto.decision);

    if (type === "CASE") {
      const exists = await this.prisma.clinicalCase.findUnique({ where: { id } });
      if (!exists) throw new NotFoundException("Case not found");
      const c = await this.prisma.clinicalCase.update({
        where: { id },
        data: { status },
        include: authorSelect,
      });
      return {
        id: c.id,
        type: "CASE",
        title: c.title,
        authorName: c.author ? `${c.author.firstName} ${c.author.lastName}` : undefined,
        specialty: c.specialty,
        status: c.status as CaseStatus,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    }

    if (type === "TEST") {
      const exists = await this.prisma.test.findUnique({ where: { id } });
      if (!exists) throw new NotFoundException("Test not found");
      const t = await this.prisma.test.update({
        where: { id },
        data: { status },
        include: authorSelect,
      });
      return {
        id: t.id,
        type: "TEST",
        title: t.title,
        authorName: t.author ? `${t.author.firstName} ${t.author.lastName}` : undefined,
        specialty: t.specialty,
        status: t.status as CaseStatus,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      };
    }

    throw new BadRequestException("Unknown content type");
  }

  private statusFor(decision: ModerationDecisionDto["decision"]): PrismaCaseStatus {
    switch (decision) {
      case "APPROVE":
        return "PUBLISHED";
      case "REJECT":
        return "ARCHIVED";
      case "UNPUBLISH":
        return "DRAFT";
    }
  }
}
