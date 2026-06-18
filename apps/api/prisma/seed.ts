/**
 * Seed script — idempotent. Creates the default accounts plus a small amount of
 * demo content (3 clinical cases, 10 test questions, 1 OSCE exam) so the MVP is
 * usable immediately after `docker compose up`.
 *
 * Clinical-case CONTENT lives in MongoDB (`case_contents`); relational METADATA
 * lives in PostgreSQL (`clinical_cases`) and references it via `contentId`.
 */
import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import mongoose from "mongoose";

const prisma = new PrismaClient();
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/med_content";

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // ─── Accounts (one per role) ───
  const accounts = [
    { email: "admin@med.local", firstName: "Ada", lastName: "Admin", role: Role.ADMIN },
    { email: "teacher@med.local", firstName: "Tina", lastName: "Teacher", role: Role.TEACHER },
    { email: "examiner@med.local", firstName: "Eli", lastName: "Examiner", role: Role.EXAMINER },
    { email: "student@med.local", firstName: "Sam", lastName: "Student", role: Role.STUDENT, yearOfStudy: 3 },
  ];
  const users: Record<string, { id: string }> = {};
  for (const a of accounts) {
    const u = await prisma.user.upsert({
      where: { email: a.email },
      update: {},
      create: { ...a, passwordHash, institution: "Med Platform" },
    });
    users[a.role] = u;
  }
  const teacherId = users[Role.TEACHER].id;
  console.log("✓ Users seeded (password for all: Password123!)");

  // ─── Clinical cases (Postgres metadata + Mongo content) ───
  if ((await prisma.clinicalCase.count()) === 0) {
    await mongoose.connect(MONGODB_URI);
    for (const c of CASES) {
      const now = new Date();
      const res = await mongoose.connection
        .collection("case_contents")
        .insertOne({ ...c.content, createdAt: now, updatedAt: now });
      const contentId = res.insertedId.toString();
      const meta = await prisma.clinicalCase.create({
        data: {
          authorId: teacherId,
          title: c.title,
          specialty: c.specialty,
          difficulty: c.difficulty,
          status: "PUBLISHED",
          summary: c.summary,
          estimatedMinutes: c.estimatedMinutes,
          tags: c.tags,
          contentId,
        },
      });
      await mongoose.connection
        .collection("case_contents")
        .updateOne({ _id: res.insertedId }, { $set: { metaId: meta.id } });
    }
    await mongoose.disconnect();
    console.log(`✓ ${CASES.length} clinical cases seeded`);
  } else {
    console.log("• Clinical cases already present — skipping");
  }

  // ─── Test questions ───
  if ((await prisma.question.count()) === 0) {
    await prisma.question.createMany({
      data: QUESTIONS.map((q) => ({ ...q, authorId: teacherId, status: "PUBLISHED" as const })),
    });
    console.log(`✓ ${QUESTIONS.length} test questions seeded`);
  } else {
    console.log("• Questions already present — skipping");
  }

  // ─── OSCE exam ───
  if ((await prisma.osceExam.count()) === 0) {
    await prisma.osceExam.create({
      data: {
        authorId: teacherId,
        title: OSCE.title,
        description: OSCE.description,
        specialty: OSCE.specialty,
        status: "PUBLISHED",
        passScore: OSCE.passScore,
        stations: {
          create: OSCE.stations.map((s, order) => ({
            order,
            title: s.title,
            scenario: s.scenario,
            durationSec: s.durationSec,
            expectedDiagnosis: s.expectedDiagnosis,
            correctPathway: s.correctPathway,
            examinerBrief: s.examinerBrief,
            checklist: {
              create: s.checklist.map((c, cOrder) => ({
                order: cOrder,
                label: c.label,
                points: c.points,
                critical: c.critical ?? false,
                category: c.category,
              })),
            },
          })),
        },
      },
    });
    console.log("✓ 1 OSCE exam seeded");
  } else {
    console.log("• OSCE exam already present — skipping");
  }

  console.log("\nSeeding complete. Sign in at https://localhost with admin@med.local / Password123!");
}

