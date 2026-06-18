/**
 * One-off generator: creates one PUBLISHED test per clinical specialty, each
 * filled with auto-generated multiple-choice questions (Russian).
 *
 * Questions are generated with the Gemini API when GEMINI_API_KEY is set, with a
 * deterministic fallback so it still works offline. Run from the host:
 *
 *   DATABASE_URL=postgresql://postgres:****@localhost:5432/ed_med?schema=public \
 *   GEMINI_API_KEY=... pnpm --filter @med/api exec ts-node --transpile-only prisma/seed-tests.ts
 */
import { PrismaClient, Specialty, CaseDifficulty } from "@prisma/client";

const prisma = new PrismaClient();

const SPECIALTY_RU: Record<Specialty, string> = {
  THERAPY: "Терапия",
  SURGERY: "Хирургия",
  CARDIOLOGY: "Кардиология",
  NEUROLOGY: "Неврология",
  PEDIATRICS: "Педиатрия",
  CRITICAL_CARE: "Реанимация и интенсивная терапия",
  NURSING: "Сестринское дело",
};

const DIFFICULTIES: CaseDifficulty[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const QUESTIONS_PER_TEST = 6;

interface GenQuestion {
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  difficulty: CaseDifficulty;
  stem: string;
  options: string[];
  correctOptions: number[];
  explanation: string;
  points: number;
}

/** Pick a deterministic-but-varied item from a list using a rotating index. */
function pick<T>(list: T[], i: number): T {
  return list[i % list.length];
}

const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim();
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";

async function generateWithGemini(specialtyRu: string): Promise<GenQuestion[] | null> {
  if (!GEMINI_KEY) return null;
  const prompt =
    `Сгенерируй ${QUESTIONS_PER_TEST} тестовых вопросов с вариантами ответа по специальности «${specialtyRu}» ` +
    `для студентов-медиков. Всё на русском языке. Ответь СТРОГО валидным JSON-массивом без markdown. ` +
    `Каждый элемент: { "type": "SINGLE_CHOICE" | "MULTIPLE_CHOICE", ` +
    `"difficulty": "BEGINNER" | "INTERMEDIATE" | "ADVANCED", ` +
    `"stem": string (текст вопроса), "options": string[] (4 варианта), ` +
    `"correctOptions": number[] (индексы правильных, для SINGLE_CHOICE ровно один), ` +
    `"explanation": string (краткое пояснение), "points": number (1 или 2) }. ` +
    `Сделай вопросы разнообразными по сложности.`;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 8192, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as GenQuestion[];
    return parsed.filter(
      (q) =>
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        Array.isArray(q.correctOptions) &&
        q.correctOptions.length >= 1 &&
        typeof q.stem === "string",
    );
  } catch (err) {
    console.warn(`  ! Gemini не сработал для «${specialtyRu}» (${(err as Error).message}) — беру запасной вариант`);
    return null;
  }
}

/** Deterministic fallback so the script always produces a usable test. */
function fallbackQuestions(specialtyRu: string): GenQuestion[] {
  return Array.from({ length: QUESTIONS_PER_TEST }, (_, i) => {
    const correct = i % 4;
    const options = ["Вариант А", "Вариант Б", "Вариант В", "Вариант Г"];
    return {
      type: "SINGLE_CHOICE",
      difficulty: pick(DIFFICULTIES, i),
      stem: `${specialtyRu}: учебный вопрос №${i + 1}. Выберите правильный ответ.`,
      options,
      correctOptions: [correct],
      explanation: `Правильный ответ — «${options[correct]}». (Демонстрационный вопрос.)`,
      points: 1,
    };
  });
}

async function main() {
  const teacher = await prisma.user.findFirst({ where: { role: "TEACHER" } });
  const authorId = teacher?.id ?? (await prisma.user.findFirst())?.id;
  if (!authorId) throw new Error("Нет ни одного пользователя — сначала запустите основной seed.");

  let createdTests = 0;
  let createdQuestions = 0;

  for (const [code, ru] of Object.entries(SPECIALTY_RU) as [Specialty, string][]) {
    const existing = await prisma.test.findFirst({ where: { specialty: code } });
    if (existing) {
      console.log(`• «${ru}» — тест уже есть, пропускаю`);
      continue;
    }

    const gen = (await generateWithGemini(ru)) ?? fallbackQuestions(ru);
    const questions = gen.length ? gen : fallbackQuestions(ru);

    // Persist the question bank entries.
    const questionIds: string[] = [];
    for (const q of questions) {
      const type = q.type === "MULTIPLE_CHOICE" ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE";
      const correctOptions =
        type === "SINGLE_CHOICE" ? [q.correctOptions[0] ?? 0] : q.correctOptions;
      const created = await prisma.question.create({
        data: {
          authorId,
          type,
          specialty: code,
          difficulty: DIFFICULTIES.includes(q.difficulty) ? q.difficulty : "INTERMEDIATE",
          status: "PUBLISHED",
          stem: q.stem,
          options: q.options,
          correctOptions,
          explanation: q.explanation ?? null,
          points: q.points === 2 ? 2 : 1,
        },
      });
      questionIds.push(created.id);
      createdQuestions++;
    }

    // Build the test and link the questions in order.
    const difficulty = pick(DIFFICULTIES, createdTests + 1);
    await prisma.test.create({
      data: {
        authorId,
        title: `Тест по специальности «${ru}»`,
        description: `Автоматически сгенерированный тест по теме «${ru}» с автоматической проверкой.`,
        specialty: code,
        difficulty,
        status: "PUBLISHED",
        timeLimitMinutes: 10 + ((createdTests * 5) % 20),
        passingScore: 60,
        shuffle: createdTests % 2 === 0,
        questions: {
          create: questionIds.map((questionId, order) => ({ questionId, order })),
        },
      },
    });
    createdTests++;
    console.log(`✓ «${ru}»: тест + ${questionIds.length} вопрос(ов)`);
  }

  console.log(`\nГотово: создано тестов — ${createdTests}, вопросов — ${createdQuestions}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
