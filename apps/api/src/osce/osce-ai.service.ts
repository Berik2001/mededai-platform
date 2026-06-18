import { Injectable, Logger } from "@nestjs/common";
import { OsceDebrief, OsceStationDebrief } from "@med/shared";
import { GeminiService } from "../ai/gemini.service";

/** Deterministic, pre-AI station data the debrief is built from. */
export interface StationForDebrief {
  stationId: string;
  title: string;
  scenario: string;
  expectedDiagnosis?: string | null;
  correctPathway?: string | null;
  examinerComment?: string | null;
  score: number;
  maxScore: number;
  criticalFailed: boolean;
  items: { label: string; critical: boolean; points: number; checked: boolean }[];
}

/** Heuristic: does a checklist line represent reaching the diagnosis? */
function isDiagnosisItem(label: string): boolean {
  return /диагноз|diagnos/i.test(label);
}

/** One checklist item presented to the AI grader. */
export interface GradeItem {
  id: string;
  label: string;
  critical: boolean;
}

/** AI auto-grading result for a station. */
export interface StationGrade {
  marks: { id: string; checked: boolean; evidence?: string }[];
  comment: string;
}

interface AiStation {
  index: number;
  errors?: string[];
  recommendations?: string[];
}
interface AiDebrief {
  summary?: string;
  recommendations?: string[];
  stations?: AiStation[];
}

@Injectable()
export class OsceAiService {
  private readonly logger = new Logger(OsceAiService.name);

  constructor(private readonly gemini: GeminiService) {}

  /**
   * AI auto-grading: read the student's free-text account of what they did at a
   * station and decide, for each hidden checklist item, whether it was satisfied.
   * This is the "AI-conducted" alternative to a human examiner ticking boxes.
   * Throws on failure so the caller can surface it (no silent zero-grade).
   */
  async gradeStation(input: {
    title: string;
    scenario: string;
    expectedDiagnosis?: string | null;
    items: GradeItem[];
    transcript: string;
  }): Promise<StationGrade> {
    const itemLines = input.items
      .map((it) => `  - id=${it.id} | ${it.label}${it.critical ? " (КРИТИЧЕСКИЙ)" : ""}`)
      .join("\n");
    const prompt =
      `Ты — экзаменатор ОСКЭ. Оцени действия студента на станции по СКРЫТОМУ чек-листу.\n` +
      `Станция: ${input.title}\n` +
      `Задание: ${input.scenario}\n` +
      `Ожидаемый диагноз: ${input.expectedDiagnosis ?? "(н/д)"}\n` +
      `Пункты чек-листа:\n${itemLines}\n\n` +
      `Что сделал/сказал студент на станции:\n"""\n${input.transcript}\n"""\n\n` +
      `Для КАЖДОГО пункта реши, выполнил ли его студент (строго, по существу: засчитывай только явно ` +
      `сделанные/названные действия). Ответь СТРОГО в JSON на русском: ` +
      `{ "marks": [{ "id": string, "checked": boolean, "evidence": string (кратко, что в тексте это подтверждает) }], ` +
      `"comment": string (1-2 предложения общего комментария экзаменатора) }`;

    const res = await this.gemini.generateText(prompt, {
      system: "Ты — строгий клинический экзаменатор ОСКЭ. Выдавай только JSON, тексты на русском.",
      json: true,
      maxOutputTokens: 1200,
    });
    const parsed = JSON.parse(res.text) as Partial<StationGrade>;
    const valid = new Set(input.items.map((i) => i.id));
    const marks = (parsed.marks ?? [])
      .filter((m) => m && typeof m.id === "string" && valid.has(m.id))
      .map((m) => ({ id: m.id, checked: Boolean(m.checked), evidence: m.evidence }));
    return { marks, comment: parsed.comment ?? "Автоматическая оценка ИИ." };
  }