// ─────────────────────────── Demo data ───────────────────────────

const CASES = [
  {
    title: "Внебольничная пневмония",
    specialty: "THERAPY" as const,
    difficulty: "INTERMEDIATE" as const,
    summary: "Мужчина 45 лет с кашлем, лихорадкой и одышкой.",
    estimatedMinutes: 20,
    tags: ["пневмония", "терапия", "инфекция"],
    content: {
      patient: { name: "Иван Соколов", age: 45, sex: "MALE" },
      initialComplaint: "Доктор, у меня уже три дня высокая температура и кашель с мокротой.",
      presentation:
        "Острое начало с лихорадки до 39 °C, продуктивный кашель с ржавой мокротой, боль в правой половине грудной клетки при дыхании, нарастающая одышка.",
      initialVitals: { heartRate: 104, bloodPressure: "118/76", respiratoryRate: 24, temperatureC: 38.9, oxygenSaturation: 92 },
      learningObjectives: [
        "Распознать клинику внебольничной пневмонии",
        "Назначить рациональную эмпирическую антибиотикотерапию",
        "Оценить тяжесть по шкале CURB-65",
      ],
      references: ["Российские клинические рекомендации по внебольничной пневмонии"],
      fullBackground:
        "Курильщик (20 пачко-лет), работает водителем. Без хронических заболеваний. Заболел остро после переохлаждения. Аллергий нет.",
      hiddenDiagnosis: "Внебольничная пневмония нижней доли правого лёгкого",
      diagnosisSynonyms: ["пневмония", "community-acquired pneumonia", "правосторонняя пневмония"],
      differentialDiagnoses: ["Острый бронхит", "ТЭЛА", "Туберкулёз лёгких"],
      clinicalPathway: [
        { order: 1, title: "Оценка ABCDE и сатурации", detail: "Кислород при SpO2 < 94%." },
        { order: 2, title: "Рентгенография грудной клетки", detail: "Подтверждение инфильтрата." },
        { order: 3, title: "Эмпирическая антибиотикотерапия", detail: "Амоксициллин/клавуланат ± макролид." },
      ],
      examFindings: [
        { name: "Рентгенография грудной клетки", category: "Визуализация", result: "Инфильтрат в нижней доле справа.", abnormal: true },
        { name: "Общий анализ крови", category: "Лаборатория", result: "Лейкоцитоз 14×10⁹/л со сдвигом влево.", abnormal: true },
        { name: "Аускультация", category: "Осмотр", result: "Влажные хрипы и крепитация справа в нижних отделах.", abnormal: true },
      ],
      correctTreatments: ["Амоксициллин/клавуланат", "Азитромицин", "Кислород", "Жаропонижающие"],
      contraindicatedTreatments: ["Системные глюкокортикоиды без показаний"],
      redFlags: ["SpO2 < 92%", "Частота дыхания > 30", "Спутанность сознания", "Гипотензия"],
    },
  },
  {
    title: "Острый коронарный синдром",
    specialty: "CARDIOLOGY" as const,
    difficulty: "ADVANCED" as const,
    summary: "Мужчина 58 лет с давящей загрудинной болью.",
    estimatedMinutes: 25,
    tags: ["окс", "инфаркт", "кардиология"],
    content: {
      patient: { name: "Пётр Морозов", age: 58, sex: "MALE" },
      initialComplaint: "Сильно давит за грудиной уже час, отдаёт в левую руку, потею.",
      presentation:
        "Интенсивная давящая загрудинная боль в покое около 60 минут, иррадиация в левую руку и челюсть, потливость, тошнота.",
      initialVitals: { heartRate: 98, bloodPressure: "150/95", respiratoryRate: 20, temperatureC: 36.7, oxygenSaturation: 95 },
      learningObjectives: [
        "Распознать клинику ОКС с подъёмом ST",
        "Назначить начальную терапию (MONA + антиагреганты)",
        "Определить показания к экстренной реперфузии",
      ],
      references: ["Рекомендации ESC по ведению ОКСпST"],
      fullBackground:
        "Гипертоническая болезнь, курит, отец перенёс инфаркт в 60 лет. Принимает амлодипин нерегулярно.",
      hiddenDiagnosis: "Острый инфаркт миокарда с подъёмом сегмента ST (нижний)",
      diagnosisSynonyms: ["инфаркт миокарда", "STEMI", "ОКСпST", "острый коронарный синдром"],
      differentialDiagnoses: ["ТЭЛА", "Расслоение аорты", "Перикардит"],
      clinicalPathway: [
        { order: 1, title: "ЭКГ в первые 10 минут", detail: "Подъём ST в II, III, aVF." },
        { order: 2, title: "Аспирин + второй антиагрегант", detail: "Нагрузочные дозы." },
        { order: 3, title: "Экстренная реперфузия", detail: "ЧКВ предпочтительно ≤ 120 мин." },
      ],
      examFindings: [
        { name: "ЭКГ", category: "Кардиология", result: "Подъём ST в отведениях II, III, aVF.", abnormal: true },
        { name: "Тропонин", category: "Лаборатория", result: "Повышен — 2.4 нг/мл.", abnormal: true },
        { name: "Рентгенография грудной клетки", category: "Визуализация", result: "Без острой патологии.", abnormal: false },
      ],
      correctTreatments: ["Аспирин", "Клопидогрель", "Гепарин", "Нитроглицерин", "Морфин", "ЧКВ"],
      contraindicatedTreatments: ["Ибупрофен", "НПВС"],
      redFlags: ["Подъём ST на ЭКГ", "Гемодинамическая нестабильность", "Потливость и иррадиация боли"],
    },
  },
  {
    title: "Острый ларинготрахеит (круп)",
    specialty: "PEDIATRICS" as const,
    difficulty: "BEGINNER" as const,
    summary: "Девочка 3 лет с лающим кашлем и стридором.",
    estimatedMinutes: 15,
    tags: ["круп", "педиатрия", "стридор"],
    content: {
      patient: { name: "Аня Кузнецова", age: 3, sex: "FEMALE" },
      initialComplaint: "У дочки ночью начался лающий кашель и тяжело дышать.",
      presentation:
        "Лающий кашель, осиплость голоса, инспираторный стридор, усиливающийся при беспокойстве, субфебрильная температура, ринит накануне.",
      initialVitals: { heartRate: 128, bloodPressure: "95/60", respiratoryRate: 32, temperatureC: 37.8, oxygenSaturation: 96 },
      learningObjectives: [
        "Распознать клинику вирусного крупа",
        "Оценить тяжесть стридора (шкала Westley)",
        "Назначить дексаметазон и при необходимости адреналин",
      ],
      references: ["Клинические рекомендации по острому стенозирующему ларинготрахеиту"],
      fullBackground:
        "Ребёнок привит по возрасту, развивается нормально. За 2 дня до этого — насморк. Контакт с ОРВИ в детском саду.",
      hiddenDiagnosis: "Острый вирусный ларинготрахеит (круп)",
      diagnosisSynonyms: ["круп", "ларинготрахеит", "стенозирующий ларинготрахеит", "croup"],
      differentialDiagnoses: ["Эпиглоттит", "Инородное тело дыхательных путей", "Бактериальный трахеит"],
      clinicalPathway: [
        { order: 1, title: "Успокоить ребёнка", detail: "Минимизировать беспокойство — оно усиливает стридор." },
        { order: 2, title: "Дексаметазон", detail: "0.15–0.6 мг/кг однократно." },
        { order: 3, title: "Ингаляции адреналина при тяжёлом стридоре", detail: "Наблюдение не менее 2–3 часов." },
      ],
      examFindings: [
        { name: "Осмотр зева", category: "Осмотр", result: "Зев умеренно гиперемирован, надгортанник не изменён.", abnormal: false },
        { name: "Аускультация", category: "Осмотр", result: "Инспираторный стридор, проводные хрипы.", abnormal: true },
        { name: "Пульсоксиметрия", category: "Мониторинг", result: "SpO2 96% на воздухе.", abnormal: false },
      ],
      correctTreatments: ["Дексаметазон", "Ингаляции адреналина", "Увлажнённый кислород", "Покой"],
      contraindicatedTreatments: ["Осмотр зева шпателем при подозрении на эпиглоттит", "Антибиотики рутинно"],
      redFlags: ["Стридор в покое", "Втяжение уступчивых мест", "Цианоз", "Сонливость/истощение"],
    },
  },
];

