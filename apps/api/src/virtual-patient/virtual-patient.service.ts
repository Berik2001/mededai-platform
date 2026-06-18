import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type {
  Difficulty,
  MedicalSpecialty,
  VirtualPatientSessionView,
  VPCondition,
  VPDebrief,
  VPMessage,
  VPSessionSummary,
  VPStability,
  VPTreatmentEffect,
} from "@med/shared";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { GeminiService, GeminiMessage } from "../ai/gemini.service";
import {
  VirtualPatientSession,
  VirtualPatientSessionDocument,
  VPExamFinding,
  VPMessageDoc,
  VPScenario,
} from "./schemas/virtual-patient-session.schema";
import { CreateVPSessionDto } from "./dto/virtual-patient.dto";

/** Callbacks the controller wires to the SSE response. */
export interface StreamSink {
  onDelta: (text: string) => void;
  onDone: (payload: { condition: VPCondition; model?: string }) => void;
  onError: (message: string) => void;
}

/** A fully-specified scenario used to seed a session (e.g. from a Clinical Case). */
export type VPScenarioSeed = VPScenario;

/** Flattened VP session data for the Analytics module. */
export interface VPAnalyticsRecord {
  id: string;
  title: string;
  /** MedicalSpecialty label (free string for analytics mapping). */
  specialty: string;
  difficulty: string;
  status: string;
  score: number | null;
  /** null when no diagnosis was submitted. */
  diagnosisCorrect: boolean | null;
  gaveContraindicated: boolean;
  missedRedFlags: string[];
  examsOrdered: number;
  createdAt: Date;
  completedAt: Date | null;
}

@Injectable()
export class VirtualPatientService {
  private readonly logger = new Logger(VirtualPatientService.name);

  constructor(
    @InjectModel(VirtualPatientSession.name)
    private readonly model: Model<VirtualPatientSessionDocument>,
    private readonly gemini: GeminiService,
  ) {}

  // ─── Lifecycle ─────────────────────────────────────────────────

  async create(dto: CreateVPSessionDto, user: AuthenticatedUser): Promise<VirtualPatientSessionView> {
    const scenario = await this.buildScenario(dto);
    return this.buildSession(scenario, user);
  }

  /** Seed a session from an externally-authored scenario (e.g. a Clinical Case). */
  async createFromScenario(
    seed: VPScenarioSeed,
    user: AuthenticatedUser,
    opts: { sourceCaseId?: string } = {},
  ): Promise<VirtualPatientSessionView> {
    return this.buildSession(seed, user, opts.sourceCaseId);
  }

  /**
   * Latest completed VP session a student ran from a given case — used by the
   * Assignment System to attach a result when the student submits a task.
   */
  async latestCaseResult(
    userId: string,
    caseId: string,
  ): Promise<{ sessionId: string; score: number | null } | null> {
    const doc = await this.model
      .findOne({ userId, sourceCaseId: caseId, status: "COMPLETED" })
      .sort({ updatedAt: -1 })
      .exec();
    return doc ? { sessionId: doc.id, score: doc.score } : null;
  }

  /** Session counts for the Admin statistics dashboard. */
  async sessionStats(): Promise<{ total: number; completed: number }> {
    const [total, completed] = await Promise.all([
      this.model.countDocuments({}).exec(),
      this.model.countDocuments({ status: "COMPLETED" }).exec(),
    ]);
    return { total, completed };
  }

  /** All of a student's VP sessions, flattened for the Analytics module. */
  async analyticsForUser(userId: string): Promise<VPAnalyticsRecord[]> {
    const docs = await this.model.find({ userId }).sort({ createdAt: 1 }).exec();
    return docs.map((d) => ({
      id: d.id,
      title: d.scenario.title,
      specialty: String(d.scenario.specialty),
      difficulty: String(d.scenario.difficulty),
      status: d.status,
      score: d.score,
      diagnosisCorrect: d.diagnosis ? d.diagnosis.correct : null,
      gaveContraindicated: d.treatments.some((t) => t.effect === "DETERIORATING"),
      missedRedFlags: d.debrief?.missedRedFlags ?? [],
      examsOrdered: d.orderedExams.length,
      createdAt: (d as unknown as { createdAt: Date }).createdAt,
      completedAt: d.completedAt ?? null,
    }));
  }

  /** Persist a fresh ACTIVE session with an in-character opening line. */
  private async buildSession(
    scenario: VPScenario,
    user: AuthenticatedUser,
    sourceCaseId?: string,
  ): Promise<VirtualPatientSessionView> {
    const opening: VPMessageDoc = {
      role: "patient",
      kind: "opening",
      content: `Доктор… ${scenario.presentingComplaint}`,
      createdAt: new Date(),
    };

    const doc = await this.model.create({
      userId: user.id,
      status: "ACTIVE",
      sourceCaseId: sourceCaseId ?? null,
      scenario,
      condition: {
        stability: "STABLE",
        vitals: scenario.initialVitals,
        narrative: "Пациент в сознании и может отвечать на вопросы.",
      },
      messages: [opening],
    });

    return this.toView(doc);
  }

