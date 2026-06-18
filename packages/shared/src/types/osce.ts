import type { ClinicalSpecialty, CaseStatus } from "../constants/specialties";

export type OsceSessionStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type OsceStationState = "PENDING" | "ACTIVE" | "DONE";

// ─── Authoring (blueprint) ───
export interface OsceChecklistItemInput {
  label: string;
  points?: number;
  critical?: boolean;
  category?: string;
}

export interface OsceStationInput {
  title: string;
  /** Student-facing task brief shown during the station. */
  scenario: string;
  durationSec: number;
  /** Hidden ground truth — used for debrief, never sent to the student. */
  expectedDiagnosis?: string;
  correctPathway?: string;
  examinerBrief?: string;
  checklist: OsceChecklistItemInput[];
}

export interface CreateOsceExamInput {
  title: string;
  description?: string;
  specialty: ClinicalSpecialty;
  status?: CaseStatus;
  /** Pass threshold (percent). */
  passScore?: number;
  stations: OsceStationInput[];
}

export type UpdateOsceExamInput = Partial<CreateOsceExamInput>;

// ─── Blueprint views ───
export interface OsceChecklistItemView {
  id: string;
  order: number;
  label: string;
  points: number;
  critical: boolean;
  category?: string | null;
}

/** Full station (author/examiner): includes hidden ground truth + checklist. */
export interface OsceStationView {
  id: string;
  order: number;
  title: string;
  scenario: string;
  durationSec: number;
  expectedDiagnosis?: string | null;
  correctPathway?: string | null;
  examinerBrief?: string | null;
  checklist: OsceChecklistItemView[];
  maxScore: number;
}

/** Student/browse view of a station — task only, no answers. */
export interface OsceStationPublic {
  id: string;
  order: number;
  title: string;
  scenario: string;
  durationSec: number;
}

export interface OsceExamMeta {
  id: string;
  authorId: string;
  authorName?: string;
  title: string;
  description?: string | null;
  specialty: ClinicalSpecialty;
  status: CaseStatus;
  passScore: number;
  stationCount: number;
  totalDurationSec: number;
  maxScore: number;
  createdAt: string;
  updatedAt: string;
}

/** Author/admin detail — full stations with checklists + hidden fields. */
export interface OsceExamDetail extends OsceExamMeta {
  stations: OsceStationView[];
}

/** Browse detail for students/examiners — stations without answers. */
export interface OsceExamPublic extends OsceExamMeta {
  stations: OsceStationPublic[];
}

// ─── Conduct (session) ───
export interface OsceCheckResultView {
  checklistItemId: string;
  label: string;
  points: number;
  critical: boolean;
  category?: string | null;
  checked: boolean;
  note?: string | null;
}

/** A station as seen by the examiner conducting the exam. */
export interface OsceStationScoreView {
  stationId: string;
  order: number;
  title: string;
  scenario: string;
  durationSec: number;
  state: OsceStationState;
  startedAt?: string | null;
  /** Computed deadline (startedAt + durationSec) while ACTIVE. */
  endsAt?: string | null;
  endedAt?: string | null;
  score: number;
  maxScore: number;
  criticalFailed: boolean;
  examinerComment?: string | null;
  // Hidden ground truth, visible only to the examiner:
  expectedDiagnosis?: string | null;
  correctPathway?: string | null;
  examinerBrief?: string | null;
  checklist: OsceCheckResultView[];
}