  /**
   * AI patient roleplay for self-conducted stations. The model answers in
   * character as the patient (or a standardized patient), grounded in the hidden
   * scenario/diagnosis, and must NEVER name the diagnosis or coach the student.
   * Falls back to a neutral in-character line if Gemini is unavailable, so the
   * station chat never hard-fails.
   */
  async patientReply(input: {
    title: string;
    scenario: string;
    expectedDiagnosis?: string | null;
    correctPathway?: string | null;
    history: { role: "student" | "patient"; content: string }[];
    message: string;
  }): Promise<string> {
    const system =
      "Ты играешь роль ПАЦИЕНТА на станции ОСКЭ (или стандартизированного пациента). " +
      "Отвечай от первого лица, естественно и кратко (1–3 предложения), как реальный пациент в кабинете. " +
      "Отвечай ТОЛЬКО на то, что студент спросил или сделал. " +
      "СТРОГО ЗАПРЕЩЕНО: называть свой диагноз, медицинские термины-подсказки, перечислять все симптомы сразу, " +
      "давать оценку действиям студента или подсказывать, что делать дальше. " +
      "Если студент задаёт уместный вопрос — раскрывай детали постепенно. Всё на русском языке.";
    const ctx =
      `Скрытый контекст (НЕ раскрывать студенту):\n` +
      `Станция: ${input.title}\n` +
      `Сценарий: ${input.scenario}\n` +
      `Истинный диагноз: ${input.expectedDiagnosis ?? "(н/д)"}\n` +
      `Правильная тактика: ${input.correctPathway ?? "(н/д)"}\n`;
    const dialogue = input.history
      .slice(-12)
      .map((m) => `${m.role === "student" ? "Студент" : "Пациент"}: ${m.content}`)
      .join("\n");

    try {
      const res = await this.gemini.generate(
        [
          { role: "user", text: `${ctx}\n${dialogue ? `История диалога:\n${dialogue}\n` : ""}` },
          { role: "user", text: `Студент говорит/спрашивает: "${input.message}"\nОтветь как пациент:` },
        ],
        { system, maxOutputTokens: 300, temperature: 0.7 },
      );
      const text = res.text.trim();
      return text || this.fallbackPatientLine(input.message);
    } catch (err) {
      this.logger.warn(`OSCE AI patient unavailable: ${(err as Error).message}`);
      return this.fallbackPatientLine(input.message);
    }
  }

  private fallbackPatientLine(message: string): string {
    const m = message.toLowerCase();
    if (/здравств|привет|добрый|представ/.test(m)) return "Здравствуйте, доктор.";
    if (/болит|боль|где|что беспокоит|жалоб/.test(m))
      return "Меня беспокоит недомогание, доктор, мне нехорошо.";
    if (/\?$/.test(message.trim())) return "Да, доктор… примерно так и есть.";
    return "Хорошо, доктор.";
  }

  /**
   * Build the post-exam debrief: deterministic scoring + missed items, enriched
   * with an AI error analysis. Falls back to a heuristic debrief when the AI is
   * unavailable (e.g. no API key) so completion never blocks on Gemini.
   */
  async buildDebrief(stations: StationForDebrief[], passScore: number): Promise<OsceDebrief> {
    const totalScore = stations.reduce((s, x) => s + x.score, 0);
    const maxScore = stations.reduce((s, x) => s + x.maxScore, 0);
    const percent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    const anyCriticalFailed = stations.some((s) => s.criticalFailed);
    const passed = percent >= passScore && !anyCriticalFailed;

    const ai = await this.analyze(stations, passScore, percent).catch((err) => {
      this.logger.warn(`OSCE AI debrief unavailable: ${(err as Error).message}`);
      return null;
    });

    const stationDebriefs: OsceStationDebrief[] = stations.map((s, i) => {
      const missed = s.items.filter((it) => !it.checked);
      const stationPercent = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
      const aiStation = ai?.stations?.find((x) => x.index === i);
      const diagnosisItems = s.items.filter((it) => isDiagnosisItem(it.label));
      const diagnosisCorrect = diagnosisItems.length
        ? diagnosisItems.every((it) => it.checked)
        : null;
      return {
        stationId: s.stationId,
        title: s.title,
        score: s.score,
        maxScore: s.maxScore,
        percent: stationPercent,
        criticalFailed: s.criticalFailed,
        passed: stationPercent >= passScore && !s.criticalFailed,
        checklistResults: s.items.map((it) => ({
          label: it.label,
          points: it.points,
          checked: it.checked,
          critical: it.critical,
        })),
        missedItems: missed.map((it) => it.label),
        missedCritical: missed.filter((it) => it.critical).map((it) => it.label),
        diagnosisCorrect,
        expectedDiagnosis: s.expectedDiagnosis ?? null,
        correctPathway: s.correctPathway ?? null,
        examinerComment: s.examinerComment ?? null,
        errors: aiStation?.errors ?? this.heuristicErrors(missed),
        recommendations: aiStation?.recommendations ?? this.heuristicStationRecs(missed),
      };
    });

    // Overall diagnosis verdict across stations that have a diagnosis step.
    const dxStations = stationDebriefs.filter((s) => s.diagnosisCorrect !== null);
    const diagnosisCorrect = dxStations.length
      ? dxStations.every((s) => s.diagnosisCorrect === true)
      : null;

    // Flat list of every missed item, prefixed with its station title.
    const missedItems = stationDebriefs.flatMap((s) =>
      s.missedItems.map((label) => `${s.title} — ${label}`),
    );

    return {
      score: percent,
      percent,
      totalScore,
      maxScore,
      passed,
      diagnosisCorrect,
      missedItems,
      summary:
        ai?.summary ??
        `Пройдено станций: ${stations.length}. Итоговый балл — ${percent}%. ` +
          (anyCriticalFailed
            ? "Пропущены критические действия."
            : passed
              ? "Результат выше проходного порога."
              : "Результат ниже проходного порога."),
      stations: stationDebriefs,
      recommendations: ai?.recommendations ?? this.heuristicOverallRecs(stationDebriefs),
    };
  }

