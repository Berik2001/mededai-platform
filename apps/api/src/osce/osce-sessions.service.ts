import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  ClinicalSpecialty,
  OsceChatMessage,
  OsceCheckResultView,
  OsceLiveView,
  OsceSelfStation,
  OsceSelfView,
  OsceSessionStatus,
  OsceSessionSummary,
  OsceSessionView,
  OsceStationScoreView,
  OsceStationState,
  Role,
} from "@med/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { OsceAiService, StationForDebrief } from "./osce-ai.service";
import { CreateOsceSessionDto, OsceCheckDto } from "./dto/osce.dto";

const sessionInclude = {
  exam: { select: { id: true, title: true, specialty: true, passScore: true, authorId: true } },
  student: { select: { firstName: true, lastName: true } },
  examiner: { select: { firstName: true, lastName: true } },
  stationScores: {
    include: {
      station: { include: { checklist: { orderBy: { order: "asc" as const } } } },
      checkResults: true,
    },
  },
};
type SessionRecord = Prisma.OsceSessionGetPayload<{ include: typeof sessionInclude }>;
type StationScoreRecord = SessionRecord["stationScores"][number];

@Injectable()
export class OsceSessionsService {
  private readonly logger = new Logger(OsceSessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OsceAiService,
  ) {}

  // ─── Create ───

  async create(dto: CreateOsceSessionDto, user: AuthenticatedUser): Promise<OsceSessionView> {
    const exam = await this.prisma.osceExam.findUnique({
      where: { id: dto.examId },
      include: { stations: { orderBy: { order: "asc" }, include: { checklist: true } } },
    });
    if (!exam) throw new NotFoundException("Exam not found");

    const isOwnerOrAdmin = user.role === Role.ADMIN || exam.authorId === user.id;
    if (exam.status !== "PUBLISHED" && !isOwnerOrAdmin) {
      throw new NotFoundException("Exam not found");
    }
    if (exam.stations.length === 0) {
      throw new BadRequestException("This exam has no stations");
    }

    const student = await this.prisma.user.findFirst({
      where: { id: dto.studentId, role: "STUDENT" },
      select: { id: true },
    });
    if (!student) throw new BadRequestException("studentId is not a student");

    const maxScore = exam.stations.reduce(
      (sum, st) => sum + st.checklist.reduce((s, c) => s + c.points, 0),
      0,
    );

    const session = await this.prisma.osceSession.create({
      data: {
        examId: exam.id,
        studentId: dto.studentId,
        examinerId: user.id,
        status: "SCHEDULED",
        selfConduct: dto.selfConduct ?? false,
        maxScore,
        stationScores: {
          create: exam.stations.map((st) => ({
            stationId: st.id,
            maxScore: st.checklist.reduce((s, c) => s + c.points, 0),
            checkResults: {
              create: st.checklist.map((c) => ({ checklistItemId: c.id, checked: false })),
            },
          })),
        },
      },
      include: sessionInclude,
    });
    return this.toView(session);
  }

  // ─── Read ───