const QUESTIONS = [
  { type: "SINGLE_CHOICE" as const, specialty: "CARDIOLOGY" as const, difficulty: "INTERMEDIATE" as const, points: 1,
    stem: "Препарат первой линии при остром инфаркте миокарда с подъёмом ST?",
    options: ["Аспирин", "Ибупрофен", "Парацетамол", "Амоксициллин"], correctOptions: [0],
    explanation: "Аспирин (нагрузочная доза) показан всем пациентам с ОКС при отсутствии противопоказаний." },
  { type: "SINGLE_CHOICE" as const, specialty: "THERAPY" as const, difficulty: "BEGINNER" as const, points: 1,
    stem: "Какой показатель входит в шкалу CURB-65?",
    options: ["Мочевина крови", "Уровень глюкозы", "Уровень тропонина", "Скорость СОЭ"], correctOptions: [0],
    explanation: "CURB-65: Confusion, Urea, Respiratory rate, Blood pressure, возраст ≥ 65." },
  { type: "MULTIPLE_CHOICE" as const, specialty: "THERAPY" as const, difficulty: "INTERMEDIATE" as const, points: 2,
    stem: "Какие признаки являются «красными флагами» при пневмонии? (выберите все)",
    options: ["SpO2 < 92%", "ЧД > 30", "Субфебрилитет", "Спутанность сознания"], correctOptions: [0, 1, 3],
    explanation: "Гипоксемия, тахипноэ и нарушение сознания указывают на тяжёлое течение." },
  { type: "ECG_INTERPRETATION" as const, specialty: "CARDIOLOGY" as const, difficulty: "ADVANCED" as const, points: 2,
    stem: "Подъём сегмента ST в отведениях II, III, aVF соответствует инфаркту какой локализации?",
    options: ["Нижний", "Передний", "Боковой", "Перегородочный"], correctOptions: [0],
    explanation: "II, III, aVF — нижняя стенка левого желудочка (правая коронарная артерия)." },
  { type: "IMAGE_DIAGNOSIS" as const, specialty: "PEDIATRICS" as const, difficulty: "BEGINNER" as const, points: 1,
    stem: "Лающий кашель и инспираторный стридор у ребёнка 3 лет наиболее характерны для:",
    options: ["Крупа", "Бронхиальной астмы", "Пневмонии", "Коклюша"], correctOptions: [0],
    explanation: "Лающий кашель + стридор — классика вирусного крупа (ларинготрахеита)." },
  { type: "RADIOLOGY" as const, specialty: "THERAPY" as const, difficulty: "INTERMEDIATE" as const, points: 1,
    stem: "Инфильтрат в нижней доле правого лёгкого на рентгенограмме при лихорадке и кашле указывает на:",
    options: ["Пневмонию", "Пневмоторакс", "Плевральный выпот", "Норму"], correctOptions: [0],
    explanation: "Очаговый инфильтрат в сочетании с клиникой — рентгенологический признак пневмонии." },
  { type: "SINGLE_CHOICE" as const, specialty: "PEDIATRICS" as const, difficulty: "INTERMEDIATE" as const, points: 1,
    stem: "Препарат выбора при вирусном крупе средней тяжести?",
    options: ["Дексаметазон", "Амоксициллин", "Сальбутамол", "Преднизолон внутрь длительно"], correctOptions: [0],
    explanation: "Однократный дексаметазон уменьшает отёк и тяжесть крупа." },
  { type: "CASE_BASED" as const, specialty: "CARDIOLOGY" as const, difficulty: "ADVANCED" as const, points: 2,
    stem: "Мужчина 58 лет, боль за грудиной 1 час, ЭКГ — подъём ST. Оптимальная тактика реперфузии при доступном ЧКВ ≤ 120 мин?",
    options: ["Первичное ЧКВ", "Системный тромболизис", "Только медикаментозно", "Плановая коронарография"], correctOptions: [0],
    explanation: "При доступном своевременном ЧКВ оно предпочтительнее тромболизиса." },
  { type: "SINGLE_CHOICE" as const, specialty: "NEUROLOGY" as const, difficulty: "INTERMEDIATE" as const, points: 1,
    stem: "Шкала, используемая для быстрой догоспитальной оценки инсульта?",
    options: ["FAST", "GCS", "APGAR", "CURB-65"], correctOptions: [0],
    explanation: "FAST (Face-Arm-Speech-Time) — скрининг признаков инсульта." },
  { type: "MULTIPLE_CHOICE" as const, specialty: "SURGERY" as const, difficulty: "BEGINNER" as const, points: 2,
    stem: "Какие признаки характерны для острого аппендицита? (выберите все)",
    options: ["Боль в правой подвздошной области", "Симптом Щёткина–Блюмберга", "Лихорадка", "Брадикардия в покое"], correctOptions: [0, 1, 2],
    explanation: "Локальная боль, перитонеальные знаки и лихорадка типичны; брадикардия не характерна." },
];