  // ─── AI ───

  private async analyze(
    stations: StationForDebrief[],
    passScore: number,
    percent: number,
  ): Promise<AiDebrief> {
    const blocks = stations
      .map((s, i) => {
        const lines = s.items
          .map((it) => `  - [${it.checked ? "x" : " "}] ${it.label} (${it.points} б.)${it.critical ? " (КРИТИЧЕСКИЙ)" : ""}`)
          .join("\n");
        return (
          `Станция ${i} — ${s.title}\n` +
          `Задание: ${s.scenario}\n` +
          `Ожидаемый диагноз: ${s.expectedDiagnosis ?? "(н/д)"}\n` +
          `Правильная тактика: ${s.correctPathway ?? "(н/д)"}\n` +
          `Балл: ${s.score}/${s.maxScore}${s.criticalFailed ? " — ПРОПУЩЕН КРИТИЧЕСКИЙ ПУНКТ" : ""}\n` +
          `Чек-лист экзаменатора:\n${lines}` +
          (s.examinerComment ? `\nКомментарий экзаменатора: ${s.examinerComment}` : "")
        );
      })
      .join("\n\n");

    const prompt =
      `Студент-медик прошёл ОСКЭ (итог ${percent}%, проходной порог ${passScore}%).\n\n` +
      `${blocks}\n\n` +
      `Для каждой станции проанализируй клинические ошибки (пропущенные/неверные действия, упущенный диагноз) ` +
      `и дай конкретные практические рекомендации. Затем дай общий вывод (feedback) и общие рекомендации.\n` +
      `Все тексты на РУССКОМ языке. Ответь строго в JSON:\n` +
      `{ "summary": string, "recommendations": string[], "stations": [{ "index": number, "errors": string[], "recommendations": string[] }] }`;

    const res = await this.gemini.generateText(prompt, {
      system: "Ты — старший клинический экзаменатор, разбираешь ОСКЭ кандидата. Выдавай только JSON, тексты на русском.",
      json: true,
      maxOutputTokens: 1800,
    });
    return JSON.parse(res.text) as AiDebrief;
  }

  // ─── Heuristic fallbacks ───

  private heuristicErrors(missed: { label: string; critical: boolean }[]): string[] {
    return missed.map((m) => `${m.critical ? "Пропущен критический шаг" : "Пропущен шаг"}: ${m.label}`);
  }

  private heuristicStationRecs(missed: { label: string; critical: boolean }[]): string[] {
    if (missed.length === 0) return ["Отличная работа — сохраняйте такой подход."];
    const recs = ["Повторите и отработайте пропущенные пункты чек-листа."];
    if (missed.some((m) => m.critical)) {
      recs.push("В первую очередь — критические действия по безопасности, которые были пропущены.");
    }
    return recs;
  }

  private heuristicOverallRecs(stations: OsceStationDebrief[]): string[] {
    const recs: string[] = [];
    const weak = stations.filter((s) => !s.passed).map((s) => s.title);
    if (weak.length) recs.push(`Сделайте упор на повторение: ${weak.join(", ")}.`);
    if (stations.some((s) => s.criticalFailed)) {
      recs.push("Отрабатывайте чек-листы критических действий до автоматизма.");
    }
    if (recs.length === 0) recs.push("Стабильный проходной результат на всех станциях.");
    return recs;
  }
}
