import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditLogQuery, AuditLogView, PaginatedResult, paginate } from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  userId?: string | null;
  action: string;
  method?: string;
  path?: string;
  statusCode?: number;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist an audit entry. Audit logging must never break the request it
   * describes, so failures are swallowed (and logged at warn level).
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          method: entry.method,
          path: entry.path?.slice(0, 512),
          statusCode: entry.statusCode,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent?.slice(0, 255) ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  async findAll(query: AuditLogQuery): Promise<PaginatedResult<AuditLogView>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);

    const and: Prisma.AuditLogWhereInput[] = [];
    if (query.userId) and.push({ userId: query.userId });
    if (query.method) and.push({ method: query.method.toUpperCase() });
    if (typeof query.statusCode === "number") and.push({ statusCode: query.statusCode });
    if (query.search) {
      and.push({
        OR: [
          { action: { contains: query.search, mode: "insensitive" } },
          { path: { contains: query.search, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.AuditLogWhereInput = and.length ? { AND: and } : {};

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const items: AuditLogView[] = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.user?.email ?? null,
      action: r.action,
      method: r.method,
      path: r.path,
      statusCode: r.statusCode,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
    }));
    return paginate(items, total, page, limit);
  }
}
