import { Injectable } from "@nestjs/common";
import {
  ActivityPoint,
  CLINICAL_SPECIALTY_LABELS,
  ClinicalSpecialty,
  DecisionSpeed,
  ProgressSummary,
  ProgressTrend,
  SpecialtyAccuracy,
  SpeedRating,
  WeakTopic,
} from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import { VirtualPatientService } from "../virtual-patient/virtual-patient.service";
import { ErrorEvent } from "./error-classifier.service";

/** Deterministic metrics for one student (everything except AI classification/recommendations). */
export interface StudentMetrics {
  studentId: string;
  studentName: string;
  hasData: boolean;
  overallAccuracy: number;
  diagnosticAccuracy: number;
  decisionSpeed: DecisionSpeed;
  accuracyBySpecialty: SpecialtyAccuracy[];
  weakTopics: WeakTopic[];
  progress: ProgressSummary;
  errorEvents: ErrorEvent[];
}

const DIAGNOSTIC_TYPES = ["IMAGE_DIAGNOSIS", "ECG_INTERPRETATION", "RADIOLOGY", "CASE_BASED"];
const CLINICAL_SET = new Set<string>(Object.values(ClinicalSpecialty));
const VP_SPECIALTY_ALIAS: Record<string, ClinicalSpecialty> = {
  EMERGENCY: ClinicalSpecialty.CRITICAL_CARE,
  EMERGENCY_MEDICINE: ClinicalSpecialty.CRITICAL_CARE,
  INTENSIVE_CARE: ClinicalSpecialty.CRITICAL_CARE,
  INTERNAL_MEDICINE: ClinicalSpecialty.THERAPY,
  INTERNAL: ClinicalSpecialty.THERAPY,
  GENERAL_MEDICINE: ClinicalSpecialty.THERAPY,
  PEDIATRIC: ClinicalSpecialty.PEDIATRICS,
  OBSTETRICS: ClinicalSpecialty.SURGERY,
};

interface Acc {
  scoreSum: number;
  weight: number;
}