  async list(user: AuthenticatedUser): Promise<VPSessionSummary[]> {
    const docs = await this.model
      .find({ userId: user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    return docs.map((d) => ({
      id: d.id,
      status: d.status,
      title: this.displayTitle(d),
      specialty: d.scenario.specialty,
      difficulty: d.scenario.difficulty,
      startedAt: (d as unknown as { createdAt: Date }).createdAt.toISOString(),
      score: d.score,
    }));
  }

  async get(id: string, user: AuthenticatedUser): Promise<VirtualPatientSessionView> {
    return this.toView(await this.load(id, user));
  }

  // ─── Anamnesis: streaming patient reply ────────────────────────

  async streamPatientReply(
    id: string,
    user: AuthenticatedUser,
    content: string,
    sink: StreamSink,
  ): Promise<void> {
    const doc = await this.load(id, user, { activeOnly: true });

    doc.messages.push({ role: "student", kind: "chat", content, createdAt: new Date() });

    const history = this.toGeminiHistory(doc.messages);
    const system = this.personaSystem(doc.scenario, doc.condition);

    let full = "";
    let model: string | undefined;
    try {
      const stream = this.gemini.generateStream(history, {
        system,
        temperature: 0.8,
        maxOutputTokens: 512,
      });
      let next = await stream.next();
      while (!next.done) {
        full += next.value;
        sink.onDelta(next.value);
        next = await stream.next();
      }
      model = next.value.model;
    } catch (err) {
      this.logger.warn(`Patient reply stream failed: ${(err as Error).message}`);
      sink.onError((err as Error).message || "AI unavailable");
      return;
    }

    doc.messages.push({
      role: "patient",
      kind: "chat",
      content: full.trim() || "…",
      createdAt: new Date(),
    });
    await doc.save();
    sink.onDone({ condition: doc.condition, model });
  }

  // ─── Examinations: deterministic lookup ────────────────────────

  async orderExam(id: string, user: AuthenticatedUser, name: string) {
    // Guard against non-clinical input (e.g. a stray number typed by mistake):
    // a real investigation always contains letters. This stops bogus exams like
    // "34" from polluting the transcript with a fake "no abnormality" result.
    const clean = (name ?? "").trim();
    if (clean.length < 2 || !/\p{L}/u.test(clean)) {
      throw new BadRequestException(
        "Укажите корректное название обследования (например: ЭКГ, рентген, ОАК).",
      );
    }

    const doc = await this.load(id, user, { activeOnly: true });
    const finding = this.matchExam(doc.scenario.examFindings, clean);
    // Priority: scenario finding (ЭКГ/lab/imaging authored into the case) →
    // live vital sign → AI-generated result grounded in the diagnosis/age →
    // generic fallback. The AI path makes exams like ECG return a clinically
    // appropriate result even when the case didn't pre-author one.
    const vital = finding ? null : this.matchVital(doc.condition.vitals, clean);
    const ai = finding || vital ? null : await this.aiExamResult(doc.scenario, doc.condition, clean);

    const result =
      finding?.result ?? vital?.result ?? ai?.result ?? "Значимых отклонений не выявлено.";
    const abnormal = finding?.abnormal ?? vital?.abnormal ?? ai?.abnormal ?? false;
    const category = finding?.category ?? vital?.category;
    const orderedAt = new Date();

    // De-duplicate: drop any previous order of the same exam (by canonical key)
    // so the "Исследования" panel keeps only the latest result.
    const key = this.examKey(doc.scenario, doc.condition.vitals, clean);
    doc.orderedExams = doc.orderedExams.filter(
      (e) => this.examKey(doc.scenario, doc.condition.vitals, e.name) !== key,
    );
    doc.orderedExams.push({ name: clean, category, result, abnormal, orderedAt });
    doc.messages.push({
      role: "narrator",
      kind: "exam",
      content: `🧪 ${clean} — ${result}`,
      createdAt: orderedAt,
    });
    await doc.save();

    return {
      exam: { name: clean, category, result, abnormal, orderedAt: orderedAt.toISOString() },
      session: this.toView(doc),
    };
  }

  // ─── Treatment: deterministic effect + streamed in-character reaction ──

  async streamTreatment(
    id: string,
    user: AuthenticatedUser,
    name: string,
    dosage: string | undefined,
    sink: StreamSink,
  ): Promise<void> {
    const doc = await this.load(id, user, { activeOnly: true });
    const effect = this.computeTreatmentEffect(doc.scenario, name);
    this.applyConditionChange(doc.condition, effect);

    const prescribedAt = new Date();
    doc.treatments.push({ name, dosage, effect, prescribedAt });
    doc.messages.push({
      role: "narrator",
      kind: "treatment",
      content: `💊 Назначено: ${name}${dosage ? ` (${dosage})` : ""}. Состояние пациента: ${this.stabilityRu(doc.condition.stability)}.`,
      createdAt: prescribedAt,
    });

    const system = this.personaSystem(doc.scenario, doc.condition);
    const prompt =
      `Врач только что дал тебе «${name}»${dosage ? ` в дозировке ${dosage}` : ""}. ` +
      `Клинически для твоего состояния это ${this.effectPhrase(effect)}. ` +
      `В роли пациента коротко скажи, как ты себя теперь чувствуешь (1–3 предложения, от первого лица, на русском).`;

    let full = "";
    let model: string | undefined;
    try {
      const stream = this.gemini.generateStream([{ role: "user", text: prompt }], {
        system,
        temperature: 0.8,
        maxOutputTokens: 300,
      });
      let next = await stream.next();
      while (!next.done) {
        full += next.value;
        sink.onDelta(next.value);
        next = await stream.next();
      }
      model = next.value.model;
    } catch (err) {
      // Deterministic fallback so treatment remains usable without an AI key.
      this.logger.warn(`Treatment reaction stream failed: ${(err as Error).message}`);
      full = this.fallbackReaction(effect);
      sink.onDelta(full);
    }

    doc.messages.push({
      role: "patient",
      kind: "treatment",
      content: full.trim() || this.fallbackReaction(effect),
      createdAt: new Date(),
    });
    await doc.save();
    sink.onDone({ condition: doc.condition, model });
  }

  // ─── Diagnosis: semantic evaluation (AI + fallback) ────────────

  async submitDiagnosis(id: string, user: AuthenticatedUser, value: string) {
    const doc = await this.load(id, user, { activeOnly: true });
    const { correct, feedback } = await this.evaluateDiagnosis(doc.scenario, value);
    const submittedAt = new Date();

    doc.diagnosis = { value, correct, feedback, submittedAt };
    doc.messages.push({
      role: "narrator",
      kind: "diagnosis",
      content: `🩺 Поставлен диагноз: «${value}» — ${correct ? "верное направление" : "стоит пересмотреть"}.`,
      createdAt: submittedAt,
    });
    await doc.save();

    return {
      diagnosis: { value, correct, feedback, submittedAt: submittedAt.toISOString() },
      session: this.toView(doc),
    };
  }

  // ─── Finalize: debrief + score (AI + heuristic fallback) ───────

  async finalize(id: string, user: AuthenticatedUser) {
    const doc = await this.load(id, user);
    const debrief = await this.buildDebrief(doc);

    doc.status = "COMPLETED";
    doc.completedAt = new Date();
    doc.score = debrief.score;
    doc.debrief = debrief;
    doc.messages.push({
      role: "narrator",
      kind: "debrief",
      content: `✅ Приём завершён. Оценка: ${debrief.score}/100. Правильный диагноз: ${debrief.correctDiagnosis}.`,
      createdAt: doc.completedAt,
    });
    await doc.save();

    return { debrief, session: this.toView(doc) };
  }

  // ─── Internals ─────────────────────────────────────────────────

  private async load(
    id: string,
    user: AuthenticatedUser,
    opts: { activeOnly?: boolean } = {},
  ): Promise<VirtualPatientSessionDocument> {
    let doc: VirtualPatientSessionDocument | null;
    try {
      doc = await this.model.findById(id).exec();
    } catch {
      throw new NotFoundException("Session not found");
    }
    if (!doc || doc.userId !== user.id) {
      throw new NotFoundException("Session not found");
    }
    if (opts.activeOnly && doc.status !== "ACTIVE") {
      throw new NotFoundException("Session is no longer active");
    }
    return doc;
  }

  /**
   * Title shown to the student. Many case-launched scenarios use the diagnosis
   * as the title (e.g. "Острый ларинготрахеит (круп)"), which would give the
   * answer away. While the encounter is ACTIVE we show a neutral, patient-based
   * title; the real title is revealed only once the case is COMPLETED.
   */
  private displayTitle(doc: VirtualPatientSessionDocument): string {
    if (doc.status === "COMPLETED") return doc.scenario.title;
    const p = doc.scenario.patient;
    return p?.name ? `Приём: ${p.name}` : "Виртуальный приём";
  }

  /** Maps the persisted doc to a client-safe view (hides the ground truth). */
  private toView(doc: VirtualPatientSessionDocument): VirtualPatientSessionView {
    const completed = doc.status === "COMPLETED";
    return {
      id: doc.id,
      status: doc.status,
      scenario: {
        title: this.displayTitle(doc),
        specialty: doc.scenario.specialty,
        difficulty: doc.scenario.difficulty,
        presentingComplaint: doc.scenario.presentingComplaint,
        patient: doc.scenario.patient,
      },
      condition: doc.condition,
      messages: doc.messages.map(
        (m): VPMessage => ({
          role: m.role,
          kind: m.kind,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        }),
      ),
      orderedExams: doc.orderedExams.map((e) => ({
        name: e.name,
        category: e.category,
        result: e.result,
        abnormal: e.abnormal,
        orderedAt: e.orderedAt.toISOString(),
      })),
      treatments: doc.treatments.map((t) => ({
        name: t.name,
        dosage: t.dosage,
        effect: t.effect,
        prescribedAt: t.prescribedAt.toISOString(),
      })),
      diagnosis: doc.diagnosis
        ? {
            value: doc.diagnosis.value,
            correct: doc.diagnosis.correct,
            feedback: doc.diagnosis.feedback,
            submittedAt: doc.diagnosis.submittedAt.toISOString(),
          }
        : null,
      score: doc.score,
      // Debrief is the reveal — only expose once finalized.
      debrief: completed ? doc.debrief : null,
      startedAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
      completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
    };
  }

  /** Build the persona system instruction. The diagnosis label is deliberately omitted. */
  private personaSystem(scenario: VPScenario, condition: VPCondition): string {
    const p = scenario.patient;
    const sex = p.sex === "MALE" ? "мужчина" : p.sex === "FEMALE" ? "женщина" : "пациент";
    const stateRu = this.stabilityRu(condition.stability);

    const lines = [
      "Ты — ВИРТУАЛЬНЫЙ ПАЦИЕНТ в медицинской образовательной системе. С тобой общается студент-медик, который ведёт приём.",
      "",
      "## ЛИЧНОСТЬ ПАЦИЕНТА",
      `Имя: ${p.name}`,
      `Возраст: ${p.age}`,
      `Пол: ${sex}`,
    ];
    if (scenario.occupation) lines.push(`Профессия: ${scenario.occupation}`);
    lines.push(`Характер: ${scenario.personality ?? "обычный, реагирует по ситуации"}`);

    lines.push(
      "",
      "## ТЕКУЩЕЕ СОСТОЯНИЕ",
      `Жалоба, с которой ты пришёл: ${scenario.presentingComplaint}`,
      `Твоя история и обстоятельства (раскрывай ПОСТЕПЕННО и только когда об этом спрашивают, говори простыми словами, без медицинских терминов): ${scenario.background}`,
      `Сейчас тебе ${stateRu}.`,
    );
    if (scenario.hiddenAgenda) {
      lines.push(
        `Что ты НЕ говоришь по своей инициативе (признаёшься, только если врач прямо и по делу спросит): ${scenario.hiddenAgenda}`,
      );
    }

    lines.push(
      "",
      "## ТЫ ОБЯЗАН",
      "- Отвечать ТОЛЬКО на заданный вопрос и не вываливать всё сразу.",
      "- Говорить как настоящий пациент: простым языком, без диагнозов и латыни.",
      "- Показывать эмоции (боль, страх, усталость, раздражение), уместные твоему состоянию.",
      "- Описывать СВОИ ОЩУЩЕНИЯ, а не цифры — не называй показатели анализов, давление, сатурацию.",
      "- Скрывать часть информации, пока студент конкретно о ней не спросит.",
      "",
      "## ТЫ НЕ ДОЛЖЕН",
      "- Называть или угадывать свой диагноз — ты его НЕ знаешь.",
      "- Подсказывать студенту, что делать, что назначить или о чём спросить.",
      "- Выходить из роли пациента (ты не врач и не система).",
      "- Отвечать на вопросы не по теме приёма.",
      "",
      "## КАК РЕАГИРОВАТЬ НА СОСТОЯНИЕ",
      "- Если тебе стало лучше — звучи спокойнее, говори, что отпускает.",
      "- Если хуже — звучи встревоженно, жалуйся на новые/усилившиеся ощущения.",
      "- Если студент поставил неверный диагноз — НЕ поправляй его, продолжай описывать свои настоящие симптомы.",
      "",
      "## ЭТАПЫ ПРИЁМА (помни, на каком ты этапе по ходу диалога)",
      "Жалобы → анамнез → осмотр → обследования → диагноз → лечение → динамика.",
      "",
      "## ФОРМАТ ОТВЕТА",
      "Отвечай ВСЕГДА на русском языке. Выдавай ТОЛЬКО прямую речь пациента (1–4 коротких предложения, от первого лица). Без кавычек, без пометок, без JSON, без описания действий в скобках.",
    );

    return lines.join("\n");
  }

  /** Human, in-character Russian phrasing of a stability level. */
  private stabilityRu(stability: VPStability): string {
    switch (stability) {
      case "CRITICAL":
        return "очень плохо, тебе тяжело даже говорить";
      case "DETERIORATING":
        return "становится хуже";
      case "IMPROVING":
        return "немного полегче, чем было";
      default:
        return "в целом терпимо, но симптомы беспокоят";
    }
  }

  /** Only chat turns form the patient conversation; narrator/exam/etc are excluded. */
  private toGeminiHistory(messages: VPMessageDoc[]): GeminiMessage[] {
    return messages
      .filter((m) => (m.role === "student" || m.role === "patient") && (m.kind === "chat" || m.kind === "opening"))
      .map((m) => ({ role: m.role === "student" ? "user" : "model", text: m.content }));
  }

  private matchExam(findings: VPExamFinding[], name: string): VPExamFinding | undefined {
    const q = name.trim().toLowerCase();
    return findings.find((f) => {
      const fn = f.name.toLowerCase();
      return fn === q || fn.includes(q) || q.includes(fn);
    });
  }

  /**
   * If the ordered exam is a vital sign, report its current live value from the
   * condition (these change with treatment), rather than a generic line.
   * Returns null when the name isn't a vital or the value is unavailable.
   */
  private matchVital(
    vitals: VPCondition["vitals"],
    name: string,
  ): { key: string; result: string; abnormal: boolean; category: string } | null {
    const q = name.trim().toLowerCase();
    const has = (...keys: string[]) => keys.some((k) => q.includes(k));
    const category = "Витальные показатели";

    // Temperature
    if (has("температур", "темп", "temperature", "градус") && typeof vitals.temperatureC === "number") {
      const t = vitals.temperatureC;
      return { key: "temperature", result: `${t}°C`, abnormal: t >= 37.5 || t < 35.5, category };
    }
    // Respiratory rate (check before BP/HR so "чдд"/"дыхан" win cleanly)
    if (has("чдд", "дыхан", "respiratory", "одышк") && typeof vitals.respiratoryRate === "number") {
      return { key: "respiratoryRate", result: `${vitals.respiratoryRate} /мин`, abnormal: false, category };
    }
    // Oxygen saturation
    if (has("spo2", "spo₂", "спо2", "сатур", "оксиген", "кислород", "oxygen") &&
        typeof vitals.oxygenSaturation === "number") {
      const s = vitals.oxygenSaturation;
      return { key: "oxygenSaturation", result: `${s}%`, abnormal: s < 94, category };
    }
    // Heart rate / pulse
    if (has("чсс", "пульс", "heart", "hr", "сердечн") && typeof vitals.heartRate === "number") {
      return { key: "heartRate", result: `${vitals.heartRate} уд/мин`, abnormal: false, category };
    }
    // Blood pressure (match "давлен"/"blood pressure"/"bp" or the bare token "ад")
    if ((has("давлен", "blood pressure", "bp", "артериальн") || /(^|[^a-zа-я])ад([^a-zа-я]|$)/i.test(q)) &&
        vitals.bloodPressure) {
      return { key: "bloodPressure", result: `${vitals.bloodPressure} мм рт. ст.`, abnormal: false, category };
    }
    return null;
  }

  /**
   * Generate a clinically appropriate objective result for an exam the case
   * didn't pre-author (e.g. ECG on a croup patient), grounded in the hidden
   * diagnosis, the patient's age and the live condition. Never names the
   * diagnosis (the student must still interpret). Falls back to the generic
   * line if the AI is unavailable.
   */
  private async aiExamResult(
    scenario: VPScenario,
    condition: VPCondition,
    name: string,
  ): Promise<{ result: string; abnormal: boolean }> {
    const fallback = { result: "Значимых отклонений не выявлено.", abnormal: false };
    try {
      const p = scenario.patient;
      const v = condition.vitals;
      const vitalsStr =
        [
          typeof v.heartRate === "number" ? `ЧСС ${v.heartRate}` : null,
          v.bloodPressure ? `АД ${v.bloodPressure}` : null,
          typeof v.respiratoryRate === "number" ? `ЧДД ${v.respiratoryRate}` : null,
          typeof v.temperatureC === "number" ? `темп. ${v.temperatureC}°C` : null,
          typeof v.oxygenSaturation === "number" ? `SpO₂ ${v.oxygenSaturation}%` : null,
        ]
          .filter(Boolean)
          .join(", ") || "н/д";
      const sex = p.sex === "MALE" ? "мужской" : p.sex === "FEMALE" ? "женский" : "—";
      const prompt =
        `Виртуальный клинический сценарий. Истинный диагноз (СКРЫТ от студента): «${scenario.hiddenDiagnosis}». ` +
        `Пациент: ${p.age} лет, пол ${sex}. Текущее состояние: ${condition.stability}. ` +
        `Витальные показатели: ${vitalsStr}.\n` +
        `Врач назначил обследование: «${name}».\n` +
        `Сформируй РЕАЛИСТИЧНЫЙ объективный результат этого обследования, соответствующий диагнозу, ` +
        `возрасту и текущему состоянию. Если уместно — используй реальные витальные значения (например, ` +
        `синусовая тахикардия с указанием ЧСС). СТРОГО ЗАПРЕЩЕНО называть или намекать на диагноз: ` +
        `не используй название болезни, его части или синонимы — пиши только объективные находки и, ` +
        `при необходимости, оборот «данное состояние». Если обследование не является приоритетным или ` +
        `малоинформативно при данном состоянии — добавь короткое примечание об этом (без названия болезни). ` +
        `Ответь СТРОГО в JSON на русском: { "result": string (1–3 предложения), "abnormal": boolean }`;
      const res = await this.gemini.generateText(prompt, {
        system: "Ты — медицинский симулятор, выдаёшь объективные результаты обследований. Только JSON, тексты на русском.",
        json: true,
        maxOutputTokens: 320,
      });
      const parsed = JSON.parse(res.text) as { result?: string; abnormal?: boolean };
      if (parsed.result && typeof parsed.result === "string" && parsed.result.trim()) {
        return {
          result: parsed.result.trim(),
          abnormal: typeof parsed.abnormal === "boolean" ? parsed.abnormal : false,
        };
      }
      return fallback;
    } catch (err) {
      this.logger.warn(`AI exam result failed: ${(err as Error).message}`);
      return fallback;
    }
  }

  /**
   * Canonical identity of an ordered exam, so re-orders and morphological
   * variants ("температура"/"температуру"/"Температура") collapse to one entry:
   * scenario finding > vital sign > normalized free text.
   */
  private examKey(scenario: VPScenario, vitals: VPCondition["vitals"], name: string): string {
    const finding = this.matchExam(scenario.examFindings, name);
    if (finding) return `finding:${finding.name.trim().toLowerCase()}`;
    const vital = this.matchVital(vitals, name);
    if (vital) return `vital:${vital.key}`;
    return `raw:${name.trim().toLowerCase().replace(/\s+/g, " ")}`;
  }

  private computeTreatmentEffect(scenario: VPScenario, name: string): VPTreatmentEffect {
    const q = name.trim().toLowerCase();
    const hit = (list: string[]) => list.some((t) => {
      const tn = t.toLowerCase();
      return tn === q || tn.includes(q) || q.includes(tn);
    });
    if (hit(scenario.contraindicatedTreatments)) return "DETERIORATING";
    if (hit(scenario.correctTreatments)) return "IMPROVING";
    return "NEUTRAL";
  }

  private applyConditionChange(condition: VPCondition, effect: VPTreatmentEffect): void {
    const order: VPStability[] = ["CRITICAL", "DETERIORATING", "STABLE", "IMPROVING"];
    let idx = order.indexOf(condition.stability);
    if (idx < 0) idx = 2;
    if (effect === "IMPROVING") idx = Math.min(order.length - 1, idx + 1);
    if (effect === "DETERIORATING") idx = Math.max(0, idx - 1);
    condition.stability = order[idx];
    condition.narrative =
      effect === "IMPROVING"
        ? "После назначения симптомы стихают."
        : effect === "DETERIORATING"
          ? "После этого решения пациенту стало хуже."
          : "Заметных изменений в состоянии пациента нет.";

    // Nudge vitals toward/away from normal for a sense of dynamism.
    const v = condition.vitals;
    if (typeof v.heartRate === "number") {
      v.heartRate += effect === "IMPROVING" ? -6 : effect === "DETERIORATING" ? 8 : 0;
    }
    if (typeof v.oxygenSaturation === "number") {
      v.oxygenSaturation = Math.min(
        100,
        v.oxygenSaturation + (effect === "IMPROVING" ? 2 : effect === "DETERIORATING" ? -3 : 0),
      );
    }
  }

  private effectPhrase(effect: VPTreatmentEffect): string {
    return effect === "IMPROVING"
      ? "правильно и помогает"
      : effect === "DETERIORATING"
        ? "вредно или противопоказано"
        : "нейтрально (ни явной пользы, ни вреда)";
  }

  private fallbackReaction(effect: VPTreatmentEffect): string {
    return effect === "IMPROVING"
      ? "Кажется, мне немного полегчало, доктор."
      : effect === "DETERIORATING"
        ? "Мне стало хуже… что-то совсем нехорошо."
        : "Я особо не чувствую разницы.";
  }

  private async evaluateDiagnosis(
    scenario: VPScenario,
    value: string,
  ): Promise<{ correct: boolean; feedback: string }> {
    // Fast deterministic check first.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    const v = norm(value);
    const targets = [scenario.hiddenDiagnosis, ...scenario.diagnosisSynonyms].map(norm);
    const stringMatch = targets.some((t) => t && (v.includes(t) || t.includes(v)));

    try {
      const prompt =
        `Правильный диагноз: «${scenario.hiddenDiagnosis}». ` +
        `Студент предложил: «${value}». ` +
        `Клинически это эквивалентно или достаточно близко? ` +
        `Ответь строго в JSON: { "correct": boolean, "feedback": string (одно-два предложения на русском; если неверно — НЕ называй правильный ответ) }`;
      const res = await this.gemini.generateText(prompt, {
        system: "Ты — медицинский экзаменатор. Выдавай только JSON.",
        json: true,
        maxOutputTokens: 256,
      });
      const parsed = JSON.parse(res.text) as { correct?: boolean; feedback?: string };
      return {
        correct: typeof parsed.correct === "boolean" ? parsed.correct : stringMatch,
        feedback: parsed.feedback ?? (stringMatch ? "Разумный диагноз." : "Пересмотрите дифференциальный ряд."),
      };
    } catch {
      return {
        correct: stringMatch,
        feedback: stringMatch
          ? "Ваш диагноз совпадает с ожидаемым ответом."
          : "Это не совпадает с ожидаемым диагнозом — пересмотрите ключевые находки.",
      };
    }
  }

  private async buildDebrief(doc: VirtualPatientSessionDocument): Promise<VPDebrief> {
    const s = doc.scenario;
    const heuristicScore = this.heuristicScore(doc);

    try {
      const transcript = doc.messages
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n")
        .slice(0, 6000);
      const prompt =
        `Студент завершил приём виртуального пациента.\n` +
        `Правильный диагноз: ${s.hiddenDiagnosis}\n` +
        `Рекомендованное лечение: ${s.correctTreatments.join(", ")}\n` +
        `Красные флаги: ${s.redFlags.join(", ")}\n` +
        `Диагноз студента: ${doc.diagnosis?.value ?? "(нет)"}\n` +
        `Назначенные обследования: ${doc.orderedExams.map((e) => e.name).join(", ") || "(нет)"}\n` +
        `Назначенное лечение: ${doc.treatments.map((t) => t.name).join(", ") || "(нет)"}\n` +
        `Стенограмма:\n${transcript}\n\n` +
        `Оцени приём. Ответь строго в JSON (все тексты на русском языке): ` +
        `{ "score": number 0-100, "summary": string (что сделано верно, где ошибся, что пропустил, что изучить), "missedRedFlags": string[], "whatWentWell": string[] }`;
      const res = await this.gemini.generateText(prompt, {
        system: "Ты — клинический преподаватель, оцениваешь симуляцию. Выдавай только JSON, тексты на русском.",
        json: true,
        maxOutputTokens: 800,
      });
      const parsed = JSON.parse(res.text) as Partial<VPDebrief>;
      return {
        score: typeof parsed.score === "number" ? Math.max(0, Math.min(100, parsed.score)) : heuristicScore,
        summary: parsed.summary ?? "Приём завершён.",
        correctDiagnosis: s.hiddenDiagnosis,
        recommendedTreatments: s.correctTreatments,
        missedRedFlags: parsed.missedRedFlags ?? [],
        whatWentWell: parsed.whatWentWell ?? [],
      };
    } catch {
      return {
        score: heuristicScore,
        summary: "Автоматический разбор (ИИ недоступен). Ниже — правильный диагноз и лечение для самопроверки.",
        correctDiagnosis: s.hiddenDiagnosis,
        recommendedTreatments: s.correctTreatments,
        missedRedFlags: [],
        whatWentWell: [],
      };
    }
  }

  private heuristicScore(doc: VirtualPatientSessionDocument): number {
    let score = 0;
    if (doc.diagnosis?.correct) score += 45;
    const gaveCorrectTreatment = doc.treatments.some((t) => t.effect === "IMPROVING");
    if (gaveCorrectTreatment) score += 30;
    if (doc.treatments.some((t) => t.effect === "DETERIORATING")) score -= 15;
    if (doc.orderedExams.length > 0) score += 15;
    if (doc.messages.filter((m) => m.role === "student").length >= 3) score += 10;
    return Math.max(0, Math.min(100, score));
  }

  // ─── Scenario construction (AI with deterministic fallback) ────

  private async buildScenario(dto: CreateVPSessionDto): Promise<VPScenario> {
    const specialty: MedicalSpecialty = dto.specialty ?? "EMERGENCY";
    const difficulty: Difficulty = dto.difficulty ?? "INTERMEDIATE";

    try {
      const prompt =
        `Создай реалистичный сценарий симуляции «виртуальный пациент» строго в формате JSON. ` +
        `ВСЕ текстовые поля заполни на РУССКОМ языке (кроме значения "sex"). Форма:\n` +
        `{ "title": string, "patient": { "name": string, "age": number, "sex": "MALE"|"FEMALE"|"OTHER" },\n` +
        `  "occupation": string (профессия пациента),\n` +
        `  "personality": string (характер: например "тревожный", "спокойный", "раздражительный"),\n` +
        `  "presentingComplaint": string (жалоба от первого лица, простым языком),\n` +
        `  "background": string (анамнез, перенесённые болезни, лекарства, образ жизни — согласованы с диагнозом),\n` +
        `  "hiddenAgenda": string (что пациент скрывает и признаёт только при прямом вопросе — например курит, пьёт, утаивает симптом),\n` +
        `  "initialVitals": { "heartRate": number, "bloodPressure": string, "respiratoryRate": number, "temperatureC": number, "oxygenSaturation": number },\n` +
        `  "hiddenDiagnosis": string, "diagnosisSynonyms": string[],\n` +
        `  "correctTreatments": string[], "contraindicatedTreatments": string[],\n` +
        `  "examFindings": [{ "name": string, "category": string, "result": string, "abnormal": boolean }],\n` +
        `  "redFlags": string[] }\n` +
        `Специальность: ${specialty}. Сложность: ${difficulty}.${dto.topic ? ` Тема: ${dto.topic}.` : ""} ` +
        `Дай 5–8 правдоподобных examFindings (анализы, визуализация, витальные показатели, осмотр). Только JSON.`;
      const res = await this.gemini.generateText(prompt, {
        system: "Ты — автор медицинских симуляций. Выдавай только корректный JSON, тексты на русском.",
        json: true,
        maxOutputTokens: 2048,
      });
      const parsed = JSON.parse(res.text) as Partial<VPScenario>;
      if (parsed.hiddenDiagnosis && parsed.patient && parsed.presentingComplaint) {
        return {
          title: parsed.title ?? `${specialty} case`,
          specialty,
          difficulty,
          patient: parsed.patient,
          occupation: parsed.occupation,
          personality: parsed.personality,
          hiddenAgenda: parsed.hiddenAgenda,
          presentingComplaint: parsed.presentingComplaint,
          background: parsed.background ?? "",
          initialVitals: parsed.initialVitals ?? {},
          hiddenDiagnosis: parsed.hiddenDiagnosis,
          diagnosisSynonyms: parsed.diagnosisSynonyms ?? [],
          correctTreatments: parsed.correctTreatments ?? [],
          contraindicatedTreatments: parsed.contraindicatedTreatments ?? [],
          examFindings: parsed.examFindings ?? [],
          redFlags: parsed.redFlags ?? [],
        };
      }
      this.logger.warn("AI scenario missing required fields; using fallback.");
    } catch (err) {
      this.logger.warn(`AI scenario generation failed (${(err as Error).message}); using fallback.`);
    }

    return this.fallbackScenario(specialty, difficulty);
  }

  /** Deterministic scenario so the module works without an AI key. */
  private fallbackScenario(specialty: MedicalSpecialty, difficulty: Difficulty): VPScenario {
    return {
      title: "Острая боль в груди",
      specialty,
      difficulty,
      patient: { name: "Роберт Хейс", age: 58, sex: "MALE" },
      occupation: "водитель",
      personality: "тревожный",
      hiddenAgenda: "курит около 30 лет, но стесняется в этом признаться",
      presentingComplaint: "Уже час давит в груди, как будто что-то тяжёлое, и левая рука ноет.",
      background:
        "Давящая боль за грудиной началась около часа назад в покое, отдаёт в левую руку и челюсть, " +
        "сопровождается потливостью и тошнотой. В анамнезе гипертония, стаж курения около 30 лет. У отца был инфаркт в 60. " +
        "Принимает амлодипин. Раньше так сильно не прихватывало.",
      initialVitals: {
        heartRate: 104,
        bloodPressure: "158/96",
        respiratoryRate: 20,
        temperatureC: 36.8,
        oxygenSaturation: 95,
      },
      hiddenDiagnosis: "Острый инфаркт миокарда (STEMI)",
      diagnosisSynonyms: ["инфаркт миокарда", "инфаркт", "ОКС", "STEMI", "острый коронарный синдром", "myocardial infarction"],
      correctTreatments: ["Аспирин", "Нитроглицерин", "Кислород", "Морфин", "Гепарин", "ЧКВ", "Клопидогрел"],
      contraindicatedTreatments: ["Ибупрофен", "НПВС", "Антибиотики"],
      examFindings: [
        { name: "ЭКГ", category: "Кардиология", result: "Подъём сегмента ST в отведениях II, III, aVF.", abnormal: true },
        { name: "Тропонин", category: "Лаборатория", result: "Повышен до 2.4 нг/мл (норма <0.04).", abnormal: true },
        { name: "Рентген грудной клетки", category: "Визуализация", result: "Острой патологии нет; пневмоторакса нет.", abnormal: false },
        { name: "Общий анализ крови", category: "Лаборатория", result: "В пределах нормы.", abnormal: false },
        { name: "Биохимия крови", category: "Лаборатория", result: "Электролиты и функция почек в норме.", abnormal: false },
        { name: "D-димер", category: "Лаборатория", result: "В норме — ТЭЛА менее вероятна.", abnormal: false },
      ],
      redFlags: [
        "Иррадиация в левую руку и челюсть",
        "Потливость и тошнота",
        "Подъём ST на ЭКГ",
        "Рост тропонина",
      ],
    };
  }
}
