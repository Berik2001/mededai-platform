import { Difficulty } from "./case";
import { CaseStatus, ClinicalSpecialty } from "../constants/specialties";

export type QuestionType =
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "IMAGE_DIAGNOSIS"
  | "ECG_INTERPRETATION"
  | "RADIOLOGY"
  | "CASE_BASED";

export const QUESTION_TYPES: QuestionType[] = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "IMAGE_DIAGNOSIS",
  "ECG_INTERPRETATION",
  "RADIOLOGY",
  "CASE_BASED",
];

/** UI/behaviour metadata per question type. */
export const QUESTION_TYPE_META: Record<
  QuestionType,
  { ru: string; en: string; image: boolean; multi: boolean; vignette: boolean }
> = {
  SINGLE_CHOICE: { ru: "Один ответ", en: "Single choice", image: false, multi: false, vignette: false },
  MULTIPLE_CHOICE: { ru: "Несколько ответов", en: "Multiple choice", image: false, multi: true, vignette: false },
  IMAGE_DIAGNOSIS: { ru: "Диагноз по изображению", en: "Image diagnosis", image: true, multi: false, vignette: false },
  ECG_INTERPRETATION: { ru: "Интерпретация ЭКГ", en: "ECG interpretation", image: true, multi: false, vignette: false },
  RADIOLOGY: { ru: "Лучевая диагностика", en: "Radiology", image: true, multi: false, vignette: false },
  CASE_BASED: { ru: "Клинический случай", en: "Case-based", image: false, multi: false, vignette: true },
};

export interface QuestionBase {
  id: string;
  authorId: string;
  authorName?: string;
  type: QuestionType;
  specialty: ClinicalSpecialty;
  difficulty: Difficulty;
  status: CaseStatus;
  stem: string;
  caseVignette?: string | null;
  options: string[];
  imageUrls: string[];
  points: number;
  createdAt: string;
  updatedAt: string;
}

/** Full question (teacher/admin) — includes the answer key. */
export interface Question extends QuestionBase {
  correctOptions: number[];
  explanation?: string | null;
}

/** Question as shown to a student while taking a test (no answer key). */
export type PublicQuestion = QuestionBase;

export interface CreateQuestionInput {
  type: QuestionType;
  specialty: ClinicalSpecialty;
  difficulty: Difficulty;
  status?: CaseStatus;
  stem: string;
  caseVignette?: string;
  options: string[];
  correctOptions: number[];
  imageUrls?: string[];
  explanation?: string;
  points?: number;
}
export type UpdateQuestionInput = Partial<CreateQuestionInput>;

export interface QuestionQuery {
  type?: QuestionType;
  specialty?: ClinicalSpecialty;
  difficulty?: Difficulty;
  status?: CaseStatus;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Tests ───────────────────────────────────────────────────────
export interface TestMeta {
  id: string;
  authorId: string;
  authorName?: string;
  title: string;
  description?: string | null;
  specialty: ClinicalSpecialty;
  difficulty: Difficulty;
  status: CaseStatus;
  timeLimitMinutes: number;
  passingScore: number;
  shuffle: boolean;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestDetail extends TestMeta {
  /** Ordered question ids (for the test builder). */
  questionIds: string[];
}

export interface CreateTestInput {
  title: string;
  description?: string;
  specialty: ClinicalSpecialty;
  difficulty: Difficulty;
  status?: CaseStatus;
  timeLimitMinutes?: number;
  passingScore?: number;
  shuffle?: boolean;
  questionIds: string[];
}
export type UpdateTestInput = Partial<CreateTestInput>;

export interface TestQuery {
  specialty?: ClinicalSpecialty;
  difficulty?: Difficulty;
  status?: CaseStatus;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Sessions / grading ──────────────────────────────────────────
export type TestSessionStatus = "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";

export interface QuestionResult {
  questionId: string;
  correctOptions: number[];
  selected: number[];
  isCorrect: boolean;
  explanation?: string | null;
  points: number;
  awarded: number;
}

export interface TestResult {
  score: number;
  maxScore: number;
  percent: number;
  passed: boolean;
  passingScore: number;
  questions: QuestionResult[];
}

export interface TestSessionView {
  id: string;
  testId: string;
  testTitle: string;
  status: TestSessionStatus;
  timeLimitMinutes: number;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string | null;
  /** Redacted questions, in session order. */
  questions: PublicQuestion[];
  answers: Record<string, number[]>;
  /** Present only once submitted/graded. */
  result?: TestResult | null;
}

export interface TestSessionSummary {
  id: string;
  testId: string;
  testTitle: string;
  status: TestSessionStatus;
  score?: number | null;
  maxScore?: number | null;
  passed?: boolean | null;
  startedAt: string;
  submittedAt?: string | null;
}

export interface SaveAnswersInput {
  answers: Record<string, number[]>;
}
export interface SubmitAnswersInput {
  answers: Record<string, number[]>;
}

export interface UploadResult {
  url: string;
}
