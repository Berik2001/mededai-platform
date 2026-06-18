import { Injectable } from "@nestjs/common";
import { ALL_ROLES, RoleCount, StatusBreakdown, SystemStats } from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import { VirtualPatientService } from "../virtual-patient/virtual-patient.service";

@Injectable()
export class AdminStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vp: VirtualPatientService,
  ) {}

  async system(): Promise<SystemStats> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      userTotal,
      userActive,
      userNew,
      usersByRole,
      caseGroups,
      testGroups,
      questions,
      osceExams,
      testSessions,
      testSessionsCompleted,
      vpStats,
      osceSessions,
      osceCompleted,
      assignments,
      submissions,
      gradedSessions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
      this.prisma.clinicalCase.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.test.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.question.count(),
      this.prisma.osceExam.count(),
      this.prisma.testSession.count(),
      this.prisma.testSession.count({ where: { status: { in: ["SUBMITTED", "EXPIRED"] } } }),
      this.vp.sessionStats(),
      this.prisma.osceSession.count(),
      this.prisma.osceSession.count({ where: { status: "COMPLETED" } }),
      this.prisma.assignment.count(),
      this.prisma.submission.count(),
      this.prisma.testSession.findMany({
        where: { status: { in: ["SUBMITTED", "EXPIRED"] } },
        select: { score: true, maxScore: true, passed: true },
      }),
    ]);

    const byRole: RoleCount[] = ALL_ROLES.map((role) => ({
      role,
      count: usersByRole.find((g) => g.role === role)?._count._all ?? 0,
    }));

    let percentSum = 0;
    let percentCount = 0;
    let testsPassed = 0;
    let testsFailed = 0;
    for (const s of gradedSessions) {
      if (s.maxScore && s.maxScore > 0) {
        percentSum += ((s.score ?? 0) / s.maxScore) * 100;
        percentCount++;
      }
      if (s.passed === true) testsPassed++;
      else if (s.passed === false) testsFailed++;
    }

    return {
      generatedAt: new Date().toISOString(),
      users: {
        total: userTotal,
        active: userActive,
        blocked: userTotal - userActive,
        newLast7Days: userNew,
        byRole,
      },
      content: {
        cases: this.breakdown(caseGroups),
        tests: this.breakdown(testGroups),
        questions,
        osceExams,
      },
      activity: {
        testSessions,
        testSessionsCompleted,
        vpSessions: vpStats.total,
        vpCompleted: vpStats.completed,
        osceSessions,
        osceCompleted,
        assignments,
        submissions,
      },
      results: {
        avgTestScore: percentCount > 0 ? Math.round(percentSum / percentCount) : null,
        testsPassed,
        testsFailed,
      },
    };
  }

  private breakdown(groups: { status: string; _count: { _all: number } }[]): StatusBreakdown {
    const get = (status: string) => groups.find((g) => g.status === status)?._count._all ?? 0;
    return {
      total: groups.reduce((sum, g) => sum + g._count._all, 0),
      draft: get("DRAFT"),
      published: get("PUBLISHED"),
      archived: get("ARCHIVED"),
    };
  }
}