  async list(user: AuthenticatedUser): Promise<OsceSessionSummary[]> {
    let where: Prisma.OsceSessionWhereInput;
    if (user.role === Role.ADMIN) where = {};
    else if (user.role === Role.STUDENT) where = { studentId: user.id };
    else where = { examinerId: user.id };

    const rows = await this.prisma.osceSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        exam: { select: { title: true, specialty: true } },
        student: { select: { firstName: true, lastName: true } },
        examiner: { select: { firstName: true, lastName: true } },
        _count: { select: { stationScores: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      examId: r.examId,
      examTitle: r.exam.title,
      specialty: r.exam.specialty as ClinicalSpecialty,
      status: r.status as OsceSessionStatus,
      selfConduct: r.selfConduct,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      examinerName: `${r.examiner.firstName} ${r.examiner.lastName}`,
      percent: r.percent,
      stationCount: r._count.stationScores,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Examiner conduct view (full checklist + hidden ground truth). */
  async findOne(id: string, user: AuthenticatedUser): Promise<OsceSessionView> {
    const session = await this.loadConduct(id, user);
    return this.toView(session);
  }

  /** Student live view — current station task + timer, no answers. */
  async live(id: string, user: AuthenticatedUser): Promise<OsceLiveView> {
    const session = await this.loadParticipant(id, user);
    const scores = this.ordered(session);

    let currentIndex = scores.findIndex((s) => s.state === "ACTIVE");
    if (currentIndex < 0) {
      const lastDone = [...scores].reverse().findIndex((s) => s.state === "DONE");
      currentIndex = lastDone < 0 ? -1 : scores.length - 1 - lastDone;
    }

    const current = currentIndex >= 0 ? scores[currentIndex] : null;
    return {
      id: session.id,
      examTitle: session.exam.title,
      specialty: session.exam.specialty as ClinicalSpecialty,
      status: session.status as OsceSessionStatus,
      stationCount: scores.length,
      currentIndex,
      completed: session.status === "COMPLETED",
      currentStation: current
        ? {
            order: current.station.order,
            title: current.station.title,
            scenario: current.station.scenario,
            durationSec: current.station.durationSec,
            state: current.state as OsceStationState,
            startedAt: current.startedAt ? current.startedAt.toISOString() : null,
            endsAt: this.endsAt(current),
          }
        : null,
    };
  }

  // ─── Conduct ───

  async startStation(id: string, stationId: string, user: AuthenticatedUser): Promise<OsceSessionView> {
    const session = await this.loadConduct(id, user);
    this.assertActive(session);
    const score = this.stationScore(session, stationId);

    await this.prisma.$transaction([
      this.prisma.osceSession.update({
        where: { id },
        data: { status: "IN_PROGRESS", startedAt: session.startedAt ?? new Date() },
      }),
      this.prisma.osceStationScore.update({
        where: { id: score.id },
        data: { state: "ACTIVE", startedAt: new Date(), endedAt: null },
      }),
    ]);
    return this.findOne(id, user);
  }

  async check(
    id: string,
    stationId: string,
    dto: OsceCheckDto,
    user: AuthenticatedUser,
  ): Promise<OsceSessionView> {
    const session = await this.loadConduct(id, user);
    this.assertActive(session);
    const score = this.stationScore(session, stationId);

    const validIds = new Set(score.station.checklist.map((c) => c.id));
    for (const item of dto.items) {
      if (!validIds.has(item.checklistItemId)) {
        throw new BadRequestException(`Unknown checklist item: ${item.checklistItemId}`);
      }
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.osceCheckResult.update({
          where: {
            stationScoreId_checklistItemId: {
              stationScoreId: score.id,
              checklistItemId: item.checklistItemId,
            },
          },
          data: { checked: item.checked, note: item.note },
        }),
      ),
    );
    if (dto.examinerComment !== undefined) {
      await this.prisma.osceStationScore.update({
        where: { id: score.id },
        data: { examinerComment: dto.examinerComment },
      });
    }
    await this.recompute(score.id);
    return this.findOne(id, user);
  }

  /**
   * AI-conducted grading: instead of the examiner ticking boxes, the student's
   * free-text account of the station is graded by AI against the hidden checklist.
   */
  async aiGrade(
    id: string,
    stationId: string,
    transcript: string,
    user: AuthenticatedUser,
  ): Promise<OsceSessionView> {
    const session = await this.loadConduct(id, user);
    this.assertActive(session);
    const score = this.stationScore(session, stationId);

    const grade = await this.ai.gradeStation({
      title: score.station.title,
      scenario: score.station.scenario,
      expectedDiagnosis: score.station.expectedDiagnosis,
      items: score.station.checklist.map((c) => ({
        id: c.id,
        label: c.label,
        critical: c.critical,
      })),
      transcript,
    });

    const marked = new Map(grade.marks.map((m) => [m.id, m.checked]));
    await this.prisma.$transaction(
      score.station.checklist.map((c) =>
        this.prisma.osceCheckResult.update({
          where: {
            stationScoreId_checklistItemId: {
              stationScoreId: score.id,
              checklistItemId: c.id,
            },
          },
          data: { checked: marked.get(c.id) ?? false },
        }),
      ),
    );
    await this.prisma.osceStationScore.update({
      where: { id: score.id },
      data: { examinerComment: grade.comment },
    });
    await this.recompute(score.id);
    return this.findOne(id, user);
  }

  async endStation(id: string, stationId: string, user: AuthenticatedUser): Promise<OsceSessionView> {
    const session = await this.loadConduct(id, user);
    this.assertActive(session);
    const score = this.stationScore(session, stationId);
    await this.recompute(score.id);
    await this.prisma.osceStationScore.update({
      where: { id: score.id },
      data: { state: "DONE", endedAt: new Date() },
    });
    return this.findOne(id, user);
  }

  async complete(id: string, user: AuthenticatedUser): Promise<OsceSessionView> {
    const session = await this.loadConduct(id, user);
    if (session.status === "COMPLETED") return this.toView(session);
    await this.runCompletion(id);
    return this.findOne(id, user);
  }

  /**
   * Finalise scoring + AI debrief for a session, regardless of who triggered it
   * (examiner "complete" or student self-conduct finishing the last station).
   * Idempotent: a session already COMPLETED is left untouched.
   */
  private async runCompletion(id: string): Promise<void> {
    const session = await this.load(id);
    if (session.status === "COMPLETED") return;

    // Recompute every station (untouched stations with unchecked critical items
    // must surface as critical failures) before grading.
    await Promise.all(this.ordered(session).map((s) => this.recompute(s.id)));
    const fresh = await this.load(id);

    const stationsData: StationForDebrief[] = this.ordered(fresh).map((s) => {
      const checked = new Map(s.checkResults.map((r) => [r.checklistItemId, r.checked]));
      return {
        stationId: s.stationId,
        title: s.station.title,
        scenario: s.station.scenario,
        expectedDiagnosis: s.station.expectedDiagnosis,
        correctPathway: s.station.correctPathway,
        examinerComment: s.examinerComment,
        score: s.score,
        maxScore: s.maxScore,
        criticalFailed: s.criticalFailed,
        items: s.station.checklist.map((c) => ({
          label: c.label,
          critical: c.critical,
          points: c.points,
          checked: checked.get(c.id) ?? false,
        })),
      };
    });

    const debrief = await this.ai.buildDebrief(stationsData, fresh.exam.passScore);
    await this.prisma.osceSession.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        totalScore: debrief.totalScore,
        maxScore: debrief.maxScore,
        percent: debrief.score,
        debrief: debrief as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // ─── Self-conduct (student-driven, AI patient) ───

  /** Student self-conduct view — task + AI-patient chat only, no hidden truth. */
  async self(id: string, user: AuthenticatedUser): Promise<OsceSelfView> {
    const session = await this.loadSelfConduct(id, user);
    return this.selfView(session);
  }

  /** Student begins their self-conducted exam: opens the first station. */
  async selfStart(id: string, user: AuthenticatedUser): Promise<OsceSelfView> {
    const session = await this.loadSelfConduct(id, user);
    this.assertActive(session);
    const scores = this.ordered(session);

    // If a station is already active, just return the current view (idempotent).
    if (!scores.some((s) => s.state === "ACTIVE")) {
      const first = scores.find((s) => s.state === "PENDING");
      if (!first) throw new BadRequestException("All stations are already done");
      await this.prisma.$transaction([
        this.prisma.osceSession.update({
          where: { id },
          data: { status: "IN_PROGRESS", startedAt: session.startedAt ?? new Date() },
        }),
        this.prisma.osceStationScore.update({
          where: { id: first.id },
          data: { state: "ACTIVE", startedAt: new Date(), endedAt: null },
        }),
      ]);
    }
    return this.self(id, user);
  }

  /** Student sends a line to the AI patient on the active station. */
  async selfChat(
    id: string,
    stationId: string,
    message: string,
    user: AuthenticatedUser,
  ): Promise<OsceSelfView> {
    const session = await this.loadSelfConduct(id, user);
    this.assertActive(session);
    const score = this.stationScore(session, stationId);
    if (score.state !== "ACTIVE") {
      throw new BadRequestException("This station is not active");
    }

    const history = this.readChat(score);
    const reply = await this.ai.patientReply({
      title: score.station.title,
      scenario: score.station.scenario,
      expectedDiagnosis: score.station.expectedDiagnosis,
      correctPathway: score.station.correctPathway,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      message,
    });

    const now = new Date().toISOString();
    const next: OsceChatMessage[] = [
      ...history,
      { role: "student", content: message, at: now },
      { role: "patient", content: reply, at: now },
    ];
    await this.prisma.osceStationScore.update({
      where: { id: score.id },
      data: { chat: next as unknown as Prisma.InputJsonValue },
    });
    return this.self(id, user);
  }

  /**
   * Student finishes the active station (manually or when its timer runs out):
   * AI grades the chat transcript, the station is marked DONE, and the next
   * station auto-starts. When the last station finishes, the exam is completed
   * and the debrief generated.
   */
  async selfFinish(id: string, stationId: string, user: AuthenticatedUser): Promise<OsceSelfView> {
    const session = await this.loadSelfConduct(id, user);
    this.assertActive(session);
    const score = this.stationScore(session, stationId);
    if (score.state === "DONE") return this.self(id, user);

    // Grade the station from the AI-patient transcript (skip if no dialogue).
    const history = this.readChat(score);
    if (history.length > 0) {
      const transcript = history
        .map((m) => `${m.role === "student" ? "Студент" : "Пациент"}: ${m.content}`)
        .join("\n");
      try {
        const grade = await this.ai.gradeStation({
          title: score.station.title,
          scenario: score.station.scenario,
          expectedDiagnosis: score.station.expectedDiagnosis,
          items: score.station.checklist.map((c) => ({
            id: c.id,
            label: c.label,
            critical: c.critical,
          })),
          transcript,
        });
        const marked = new Map(grade.marks.map((m) => [m.id, m.checked]));
        await this.prisma.$transaction(
          score.station.checklist.map((c) =>
            this.prisma.osceCheckResult.update({
              where: {
                stationScoreId_checklistItemId: {
                  stationScoreId: score.id,
                  checklistItemId: c.id,
                },
              },
              data: { checked: marked.get(c.id) ?? false },
            }),
          ),
        );
        await this.prisma.osceStationScore.update({
          where: { id: score.id },
          data: { examinerComment: grade.comment },
        });
      } catch (err) {
        this.logger.warn(`OSCE self-grade failed for station ${stationId}: ${(err as Error).message}`);
      }
    }
    await this.recompute(score.id);
    await this.prisma.osceStationScore.update({
      where: { id: score.id },
      data: { state: "DONE", endedAt: new Date() },
    });

    // Auto-advance to the next pending station, or finish the whole exam.
    const fresh = await this.load(id);
    const nextStation = this.ordered(fresh).find((s) => s.state === "PENDING");
    if (nextStation) {
      await this.prisma.osceStationScore.update({
        where: { id: nextStation.id },
        data: { state: "ACTIVE", startedAt: new Date(), endedAt: null },
      });
    } else {
      await this.runCompletion(id);
    }
    return this.self(id, user);
  }

  private readChat(score: StationScoreRecord): OsceChatMessage[] {
    const raw = score.chat;
    return Array.isArray(raw) ? (raw as unknown as OsceChatMessage[]) : [];
  }

  private async loadSelfConduct(id: string, user: AuthenticatedUser): Promise<SessionRecord> {
    const session = await this.load(id);
    if (!session.selfConduct) {
      throw new ForbiddenException("This session is not a self-conducted exam");
    }
    const allowed = user.role === Role.ADMIN || session.studentId === user.id;
    if (!allowed) throw new ForbiddenException("Not your session");
    return session;
  }

  private selfView(session: SessionRecord): OsceSelfView {
    const scores = this.ordered(session);
    let currentIndex = scores.findIndex((s) => s.state === "ACTIVE");
    if (currentIndex < 0) {
      const lastDone = [...scores].reverse().findIndex((s) => s.state === "DONE");
      currentIndex = lastDone < 0 ? -1 : scores.length - 1 - lastDone;
    }
    const stations: OsceSelfStation[] = scores.map((s) => ({
      stationId: s.stationId,
      order: s.station.order,
      title: s.station.title,
      scenario: s.station.scenario,
      durationSec: s.station.durationSec,
      state: s.state as OsceStationState,
      startedAt: s.startedAt ? s.startedAt.toISOString() : null,
      endsAt: this.endsAt(s),
      chat: this.readChat(s),
    }));
    return {
      id: session.id,
      examTitle: session.exam.title,
      specialty: session.exam.specialty as ClinicalSpecialty,
      status: session.status as OsceSessionStatus,
      selfConduct: session.selfConduct,
      passScore: session.exam.passScore,
      stationCount: scores.length,
      currentIndex,
      completed: session.status === "COMPLETED",
      stations,
    };
  }

  async debrief(id: string, user: AuthenticatedUser) {
    const session = await this.loadParticipant(id, user);
    if (session.status !== "COMPLETED" || !session.debrief) {
      throw new BadRequestException("Exam is not complete yet");
    }
    return session.debrief;
  }

  // ─── Internals ───

  private async recompute(scoreId: string): Promise<void> {
    const score = await this.prisma.osceStationScore.findUnique({
      where: { id: scoreId },
      include: { station: { include: { checklist: true } }, checkResults: true },
    });
    if (!score) return;
    const checked = new Map(score.checkResults.map((r) => [r.checklistItemId, r.checked]));
    let sum = 0;
    let max = 0;
    let criticalFailed = false;
    for (const c of score.station.checklist) {
      max += c.points;
      if (checked.get(c.id)) sum += c.points;
      else if (c.critical) criticalFailed = true;
    }
    await this.prisma.osceStationScore.update({
      where: { id: scoreId },
      data: { score: sum, maxScore: max, criticalFailed },
    });
  }

  private async loadConduct(id: string, user: AuthenticatedUser): Promise<SessionRecord> {
    const session = await this.load(id);
    if (user.role !== Role.ADMIN && session.examinerId !== user.id) {
      throw new ForbiddenException("Only the examiner can conduct this session");
    }
    return session;
  }

  private async loadParticipant(id: string, user: AuthenticatedUser): Promise<SessionRecord> {
    const session = await this.load(id);
    const allowed =
      user.role === Role.ADMIN ||
      session.examinerId === user.id ||
      session.studentId === user.id;
    if (!allowed) throw new ForbiddenException("Not your session");
    return session;
  }

  private async load(id: string): Promise<SessionRecord> {
    const session = await this.prisma.osceSession.findUnique({ where: { id }, include: sessionInclude });
    if (!session) throw new NotFoundException("Session not found");
    return session;
  }

  private assertActive(session: SessionRecord): void {
    if (session.status === "COMPLETED" || session.status === "CANCELLED") {
      throw new BadRequestException("This session is closed");
    }
  }

  private ordered(session: SessionRecord): StationScoreRecord[] {
    return [...session.stationScores].sort((a, b) => a.station.order - b.station.order);
  }

  private stationScore(session: SessionRecord, stationId: string): StationScoreRecord {
    const score = session.stationScores.find((s) => s.stationId === stationId);
    if (!score) throw new NotFoundException("Station not part of this session");
    return score;
  }

  private endsAt(score: StationScoreRecord): string | null {
    if (score.state !== "ACTIVE" || !score.startedAt) return null;
    return new Date(score.startedAt.getTime() + score.station.durationSec * 1000).toISOString();
  }

  private toStationView(score: StationScoreRecord): OsceStationScoreView {
    const checked = new Map(score.checkResults.map((r) => [r.checklistItemId, r]));
    const checklist: OsceCheckResultView[] = score.station.checklist.map((c) => {
      const r = checked.get(c.id);
      return {
        checklistItemId: c.id,
        label: c.label,
        points: c.points,
        critical: c.critical,
        category: c.category,
        checked: r?.checked ?? false,
        note: r?.note ?? null,
      };
    });
    return {
      stationId: score.stationId,
      order: score.station.order,
      title: score.station.title,
      scenario: score.station.scenario,
      durationSec: score.station.durationSec,
      state: score.state as OsceStationState,
      startedAt: score.startedAt ? score.startedAt.toISOString() : null,
      endsAt: this.endsAt(score),
      endedAt: score.endedAt ? score.endedAt.toISOString() : null,
      score: score.score,
      maxScore: score.maxScore,
      criticalFailed: score.criticalFailed,
      examinerComment: score.examinerComment,
      expectedDiagnosis: score.station.expectedDiagnosis,
      correctPathway: score.station.correctPathway,
      examinerBrief: score.station.examinerBrief,
      checklist,
    };
  }

  private toView(session: SessionRecord): OsceSessionView {
    const stations = this.ordered(session).map((s) => this.toStationView(s));
    const totalScore = stations.reduce((sum, s) => sum + s.score, 0);
    const maxScore = stations.reduce((sum, s) => sum + s.maxScore, 0);
    return {
      id: session.id,
      examId: session.examId,
      examTitle: session.exam.title,
      specialty: session.exam.specialty as ClinicalSpecialty,
      status: session.status as OsceSessionStatus,
      selfConduct: session.selfConduct,
      studentId: session.studentId,
      studentName: `${session.student.firstName} ${session.student.lastName}`,
      examinerId: session.examinerId,
      examinerName: `${session.examiner.firstName} ${session.examiner.lastName}`,
      passScore: session.exam.passScore,
      totalScore,
      maxScore,
      percent: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      stations,
      startedAt: session.startedAt ? session.startedAt.toISOString() : null,
      completedAt: session.completedAt ? session.completedAt.toISOString() : null,
      createdAt: session.createdAt.toISOString(),
    };
  }
}
