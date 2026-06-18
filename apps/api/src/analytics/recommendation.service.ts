import { Injectable, Logger } from "@nestjs/common";
import {
  AiRecommendation,
  ErrorCategoryCount,
  RecommendationPriority,
  StudentInsights,
} from "@med/shared";
import { GeminiService } from "../ai/gemini.service";
import { StudentMetrics } from "./analytics-aggregator.service";

export interface RecommendationResult {
  summary: string;
  focusAreas: string[];
  recommendations: AiRecommendation[];
  insights: StudentInsights;
  aiGenerated: boolean;
}

const PRIORITIES: RecommendationPriority[] = ["HIGH", "MEDIUM", "LOW"];

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(private readonly gemini: GeminiService) {}

  /** Personalized recommendations from the computed metrics (Gemini + fallback). */
  async generate(metrics: StudentMetrics, errorsByCategory: ErrorCategoryCount[]): Promise<RecommendationResult> {
    if (!metrics.hasData) {
      return {
        summary:
          "Учебной активности пока нет. Пройдите несколько тестов или приёмов виртуального пациента, чтобы открыть аналитику.",
        focusAreas: [],
        recommendations: [],
        insights: this.emptyInsights(),
        aiGenerated: false,
      };
    }

    const ai = await this.withAi(metrics, errorsByCategory).catch((err) => {
      this.logger.warn(`AI recommendations unavailable: ${(err as Error).message}`);
      return null;
    });
    if (ai) return ai;
    return this.heuristic(metrics, errorsByCategory);
  }

  // ─── Gemini ───

  private async withAi(
    metrics: StudentMetrics,
    errorsByCategory: ErrorCategoryCount[],
  ): Promise<RecommendationResult> {
    const weak = metrics.weakTopics.map((w) => `${w.label} (${w.accuracy}%)`).join(", ") || "нет";
    const errors = errorsByCategory.map((e) => `${e.label}: ${e.count}`).join(", ") || "нет";
    const ds = metrics.decisionSpeed;
    const { level, levelProgress } = this.levelInfo(metrics.progress.masteryScore);
    const prompt =
      `Аналитика успеваемости студента-медика:\n` +
      `- Общая точность по тестам: ${metrics.overallAccuracy}%\n` +
      `- Точность диагностики: ${metrics.diagnosticAccuracy}%\n` +
      `- Показатель освоения: ${metrics.progress.masteryScore}/100 (уровень: ${level}, динамика: ${metrics.progress.trend})\n` +
      `- Скорость решений: ${ds.avgSecondsPerQuestion ?? "н/д"} с/вопрос (${ds.rating})\n` +
      `- Слабые специальности: ${weak}\n` +
      `- Ошибки по категориям: ${errors}\n` +
      `- Активность: ${metrics.progress.testsTaken} тестов, ${metrics.progress.vpCompleted} виртуальных пациентов, ${metrics.progress.osceCompleted} ОСКЭ, ${metrics.progress.casesCompleted} кейсов\n\n` +
      `Сформируй персональный разбор. Все тексты на РУССКОМ языке, по-деловому, без лишних похвал. ` +
      `Ответь СТРОГО валидным JSON:\n` +
      `{ "summary": string (2-3 предложения — где студент сейчас),\n` +
      `  "strengths": string[] (что получается хорошо, в каких темах уверен),\n` +
      `  "growthZones": string[] (конкретные слабые места и на каком этапе чаще ошибается),\n` +
      `  "weeklyPlan": string[] (ровно 3 конкретных действия на неделю: какие кейсы пройти, что повторить),\n` +
      `  "insight": string (одна мотивирующая фраза — что изменится, если исправить главную ошибку),\n` +
      `  "focusAreas": string[],\n` +
      `  "recommendations": [{ "title": string, "detail": string, "priority": "HIGH"|"MEDIUM"|"LOW" }] }`;

    const res = await this.gemini.generateText(prompt, {
      system: "Ты — опытный коуч медицинского образования. Выдавай только JSON, все тексты на русском.",
      json: true,
      maxOutputTokens: 1600,
    });
    const parsed = JSON.parse(res.text) as Partial<RecommendationResult["insights"]> &
      Partial<Pick<RecommendationResult, "summary" | "focusAreas" | "recommendations">>;

    const summary = parsed.summary ?? this.fallbackSummary(metrics);
    const insights: StudentInsights = {
      overallScore: Math.round(metrics.progress.masteryScore),
      levelProgress,
      summary,
      strengths: this.cleanList(parsed.strengths) ?? this.fallbackStrengths(metrics),
      growthZones: this.cleanList(parsed.growthZones) ?? this.fallbackGrowthZones(metrics, errorsByCategory),
      weeklyPlan: (this.cleanList(parsed.weeklyPlan) ?? this.fallbackWeeklyPlan(metrics, errorsByCategory)).slice(0, 3),
      insight: parsed.insight ?? this.fallbackInsight(metrics, errorsByCategory),
    };

    return {
      summary,
      focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.slice(0, 6) : [],
      recommendations: (parsed.recommendations ?? [])
        .filter((r): r is AiRecommendation => Boolean(r && r.title && r.detail))
        .map((r) => ({
          title: r.title,
          detail: r.detail,
          priority: PRIORITIES.includes(r.priority) ? r.priority : "MEDIUM",
        }))
        .slice(0, 5),
      insights,
      aiGenerated: true,
    };
  }

  // ─── Heuristic fallback ───

  private heuristic(metrics: StudentMetrics, errorsByCategory: ErrorCategoryCount[]): RecommendationResult {
    const recommendations: AiRecommendation[] = [];

    const weakest = metrics.weakTopics[0];
    if (weakest && weakest.accuracy < 70) {
      recommendations.push({
        title: `Подтянуть тему «${weakest.label}»`,
        detail: `Точность по теме «${weakest.label}» — ${weakest.accuracy}% за ${weakest.attempts} активностей. Повторите основы и порешайте целевые вопросы.`,
        priority: "HIGH",
      });
    }

    const topError = errorsByCategory[0];
    if (topError) {
      recommendations.push({
        title: `Снизить ошибки: ${topError.label.toLowerCase()}`,
        detail: `«${topError.label}» — самая частая категория ошибок (${topError.count} раз). Выработайте привычку проверять этот шаг по чек-листу.`,
        priority: topError.category === "SAFETY" ? "HIGH" : "MEDIUM",
      });
    }

    if (metrics.diagnosticAccuracy < 60 && metrics.diagnosticAccuracy > 0) {
      recommendations.push({
        title: "Развить диагностическое мышление",
        detail: `Точность диагностики ${metrics.diagnosticAccuracy}%. Решайте кейс-вопросы и виртуальных пациентов, каждый раз проговаривая дифференциальный ряд.`,
        priority: "HIGH",
      });
    }

    if (metrics.decisionSpeed.rating === "DELIBERATE") {
      recommendations.push({
        title: "Повысить скорость решений",
        detail: `В среднем ${metrics.decisionSpeed.avgSecondsPerQuestion} с на вопрос. Тренируйтесь на тестах с таймером, не теряя точности.`,
        priority: "LOW",
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        title: "Так держать",
        detail: "Результаты ровные по всем направлениям. Сохраняйте баланс тестов, виртуальных пациентов и ОСКЭ.",
        priority: "LOW",
      });
    }

    const { levelProgress } = this.levelInfo(metrics.progress.masteryScore);

    return {
      summary: this.fallbackSummary(metrics),
      focusAreas: metrics.weakTopics.map((w) => w.label),
      recommendations,
      insights: {
        overallScore: Math.round(metrics.progress.masteryScore),
        levelProgress,
        summary: this.fallbackSummary(metrics),
        strengths: this.fallbackStrengths(metrics),
        growthZones: this.fallbackGrowthZones(metrics, errorsByCategory),
        weeklyPlan: this.fallbackWeeklyPlan(metrics, errorsByCategory),
        insight: this.fallbackInsight(metrics, errorsByCategory),
      },
      aiGenerated: false,
    };
  }

  // ─── Shared helpers ───

  /** Map mastery (0–100) to a level name and "% до следующего уровня" phrasing. */
  private levelInfo(mastery: number): { level: string; levelProgress: string } {
    if (mastery < 40) {
      const pct = Math.round((mastery / 40) * 100);
      return { level: "начальный", levelProgress: `${pct}% до среднего уровня` };
    }
    if (mastery < 70) {
      const pct = Math.round(((mastery - 40) / 30) * 100);
      return { level: "средний", levelProgress: `${pct}% до продвинутого уровня` };
    }
    return { level: "продвинутый", levelProgress: "Достигнут продвинутый уровень" };
  }

  private cleanList(list: unknown): string[] | null {
    if (!Array.isArray(list)) return null;
    const cleaned = list.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    return cleaned.length ? cleaned.slice(0, 6) : null;
  }

  private fallbackSummary(metrics: StudentMetrics): string {
    const p = metrics.progress;
    const trend =
      p.trend === "IMPROVING" ? "растёт" : p.trend === "DECLINING" ? "снижается" : "стабильна";
    return (
      `Освоение ${p.masteryScore}/100 (динамика ${trend}). Общая точность ${metrics.overallAccuracy}%, ` +
      `точность диагностики ${metrics.diagnosticAccuracy}% за ${p.testsTaken} тестов, ` +
      `${p.vpCompleted} виртуальных пациентов и ${p.osceCompleted} ОСКЭ.`
    );
  }

  private fallbackStrengths(metrics: StudentMetrics): string[] {
    const out: string[] = [];
    const strong = [...metrics.accuracyBySpecialty].sort((a, b) => b.accuracy - a.accuracy)[0];
    if (strong && strong.accuracy >= 70) out.push(`Уверенно по теме «${strong.label}» (${strong.accuracy}%)`);
    if (metrics.overallAccuracy >= 70) out.push(`Хорошая общая точность по тестам (${metrics.overallAccuracy}%)`);
    if (metrics.decisionSpeed.rating === "FAST") out.push("Быстро принимает решения, не зависая на вопросах");
    if (metrics.progress.trend === "IMPROVING") out.push("Положительная динамика — результаты растут");
    if (out.length === 0) out.push("Регулярно занимается на платформе — есть с чем работать дальше");
    return out;
  }

  private fallbackGrowthZones(metrics: StudentMetrics, errorsByCategory: ErrorCategoryCount[]): string[] {
    const out: string[] = [];
    for (const w of metrics.weakTopics.slice(0, 2)) {
      if (w.accuracy < 70) out.push(`«${w.label}» — точность ${w.accuracy}% за ${w.attempts} активностей`);
    }
    const topError = errorsByCategory[0];
    if (topError) out.push(`Чаще всего ошибки в категории «${topError.label}» (${topError.count} раз)`);
    if (metrics.diagnosticAccuracy > 0 && metrics.diagnosticAccuracy < 60)
      out.push(`Диагностическое мышление: точность ${metrics.diagnosticAccuracy}%`);
    if (out.length === 0) out.push("Явных слабых мест нет — закрепляйте результат и повышайте сложность");
    return out;
  }

  private fallbackWeeklyPlan(metrics: StudentMetrics, errorsByCategory: ErrorCategoryCount[]): string[] {
    const plan: string[] = [];
    const weakest = metrics.weakTopics[0];
    if (weakest) plan.push(`Пройти 2–3 кейса по теме «${weakest.label}» и разобрать ошибки`);
    const topError = errorsByCategory[0];
    if (topError) plan.push(`Повторить материал, связанный с категорией ошибок «${topError.label}»`);
    if (metrics.diagnosticAccuracy > 0 && metrics.diagnosticAccuracy < 70)
      plan.push("Провести 1–2 приёма виртуального пациента, проговаривая дифференциальный диагноз");
    plan.push("Пройти один тест с таймером для закрепления и самопроверки");
    return plan.slice(0, 3);
  }

  private fallbackInsight(metrics: StudentMetrics, errorsByCategory: ErrorCategoryCount[]): string {
    const weakest = metrics.weakTopics[0];
    const topError = errorsByCategory[0];
    if (weakest) {
      return `Если подтянуть «${weakest.label}», общий показатель освоения заметно вырастет — это твоя точка роста №1.`;
    }
    if (topError) {
      return `Убери частые ошибки в категории «${topError.label}» — и точность пойдёт вверх сразу по нескольким темам.`;
    }
    return "Сохраняй ритм занятий — стабильная практика быстрее всего двигает тебя к следующему уровню.";
  }

  private emptyInsights(): StudentInsights {
    return {
      overallScore: 0,
      levelProgress: "0% до среднего уровня",
      summary:
        "Учебной активности пока нет. Пройдите несколько тестов или приёмов виртуального пациента, чтобы открыть аналитику.",
      strengths: [],
      growthZones: [],
      weeklyPlan: [
        "Пройти ознакомительный клинический кейс",
        "Решить короткий тест по интересующей специальности",
        "Провести первый приём виртуального пациента",
      ],
      insight: "Сделай первые шаги на платформе — и здесь появится персональный разбор твоего прогресса.",
    };
  }
}