export interface OsceSessionView {
  id: string;
  examId: string;
  examTitle: string;
  specialty: ClinicalSpecialty;
  status: OsceSessionStatus;
  /** Student drives the exam themselves (chat with AI patient + AI auto-grade). */
  selfConduct: boolean;
  studentId: string;
  studentName?: string;
  examinerId: string;
  examinerName?: string;
  passScore: number;
  totalScore: number;
  maxScore: number;
  percent: number;
  stations: OsceStationScoreView[];
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface OsceSessionSummary {
  id: string;
  examId: string;
  examTitle: string;
  specialty: ClinicalSpecialty;
  status: OsceSessionStatus;
  selfConduct: boolean;
  studentName?: string;
  examinerName?: string;
  percent: number;
  stationCount: number;
  createdAt: string;
}

// ─── Student live view (during the exam) ───
export interface OsceLiveStation {
  order: number;
  title: string;
  scenario: string;
  durationSec: number;
  state: OsceStationState;
  startedAt?: string | null;
  endsAt?: string | null;
}

export interface OsceLiveView {
  id: string;
  examTitle: string;
  specialty: ClinicalSpecialty;
  status: OsceSessionStatus;
  stationCount: number;
  /** 0-based index of the active (or most recent) station; -1 before start. */
  currentIndex: number;
  currentStation: OsceLiveStation | null;
  completed: boolean;
}

// ─── Self-conduct (student-driven, AI patient) ───
export interface OsceChatMessage {
  /** "student" = candidate, "patient" = AI roleplay reply. */
  role: "student" | "patient";
  content: string;
  at: string;
}

/** A station as seen by a student conducting the exam themselves — task only,
 * no hidden ground truth, no checklist, plus the AI-patient dialogue so far. */
export interface OsceSelfStation {
  stationId: string;
  order: number;
  title: string;
  scenario: string;
  durationSec: number;
  state: OsceStationState;
  startedAt?: string | null;
  endsAt?: string | null;
  chat: OsceChatMessage[];
}

export interface OsceSelfView {
  id: string;
  examTitle: string;
  specialty: ClinicalSpecialty;
  status: OsceSessionStatus;
  selfConduct: boolean;
  passScore: number;
  stationCount: number;
  /** 0-based index of the active (or most recent) station; -1 before start. */
  currentIndex: number;
  completed: boolean;
  stations: OsceSelfStation[];
}

// ─── Debrief ───
/** One checklist line with its weight and whether the student earned it. */
export interface OsceChecklistResult {
  label: string;
  points: number;
  checked: boolean;
  critical: boolean;
}

export interface OsceStationDebrief {
  stationId: string;
  title: string;
  score: number;
  maxScore: number;
  percent: number;
  criticalFailed: boolean;
  passed: boolean;
  /** Full per-item checklist outcome (done/missed + weight). */
  checklistResults: OsceChecklistResult[];
  /** Labels of checklist items the student missed. */
  missedItems: string[];
  /** Labels of missed items flagged as critical. */
  missedCritical: string[];
  /** Whether the correct diagnosis was reached (null when the station has no diagnosis step). */
  diagnosisCorrect: boolean | null;
  expectedDiagnosis?: string | null;
  correctPathway?: string | null;
  examinerComment?: string | null;
  /** AI narrative of clinical errors at this station. */
  errors: string[];
  recommendations: string[];
}

export interface OsceDebrief {
  /** Overall percent score. */
  score: number;
  /** Alias of `score` — overall percent, for the итог format. */
  percent: number;
  totalScore: number;
  maxScore: number;
  passed: boolean;
  /** Overall: was the diagnosis correct across diagnosis stations (null if none). */
  diagnosisCorrect: boolean | null;
  /** All missed checklist items across stations ("Станция — пункт"). */
  missedItems: string[];
  /** Narrative feedback (summary of the performance). */
  summary: string;
  stations: OsceStationDebrief[];
  recommendations: string[];
}

// ─── Conduct inputs ───
export interface CreateOsceSessionInput {
  examId: string;
  studentId: string;
  /** When true, the student conducts the exam themselves (AI patient + auto-grade). */
  selfConduct?: boolean;
}

export interface OsceCheckItemInput {
  checklistItemId: string;
  checked: boolean;
  note?: string;
}

export interface OsceCheckInput {
  items: OsceCheckItemInput[];
  examinerComment?: string;
}
