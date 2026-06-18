import { Injectable, Logger } from "@nestjs/common";
import type { StudentAnalytics, TutorResponse } from "@med/shared";
import type { AuthenticatedUser } from "../auth/decorators/current-user.decorator";
import { GeminiService, GeminiMessage } from "../ai/gemini.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { TutorDto } from "../ai/dto/tutor.dto";

/**
 * Socratic AI tutor (ИИ-наставник). Replies in Russian, guides clinical
 * reasoning with questions and graded hints rather than handing over answers,
 * and is automatically grounded in the student's own progress data.
 */
const TUTOR_SYSTEM_PROMPT = `Ты — ИИ-наставник медицинской образовательной платформы MedEdAI.
Твоя задача — помогать студенту развивать клиническое мышление.

## ТВОЯ ЛИЧНОСТЬ
- Ты опытный врач-преподаватель.
- Говоришь понятно, без снисхождения.
- Не даёшь готовые ответы — задаёшь наводящие вопросы.
- Поддерживаешь студента, когда он ошибается.

## ЧТО ТЫ УМЕЕШЬ
- Разбор ошибок: объясни ПОЧЕМУ это ошибка, покажи правильную логику рассуждения, дай клинический контекст и порекомендуй, что повторить.
- Сократовский метод: не выдавай ответ сразу, задавай вопросы вроде «Что ещё нужно было уточнить в анамнезе?», «Какие симптомы на это указывают?», «Что изменилось бы при другом анализе?».
- Клинические подсказки по уровням: сначала общий намёк, затем конкретная подсказка, и только если студент прямо просит — прямой ответ.
- Рекомендации: на основе слабых тем предлагай конкретные кейсы для практики, темы для повторения и на что обратить внимание.

## СТИЛЬ ОБЩЕНИЯ
- Обращайся на «ты».
- Коротко и по делу, без лишних похвал.
- Приводи конкретные примеры из клиники.
- Используй данные студента ниже, чтобы персонализировать ответ (упоминай его слабые темы и специализацию, когда уместно).
- Отвечай ВСЕГДА на русском языке, обычным текстом (без JSON и markdown-разметки кода).
- В конце, если уместно, задай один наводящий вопрос, чтобы студент продолжил рассуждать.
- Напоминай при необходимости, что это учебная помощь и не заменяет клиническое суждение.`;

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly analytics: AnalyticsService,
  ) {}

  async chat(user: AuthenticatedUser, dto: TutorDto): Promise<TutorResponse> {
    const systemParts = [TUTOR_SYSTEM_PROMPT];

    // Ground the conversation in the student's own progress data.
    try {
      const a = await this.analytics.forSelf(user);
      systemParts.push(this.studentContext(a));
    } catch (err) {
      this.logger.warn(`Не удалось загрузить контекст студента: ${(err as Error).message}`);
    }

    const chat: GeminiMessage[] = [];
    for (const m of dto.messages) {
      if (m.role === "system") {
        systemParts.push(m.content);
      } else {
        chat.push({ role: m.role === "assistant" ? "model" : "user", text: m.content });
      }
    }

    const result = await this.gemini.generate(chat, {
      system: systemParts.join("\n\n"),
      temperature: 0.7,
      maxOutputTokens: 1024,
    });

    return {
      message: { role: "assistant", content: result.text },
      model: result.model,
    };
  }

  /** Build the "ДАННЫЕ СТУДЕНТА" block injected into the system prompt. */
  private studentContext(a: StudentAnalytics): string {
    if (!a.hasData) {
      return [
        "## ДАННЫЕ СТУДЕНТА",
        `Имя: ${a.studentName}`,
        "У студента пока нет учебной активности — мягко предложи начать с разбора клинического случая или короткого теста.",
      ].join("\n");
    }

    const level = this.level(a.progress.masteryScore);
    const weak = a.weakTopics.slice(0, 4).map((w) => `${w.label} (${Math.round(w.accuracy)}%)`);
    const errors = a.errorsByCategory.slice(0, 4).map((e) => `${e.label} (×${e.count})`);
    const trend = this.trend(a.progress.trend);

    return [
      "## ДАННЫЕ СТУДЕНТА (для персонализации; не зачитывай их дословно)",
      `Имя: ${a.studentName}`,
      `Уровень: ${level} (показатель освоения ${Math.round(a.progress.masteryScore)}/100)`,
      `Средняя точность по тестам: ${Math.round(a.overallAccuracy)}%`,
      `Точность диагностики: ${Math.round(a.diagnosticAccuracy)}%`,
      `Пройдено: кейсов — ${a.progress.casesCompleted}, тестов — ${a.progress.testsTaken}, виртуальных пациентов — ${a.progress.vpCompleted}, ОСКЭ — ${a.progress.osceCompleted}`,
      `Динамика: ${trend}`,
      weak.length ? `Слабые темы: ${weak.join(", ")}` : "Слабые темы: пока не выявлены",
      errors.length ? `Частые ошибки: ${errors.join(", ")}` : "Частые ошибки: не зафиксированы",
    ].join("\n");
  }

  private level(mastery: number): string {
    if (mastery < 40) return "начальный";
    if (mastery < 70) return "средний";
    return "продвинутый";
  }

  private trend(trend: StudentAnalytics["progress"]["trend"]): string {
    switch (trend) {
      case "IMPROVING":
        return "растёт";
      case "DECLINING":
        return "снижается";
      case "STEADY":
        return "стабильна";
      default:
        return "недостаточно данных";
    }
  }
}
