import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Hourly scan that warns students about assignments due within 24h that they
 * haven't submitted. `deadlineNotifiedAt` makes it idempotent (one warning).
 */
@Injectable()
export class DeadlineNotifierService {
  private readonly logger = new Logger(DeadlineNotifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: "deadline-notifier" })
  async run(): Promise<void> {
    const now = new Date();
    const soon = new Date(now.getTime() + WINDOW_MS);

    const due = await this.prisma.submission.findMany({
      where: {
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        deadlineNotifiedAt: null,
        assignment: { dueAt: { gte: now, lte: soon } },
      },
      include: { assignment: { select: { title: true, dueAt: true } } },
    });

    if (due.length === 0) return;

    await this.notifications.createMany(
      due.map((s) => ({
        userId: s.studentId,
        type: "DEADLINE_APPROACHING" as const,
        title: `Deadline approaching: ${s.assignment.title}`,
        body: `Due ${s.assignment.dueAt.toLocaleString()}`,
        link: "/tasks",
      })),
    );
    await this.prisma.submission.updateMany({
      where: { id: { in: due.map((s) => s.id) } },
      data: { deadlineNotifiedAt: now },
    });
    this.logger.log(`Sent ${due.length} deadline reminder(s).`);
  }
}
