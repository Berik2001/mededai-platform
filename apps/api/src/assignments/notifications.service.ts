import { Injectable } from "@nestjs/common";
import { NotificationType as PrismaNotificationType } from "@prisma/client";
import { NotificationType, NotificationView } from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: NotificationInput): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type as PrismaNotificationType,
        title: input.title,
        body: input.body,
        link: input.link,
      },
    });
  }

  async createMany(inputs: NotificationInput[]): Promise<void> {
    if (inputs.length === 0) return;
    await this.prisma.notification.createMany({
      data: inputs.map((i) => ({
        userId: i.userId,
        type: i.type as PrismaNotificationType,
        title: i.title,
        body: i.body,
        link: i.link,
      })),
    });
  }

  async list(user: AuthenticatedUser): Promise<NotificationView[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return rows.map((n) => ({
      id: n.id,
      type: n.type as NotificationType,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async unreadCount(user: AuthenticatedUser): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, read: false },
    });
    return { count };
  }

  async markRead(id: string, user: AuthenticatedUser): Promise<{ ok: true }> {
    await this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { read: true },
    });
    return { ok: true };
  }

  async markAllRead(user: AuthenticatedUser): Promise<{ ok: true }> {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
    return { ok: true };
  }
}
