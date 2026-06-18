import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CohortAnalytics,
  CohortStudentRow,
  ErrorCategoryCount,
  MasteryBucket,
  Role,
  SpecialtyAccuracy,
  StudentAnalytics,
} from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { AnalyticsAggregatorService, StudentMetrics } from "./analytics-aggregator.service";
import { ClassifiedErrors, ErrorClassifierService } from "./error-classifier.service";
import { RecommendationService } from "./recommendation.service";

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregator: AnalyticsAggregatorService,
    private readonly classifier: ErrorClassifierService,
    private readonly recommender: RecommendationService,
  ) {}

  // ─── Single student (full, AI-assisted) ───

  async forSelf(user: AuthenticatedUser): Promise<StudentAnalytics> {
    return this.buildStudent(user.id, { useAi: true });
  }

  async forStudent(studentId: string, requester: AuthenticatedUser): Promise<StudentAnalytics> {
    if (requester.role !== Role.ADMIN && requester.role !== Role.TEACHER) {
      throw new ForbiddenException("Insufficient role");
    }
    return this.buildStudent(studentId, { useAi: true });
  }

  private async buildStudent(studentId: string, opts: { useAi: boolean }): Promise<StudentAnalytics> {
    const name = await this.studentName(studentId);
    const metrics = await this.aggregator.metricsFor(studentId, name);
    const classified = await this.classifier.classify(metrics.errorEvents, { useAi: opts.useAi });
    const recs = await this.recommender.generate(metrics, classified.byCategory);
    return this.assemble(metrics, classified, recs);
  }

  private assemble(
    metrics: StudentMetrics,
    classified: ClassifiedErrors,
    recs: {
      summary: string;
      focusAreas: string[];
      recommendations: StudentAnalytics["recommendations"];
      insights: StudentAnalytics["insights"];
      aiGenerated: boolean;
    },
  ): StudentAnalytics {
    return {
      studentId: metrics.studentId,
      studentName: metrics.studentName,
      generatedAt: new Date().toISOString(),
      hasData: metrics.hasData,
      overallAccuracy: metrics.overallAccuracy,
      diagnosticAccuracy: metrics.diagnosticAccuracy,
      decisionSpeed: metrics.decisionSpeed,
      errorsByCategory: classified.byCategory,
      totalErrors: classified.total,
      accuracyBySpecialty: metrics.accuracyBySpecialty,
      weakTopics: metrics.weakTopics,
      progress: metrics.progress,
      recommendations: recs.recommendations,
      focusAreas: recs.focusAreas,
      aiSummary: recs.summary,
      insights: recs.insights,
      aiGenerated: recs.aiGenerated,
    };
  }

  // ─── Cohort (teacher/admin) ───

  async overview(user: AuthenticatedUser, groupId?: string): Promise<CohortAnalytics> {
    if (user.role !== Role.ADMIN && user.role !== Role.TEACHER) {
      throw new ForbiddenException("Insufficient role");
    }

    const { students, groupName } = await this.resolveCohort(user, groupId);

    const perStudent = await Promise.all(
      students.map(async (s) => {
        const metrics = await this.aggregator.metricsFor(s.id, `${s.firstName} ${s.lastName}`);
        const classified = await this.classifier.classify(metrics.errorEvents, { useAi: false });
        return { student: s, metrics, classified };
      }),
    );

    const active = perStudent.filter((p) => p.metrics.hasData);

    // Per-student rows
    const rows: CohortStudentRow[] = perStudent.map(({ student, metrics, classified }) => ({
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      masteryScore: metrics.progress.masteryScore,
      diagnosticAccuracy: metrics.diagnosticAccuracy,
      overallAccuracy: metrics.overallAccuracy,
      totalErrors: classified.total,
      weakestSpecialty: metrics.weakTopics[0]?.label ?? null,
      activityCount: metrics.progress.activityTimeline.length,
    }));
    rows.sort((a, b) => b.masteryScore - a.masteryScore);

    // Aggregate errors
    const errorMap = new Map<string, ErrorCategoryCount>();
    for (const p of perStudent) {
      for (const e of p.classified.byCategory) {
        const cur = errorMap.get(e.category);
        if (cur) cur.count += e.count;
        else errorMap.set(e.category, { ...e });
      }
    }
    const errorsByCategory = [...errorMap.values()].sort((a, b) => b.count - a.count);

    // Aggregate specialty accuracy (weighted by attempts)
    const specMap = new Map<string, { label: string; scoreSum: number; attempts: number }>();
    for (const p of perStudent) {
      for (const s of p.metrics.accuracyBySpecialty) {
        const cur = specMap.get(s.specialty) ?? { label: s.label, scoreSum: 0, attempts: 0 };
        cur.scoreSum += s.accuracy * s.attempts;
        cur.attempts += s.attempts;
        specMap.set(s.specialty, cur);
      }
    }
    const accuracyBySpecialty: SpecialtyAccuracy[] = [...specMap.entries()]
      .map(([specialty, a]) => ({
        specialty,
        label: a.label,
        accuracy: a.attempts > 0 ? Math.round(a.scoreSum / a.attempts) : 0,
        attempts: a.attempts,
      }))
      .sort((x, y) => x.label.localeCompare(y.label));

    // Averages over active students
    const avg = (pick: (m: StudentMetrics) => number) =>
      active.length ? Math.round(active.reduce((s, p) => s + pick(p.metrics), 0) / active.length) : 0;
    const speedVals = active
      .map((p) => p.metrics.decisionSpeed.avgSecondsPerQuestion)
      .filter((v): v is number => v !== null);

    const masteryDistribution = this.distribution(active.map((p) => p.metrics.progress.masteryScore));

    return {
      generatedAt: new Date().toISOString(),
      groupId: groupId ?? null,
      groupName: groupName ?? null,
      studentCount: students.length,
      activeStudentCount: active.length,
      averages: {
        masteryScore: avg((m) => m.progress.masteryScore),
        diagnosticAccuracy: avg((m) => m.diagnosticAccuracy),
        overallAccuracy: avg((m) => m.overallAccuracy),
        avgSecondsPerQuestion: speedVals.length
          ? Math.round(speedVals.reduce((s, v) => s + v, 0) / speedVals.length)
          : null,
      },
      errorsByCategory,
      accuracyBySpecialty,
      masteryDistribution,
      students: rows,
    };
  }

  // ─── CSV export ───

  async exportStudentCsv(studentId: string, user: AuthenticatedUser): Promise<{ filename: string; csv: string }> {
    const a = await this.forStudent(studentId, user);
    const lines: string[] = [];
    lines.push(`Student report,${csv(a.studentName)}`);
    lines.push(`Generated,${a.generatedAt}`);
    lines.push("");
    lines.push("Metric,Value");
    lines.push(`Mastery score,${a.progress.masteryScore}`);
    lines.push(`Trend,${a.progress.trend}`);
    lines.push(`Overall accuracy,${a.overallAccuracy}%`);
    lines.push(`Diagnostic accuracy,${a.diagnosticAccuracy}%`);
    lines.push(`Avg seconds/question,${a.decisionSpeed.avgSecondsPerQuestion ?? "n/a"}`);
    lines.push(`Tests / VP / OSCE,${a.progress.testsTaken} / ${a.progress.vpCompleted} / ${a.progress.osceCompleted}`);
    lines.push(`Total errors,${a.totalErrors}`);
    lines.push("");
    lines.push("Specialty,Accuracy,Attempts");
    for (const s of a.accuracyBySpecialty) lines.push(`${csv(s.label)},${s.accuracy}%,${s.attempts}`);
    lines.push("");
    lines.push("Error category,Count");
    for (const e of a.errorsByCategory) lines.push(`${csv(e.label)},${e.count}`);
    lines.push("");
    lines.push("Recommendation,Priority,Detail");
    for (const r of a.recommendations) lines.push(`${csv(r.title)},${r.priority},${csv(r.detail)}`);
    return { filename: `analytics-${slug(a.studentName)}.csv`, csv: lines.join("\n") };
  }

  async exportGroupCsv(user: AuthenticatedUser, groupId?: string): Promise<{ filename: string; csv: string }> {
    const overview = await this.overview(user, groupId);
    const lines: string[] = [];
    lines.push(`Cohort report,${csv(overview.groupName ?? "All students")}`);
    lines.push(`Generated,${overview.generatedAt}`);
    lines.push(`Students,${overview.studentCount},Active,${overview.activeStudentCount}`);
    lines.push("");
    lines.push("Name,Email,Mastery,Overall accuracy,Diagnostic accuracy,Total errors,Weakest specialty,Activities");
    for (const r of overview.students) {
      lines.push(
        [
          csv(r.studentName),
          csv(r.email ?? ""),
          r.masteryScore,
          `${r.overallAccuracy}%`,
          `${r.diagnosticAccuracy}%`,
          r.totalErrors,
          csv(r.weakestSpecialty ?? ""),
          r.activityCount,
        ].join(","),
      );
    }
    return { filename: `cohort-analytics${groupId ? `-${groupId}` : ""}.csv`, csv: lines.join("\n") };
  }

  // ─── Internals ───

  private async resolveCohort(user: AuthenticatedUser, groupId?: string) {
    if (groupId) {
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        include: { members: { include: { user: true } } },
      });
      if (!group) throw new NotFoundException("Group not found");
      if (user.role !== Role.ADMIN && group.ownerId !== user.id) {
        throw new ForbiddenException("Not your group");
      }
      const students = group.members
        .map((m) => m.user)
        .filter((u) => u.role === "STUDENT")
        .map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email }));
      return { students, groupName: group.name };
    }
    const students = await this.prisma.user.findMany({
      where: { role: "STUDENT", isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    return { students, groupName: null as string | null };
  }

  private async studentName(studentId: string): Promise<string> {
    const u = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { firstName: true, lastName: true },
    });
    if (!u) throw new NotFoundException("Student not found");
    return `${u.firstName} ${u.lastName}`;
  }

  private distribution(scores: number[]): MasteryBucket[] {
    const buckets = ["0–20", "20–40", "40–60", "60–80", "80–100"];
    const counts = [0, 0, 0, 0, 0];
    for (const s of scores) {
      const idx = Math.min(4, Math.floor(s / 20));
      counts[idx]++;
    }
    return buckets.map((bucket, i) => ({ bucket, count: counts[i] }));
  }
}

function csv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "student";
}
