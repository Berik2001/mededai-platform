// AI Analytics — derived, read-only metrics aggregated across every learning
// module (Tests, Virtual Patient, OSCE, Clinical Cases).

/** A normalized clinical-error taxonomy used for NLP-based classification. */
export type ErrorCategory =
  | "HISTORY"
  | "EXAMINATION"
  | "INVESTIGATION"
  | "DIAGNOSIS"
  | "MANAGEMENT"
  | "COMMUNICATION"
  | "SAFETY"
  | "KNOWLEDGE";

export const ERROR_CATEGORIES: ErrorCategory[] = [
  "HISTORY",
  "EXAMINATION",
  "INVESTIGATION",
  "DIAGNOSIS",
  "MANAGEMENT",
  "COMMUNICATION",
  "SAFETY",
  "KNOWLEDGE",
];

export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, { ru: string; en: string }> = {
  HISTORY: { ru: "Сбор анамнеза", en: "History taking" },
  EXAMINATION: { ru: "Осмотр", en: "Examination" },
  INVESTIGATION: { ru: "Исследования", en: "Investigations" },
  DIAGNOSIS: { ru: "Диагностика", en: "Diagnosis" },
  MANAGEMENT: { ru: "Лечение", en: "Management" },
  COMMUNICATION: { ru: "Коммуникация", en: "Communication" },
  SAFETY: { ru: "Безопасность", en: "Safety" },
  KNOWLEDGE: { ru: "Теория", en: "Knowledge" },
};

export type ActivitySource = "TEST" | "VIRTUAL_PATIENT" | "OSCE" | "CASE";

export interface ErrorCategoryCount {
  category: ErrorCategory;
  label: string;
  count: number;
}

export interface SpecialtyAccuracy {
  /** ClinicalSpecialty value (or a raw label when unmapped). */
  specialty: string;
  label: string;
  accuracy: number; // 0–100
  attempts: number; // sample size feeding this accuracy
}

export interface WeakTopic {
  specialty: string;
  label: string;
  accuracy: number;
  attempts: number;
}

export interface ActivityPoint {
  date: string; // ISO
  source: ActivitySource;
  label: string;
  score: number; // 0–100
}

export type SpeedRating = "FAST" | "MODERATE" | "DELIBERATE" | "UNKNOWN";

export interface DecisionSpeed {
  /** Mean seconds per test question. */
  avgSecondsPerQuestion: number | null;
  /** Mean minutes per virtual-patient encounter. */
  avgMinutesPerEncounter: number | null;
  rating: SpeedRating;
}

export type ProgressTrend = "IMPROVING" | "STEADY" | "DECLINING" | "UNKNOWN";

export interface ProgressSummary {
  masteryScore: number; // 0–100 composite
  trend: ProgressTrend;
  testsTaken: number;
  vpCompleted: number;
  osceCompleted: number;
  casesCompleted: number;
  activityTimeline: ActivityPoint[];
}

export type RecommendationPriority = "HIGH" | "MEDIUM" | "LOW";

export interface AiRecommendation {
  title: string;
  detail: string;
  priority: RecommendationPriority;
}

/**
 * The full personalised insight block shown on the student analytics page —
 * an overall read, strengths, growth zones, a concrete weekly plan and a
 * single motivational takeaway.
 */
export interface StudentInsights {
  /** Composite 0–100 read of where the student stands. */
  overallScore: number;
  /** Human phrasing of distance to the next level, e.g. "62% до продвинутого уровня". */
  levelProgress: string;
  /** 2–3 sentence overall assessment. */
  summary: string;
  /** What the student is doing well. */
  strengths: string[];
  /** Concrete weak spots / stages where errors cluster. */
  growthZones: string[];
  /** 3 concrete actions for the coming week. */
  weeklyPlan: string[];
  /** One motivating line: what changes if the main gap is fixed. */
  insight: string;
}

/** Full per-student analytics (the student dashboard / teacher drill-down). */
export interface StudentAnalytics {
  studentId: string;
  studentName: string;
  generatedAt: string;
  hasData: boolean;
  /** Test-question accuracy (0–100). */
  overallAccuracy: number;
  /** Accuracy on diagnostic activities (VP dx, image/ECG/radiology, case-based, OSCE dx stations). */
  diagnosticAccuracy: number;
  decisionSpeed: DecisionSpeed;
  errorsByCategory: ErrorCategoryCount[];
  totalErrors: number;
  accuracyBySpecialty: SpecialtyAccuracy[];
  weakTopics: WeakTopic[];
  progress: ProgressSummary;
  recommendations: AiRecommendation[];
  focusAreas: string[];
  aiSummary: string;
  /** Full personalised insight block (overall read, strengths, plan, motivation). */
  insights: StudentInsights;
  /** True when AI (Gemini) produced the recommendations; false = heuristic fallback. */
  aiGenerated: boolean;
}

// ─── Teacher / cohort analytics ───

export interface CohortStudentRow {
  studentId: string;
  studentName: string;
  email?: string;
  masteryScore: number;
  diagnosticAccuracy: number;
  overallAccuracy: number;
  totalErrors: number;
  weakestSpecialty?: string | null;
  activityCount: number;
}

export interface MasteryBucket {
  bucket: string; // e.g. "0–20"
  count: number;
}

export interface CohortAnalytics {
  generatedAt: string;
  groupId?: string | null;
  groupName?: string | null;
  studentCount: number;
  activeStudentCount: number; // students with any activity
  averages: {
    masteryScore: number;
    diagnosticAccuracy: number;
    overallAccuracy: number;
    avgSecondsPerQuestion: number | null;
  };
  errorsByCategory: ErrorCategoryCount[];
  accuracyBySpecialty: SpecialtyAccuracy[];
  masteryDistribution: MasteryBucket[];
  students: CohortStudentRow[];
}