@Injectable()
export class AnalyticsAggregatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vp: VirtualPatientService,
  ) {}

  async metricsFor(studentId: string, studentName: string): Promise<StudentMetrics> {
    const errorEvents: ErrorEvent[] = [];
    const activity: ActivityPoint[] = [];
    const specialtyAcc = new Map<string, Acc & { attempts: number }>();
    const diag = { correct: 0, total: 0 };
    const speedTests = { seconds: 0, questions: 0 };
    const speedVp = { minutes: 0, encounters: 0 };
    let overallCorrect = 0;
    let overallTotal = 0;
    let testsTaken = 0;
    let vpCompleted = 0;
    let osceCompleted = 0;
    let casesCompleted = 0;

    const addSpecialty = (specialty: string, scorePct: number) => {
      const cur = specialtyAcc.get(specialty) ?? { scoreSum: 0, weight: 0, attempts: 0 };
      cur.scoreSum += scorePct;
      cur.weight += 1;
      cur.attempts += 1;
      specialtyAcc.set(specialty, cur);
    };

    // ─── Tests (Postgres) ───
    const testSessions = await this.prisma.testSession.findMany({
      where: { userId: studentId, status: { in: ["SUBMITTED", "EXPIRED"] } },
      orderBy: { submittedAt: "asc" },
      include: { test: { select: { title: true } } },
    });
    const qids = [...new Set(testSessions.flatMap((s) => s.questionOrder))];
    const questions = qids.length
      ? await this.prisma.question.findMany({
          where: { id: { in: qids } },
          select: { id: true, type: true, specialty: true, correctOptions: true, stem: true },
        })
      : [];
    const qmap = new Map(questions.map((q) => [q.id, q]));

    for (const s of testSessions) {
      const answers = (s.answers as Record<string, number[]>) ?? {};
      let correct = 0;
      let total = 0;
      for (const qid of s.questionOrder) {
        const q = qmap.get(qid);
        if (!q) continue;
        total++;
        const isCorrect = this.setEqual(this.norm(answers[qid] ?? []), this.norm(q.correctOptions));
        if (isCorrect) correct++;
        overallTotal++;
        if (isCorrect) overallCorrect++;
        addSpecialty(q.specialty, isCorrect ? 100 : 0);
        if (DIAGNOSTIC_TYPES.includes(q.type)) {
          diag.total++;
          if (isCorrect) diag.correct++;
        }
        if (!isCorrect) {
          errorEvents.push({ text: q.stem, hint: this.questionTypeHint(q.type) });
        }
      }
      if (s.submittedAt && total > 0) {
        const secs = (s.submittedAt.getTime() - s.startedAt.getTime()) / 1000;
        if (secs > 0 && secs < 24 * 3600) {
          speedTests.seconds += secs;
          speedTests.questions += total;
        }
      }
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      activity.push({
        date: (s.submittedAt ?? s.startedAt).toISOString(),
        source: "TEST",
        label: s.test.title,
        score: pct,
      });
      testsTaken++;
    }

    // ─── Virtual Patient (Mongo) ───
    const vpRecords = await this.vp.analyticsForUser(studentId);
    for (const r of vpRecords) {
      if (r.status !== "COMPLETED") continue;
      vpCompleted++;
      const score = r.score ?? 0;
      activity.push({
        date: (r.completedAt ?? r.createdAt).toISOString(),
        source: "VIRTUAL_PATIENT",
        label: r.title,
        score,
      });
      if (r.diagnosisCorrect !== null) {
        diag.total++;
        if (r.diagnosisCorrect) diag.correct++;
      }
      const spec = this.mapVpSpecialty(r.specialty);
      if (spec) addSpecialty(spec, score);
      if (r.completedAt) {
        const mins = (r.completedAt.getTime() - r.createdAt.getTime()) / 60000;
        if (mins > 0 && mins < 240) {
          speedVp.minutes += mins;
          speedVp.encounters++;
        }
      }
      for (const rf of r.missedRedFlags) {
        errorEvents.push({ text: `Missed red flag: ${rf}`, hint: "SAFETY" });
      }
      if (r.diagnosisCorrect === false) {
        errorEvents.push({ text: `Incorrect diagnosis in "${r.title}"`, hint: "DIAGNOSIS" });
      }
      if (r.gaveContraindicated) {
        errorEvents.push({ text: `Contraindicated treatment given in "${r.title}"`, hint: "MANAGEMENT" });
      }
    }

    // ─── OSCE (Postgres) ───
    const osceSessions = await this.prisma.osceSession.findMany({
      where: { studentId, status: "COMPLETED" },
      orderBy: { completedAt: "asc" },
      include: {
        exam: { select: { title: true, specialty: true, passScore: true } },
        stationScores: {
          include: { station: { include: { checklist: true } }, checkResults: true },
        },
      },
    });
    for (const o of osceSessions) {
      osceCompleted++;
      activity.push({
        date: (o.completedAt ?? o.createdAt).toISOString(),
        source: "OSCE",
        label: o.exam.title,
        score: o.percent,
      });
      addSpecialty(o.exam.specialty, o.percent);
      for (const ss of o.stationScores) {
        const checked = new Map(ss.checkResults.map((r) => [r.checklistItemId, r.checked]));
        if (ss.station.expectedDiagnosis) {
          diag.total++;
          const stationPct = ss.maxScore > 0 ? (ss.score / ss.maxScore) * 100 : 0;
          if (stationPct >= o.exam.passScore && !ss.criticalFailed) diag.correct++;
        }
        for (const c of ss.station.checklist) {
          if (!checked.get(c.id)) {
            errorEvents.push({ text: c.label, hint: this.osceCategoryHint(c.category, c.critical) });
          }
        }
      }
    }

    // ─── Clinical case progress (Postgres) ───
    const caseRows = await this.prisma.caseProgress.findMany({ where: { userId: studentId } });
    for (const c of caseRows) {
      if (c.status === "COMPLETED") {
        casesCompleted++;
        activity.push({
          date: (c.completedAt ?? c.updatedAt).toISOString(),
          source: "CASE",
          label: "Clinical case",
          score: c.score ?? 0,
        });
      }
    }

    // ─── Derive ───
    const accuracyBySpecialty: SpecialtyAccuracy[] = [...specialtyAcc.entries()]
      .map(([specialty, a]) => ({
        specialty,
        label: this.specialtyLabel(specialty),
        accuracy: a.weight > 0 ? Math.round(a.scoreSum / a.weight) : 0,
        attempts: a.attempts,
      }))
      .sort((x, y) => x.label.localeCompare(y.label));

    const weakTopics: WeakTopic[] = [...accuracyBySpecialty]
      .filter((s) => s.attempts >= 1)
      .sort((x, y) => x.accuracy - y.accuracy)
      .slice(0, 3)
      .map((s) => ({ specialty: s.specialty, label: s.label, accuracy: s.accuracy, attempts: s.attempts }));

    activity.sort((a, b) => a.date.localeCompare(b.date));
    const masteryScore = activity.length
      ? Math.round(activity.reduce((sum, p) => sum + p.score, 0) / activity.length)
      : 0;

    const progress: ProgressSummary = {
      masteryScore,
      trend: this.trend(activity),
      testsTaken,
      vpCompleted,
      osceCompleted,
      casesCompleted,
      activityTimeline: activity,
    };

    const decisionSpeed: DecisionSpeed = {
      avgSecondsPerQuestion: speedTests.questions > 0 ? Math.round(speedTests.seconds / speedTests.questions) : null,
      avgMinutesPerEncounter: speedVp.encounters > 0 ? Math.round(speedVp.minutes / speedVp.encounters) : null,
      rating: this.speedRating(speedTests.questions > 0 ? speedTests.seconds / speedTests.questions : null),
    };

    return {
      studentId,
      studentName,
      hasData: activity.length > 0 || errorEvents.length > 0,
      overallAccuracy: overallTotal > 0 ? Math.round((overallCorrect / overallTotal) * 100) : 0,
      diagnosticAccuracy: diag.total > 0 ? Math.round((diag.correct / diag.total) * 100) : 0,
      decisionSpeed,
      accuracyBySpecialty,
      weakTopics,
      progress,
      errorEvents,
    };
  }

  // ─── Helpers ───

  private norm(arr: number[]): number[] {
    return [...new Set(arr)].sort((a, b) => a - b);
  }
  private setEqual(a: number[], b: number[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  private questionTypeHint(type: string): ErrorEvent["hint"] {
    switch (type) {
      case "IMAGE_DIAGNOSIS":
      case "CASE_BASED":
        return "DIAGNOSIS";
      case "ECG_INTERPRETATION":
      case "RADIOLOGY":
        return "INVESTIGATION";
      default:
        return "KNOWLEDGE";
    }
  }

  private osceCategoryHint(category: string | null, critical: boolean): ErrorEvent["hint"] {
    if (critical) return "SAFETY";
    if (!category) return undefined;
    const c = category.toLowerCase();
    if (c.includes("hist")) return "HISTORY";
    if (c.includes("exam")) return "EXAMINATION";
    if (c.includes("invest") || c.includes("ecg") || c.includes("imag")) return "INVESTIGATION";
    if (c.includes("diagn")) return "DIAGNOSIS";
    if (c.includes("manag") || c.includes("treat")) return "MANAGEMENT";
    if (c.includes("commun")) return "COMMUNICATION";
    if (c.includes("safet")) return "SAFETY";
    return undefined;
  }

  private mapVpSpecialty(raw: string): string | null {
    const up = raw.toUpperCase();
    if (CLINICAL_SET.has(up)) return up;
    return VP_SPECIALTY_ALIAS[up] ?? null;
  }

  private specialtyLabel(specialty: string): string {
    if (CLINICAL_SET.has(specialty)) {
      return CLINICAL_SPECIALTY_LABELS[specialty as ClinicalSpecialty].en;
    }
    return specialty;
  }

  private speedRating(secondsPerQuestion: number | null): SpeedRating {
    if (secondsPerQuestion === null) return "UNKNOWN";
    if (secondsPerQuestion < 30) return "FAST";
    if (secondsPerQuestion <= 75) return "MODERATE";
    return "DELIBERATE";
  }

  private trend(activity: ActivityPoint[]): ProgressTrend {
    if (activity.length < 3) return "UNKNOWN";
    const mid = Math.floor(activity.length / 2);
    const avg = (arr: ActivityPoint[]) => arr.reduce((s, p) => s + p.score, 0) / arr.length;
    const first = avg(activity.slice(0, mid));
    const second = avg(activity.slice(mid));
    const delta = second - first;
    if (delta > 5) return "IMPROVING";
    if (delta < -5) return "DECLINING";
    return "STEADY";
  }
}