const OSCE = {
  title: "ОСКЭ: Острая боль в груди",
  description: "Станционный экзамен по ведению пациента с острой загрудинной болью.",
  specialty: "CARDIOLOGY" as const,
  passScore: 60,
  stations: [
    {
      title: "Сбор анамнеза",
      scenario: "Мужчина 58 лет с острой загрудинной болью. Соберите целенаправленный анамнез за 5 минут.",
      durationSec: 300,
      expectedDiagnosis: "Острый коронарный синдром",
      correctPathway: "ABCDE, ЭКГ, тропонин, аспирин, обезболивание, реперфузия.",
      examinerBrief: "Оцените выявление факторов риска и красных флагов.",
      checklist: [
        { label: "Представляется и получает согласие", points: 1, critical: false, category: "Коммуникация" },
        { label: "Уточняет характеристики боли (SOCRATES)", points: 2, critical: false, category: "Анамнез" },
        { label: "Выявляет иррадиацию и красные флаги", points: 2, critical: true, category: "Безопасность" },
        { label: "Собирает факторы сердечно-сосудистого риска", points: 1, critical: false, category: "Анамнез" },
      ],
    },
    {
      title: "Интерпретация ЭКГ",
      scenario: "Опишите представленную ЭКГ и сформулируйте тактику.",
      durationSec: 180,
      expectedDiagnosis: "ОКС с подъёмом ST (нижний инфаркт)",
      correctPathway: "Распознать подъём ST, активировать экстренную реперфузию.",
      examinerBrief: "Проверьте распознавание подъёма ST и локализации.",
      checklist: [
        { label: "Определяет подъём сегмента ST", points: 3, critical: true, category: "Исследования" },
        { label: "Указывает локализацию (нижний)", points: 1, critical: false, category: "Диагностика" },
        { label: "Формулирует показание к реперфузии", points: 1, critical: false, category: "Лечение" },
      ],
    },
    {
      title: "Начальная терапия",
      scenario: "Назначьте начальное лечение пациенту с ОКСпST.",
      durationSec: 180,
      expectedDiagnosis: "ОКС с подъёмом ST",
      correctPathway: "Аспирин + второй антиагрегант, антикоагулянт, обезболивание, кислород по показаниям.",
      examinerBrief: "Проверьте безопасное назначение антиагрегантов.",
      checklist: [
        { label: "Назначает аспирин (нагрузочная доза)", points: 2, critical: true, category: "Лечение" },
        { label: "Назначает второй антиагрегант", points: 1, critical: false, category: "Лечение" },
        { label: "Обеспечивает обезболивание", points: 1, critical: false, category: "Лечение" },
      ],
    },
  ],
};

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
