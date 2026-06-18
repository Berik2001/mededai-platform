import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { GroupView, Role } from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { AddMembersDto, CreateGroupDto, UpdateGroupDto } from "./dto/assignments.dto";

const groupInclude = {
  members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
};
type GroupRecord = Prisma.GroupGetPayload<{ include: typeof groupInclude }>;

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGroupDto, user: AuthenticatedUser): Promise<GroupView> {
    const memberIds = await this.validateStudents(dto.memberIds ?? []);
    const group = await this.prisma.group.create({
      data: {
        name: dto.name,
        ownerId: user.id,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: groupInclude,
    });
    return this.toView(group, true);
  }

  async list(user: AuthenticatedUser): Promise<GroupView[]> {
    const rows = await this.prisma.group.findMany({
      where: user.role === Role.ADMIN ? {} : { ownerId: user.id },
      orderBy: { createdAt: "desc" },
      include: groupInclude,
    });
    return rows.map((g) => this.toView(g, false));
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<GroupView> {
    const group = await this.load(id, user);
    return this.toView(group, true);
  }

  async updateName(id: string, dto: UpdateGroupDto, user: AuthenticatedUser): Promise<GroupView> {
    await this.load(id, user);
    const group = await this.prisma.group.update({
      where: { id },
      data: { name: dto.name },
      include: groupInclude,
    });
    return this.toView(group, true);
  }

  async addMembers(id: string, dto: AddMembersDto, user: AuthenticatedUser): Promise<GroupView> {
    await this.load(id, user);
    const memberIds = await this.validateStudents(dto.userIds);
    await this.prisma.groupMember.createMany({
      data: memberIds.map((userId) => ({ groupId: id, userId })),
      skipDuplicates: true,
    });
    return this.findOne(id, user);
  }

  async removeMember(id: string, userId: string, user: AuthenticatedUser): Promise<GroupView> {
    await this.load(id, user);
    await this.prisma.groupMember.deleteMany({ where: { groupId: id, userId } });
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.load(id, user);
    await this.prisma.group.delete({ where: { id } });
    return { deleted: true, id };
  }

  /** Unique student ids belonging to the given groups (caller must own them). */
  async memberIdsForGroups(groupIds: string[], user: AuthenticatedUser): Promise<string[]> {
    if (groupIds.length === 0) return [];
    const groups = await this.prisma.group.findMany({
      where: { id: { in: groupIds } },
      include: { members: { select: { userId: true } } },
    });
    for (const g of groups) {
      if (user.role !== Role.ADMIN && g.ownerId !== user.id) {
        throw new ForbiddenException("You do not own one of the selected groups");
      }
    }
    return [...new Set(groups.flatMap((g) => g.members.map((m) => m.userId)))];
  }

  // ─── Internals ───

  private async load(id: string, user: AuthenticatedUser): Promise<GroupRecord> {
    const group = await this.prisma.group.findUnique({ where: { id }, include: groupInclude });
    if (!group) throw new NotFoundException("Group not found");
    if (user.role !== Role.ADMIN && group.ownerId !== user.id) {
      throw new ForbiddenException("Not your group");
    }
    return group;
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

  private toView(group: GroupRecord, withMembers: boolean): GroupView {
    return {
      id: group.id,
      name: group.name,
      ownerId: group.ownerId,
      memberCount: group.members.length,
      members: withMembers
        ? group.members.map((m) => ({
            id: m.user.id,
            name: `${m.user.firstName} ${m.user.lastName}`,
            email: m.user.email,
          }))
        : undefined,
      createdAt: group.createdAt.toISOString(),
    };
  }
}
