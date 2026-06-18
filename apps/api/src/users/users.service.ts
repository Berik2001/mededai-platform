import { Injectable, NotFoundException } from "@nestjs/common";
import { PublicUser, StudentListItem } from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicUser } from "../auth/auth.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PublicUser[]> {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    return users.map(toPublicUser);
  }

  /** Active students — for teachers building groups/assignments. */
  async findStudents(): Promise<StudentListItem[]> {
    const students = await this.prisma.user.findMany({
      where: { role: "STUDENT", isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return students.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      email: s.email,
      yearOfStudy: s.yearOfStudy,
    }));
  }

  async findById(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return toPublicUser(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<PublicUser> {
    await this.findById(id); // throws if missing
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        institution: dto.institution,
        yearOfStudy: dto.yearOfStudy,
      },
    });
    return toPublicUser(user);
  }
}
