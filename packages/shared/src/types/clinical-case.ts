import { Difficulty } from "./case";
import { CaseStatus, ClinicalSpecialty } from "../constants/specialties";

export interface CasePatient {
  name: string;
  age: number;
  sex: "MALE" | "FEMALE" | "OTHER";
}

export interface CaseVitals {
  heartRate?: number;
  bloodPressure?: string;
  respiratoryRate?: number;
  temperatureC?: number;
  oxygenSaturation?: number;
}

export interface ClinicalPathwayStep {
  order: number;
  title: string;
  detail: string;
}

export interface CaseExamFinding {
  name: string;
  category?: string;
  result: string;
  abnormal: boolean;
}

/** Content a student may see before/while solving the case. */
export interface CaseVisibleContent {
  patient: CasePatient;
  initialComplaint: string;
  /** Curated presenting history shown to the learner. */
  presentation: string;
  initialVitals: CaseVitals;
  learningObjectives: string[];
  references: string[];
}

/** The teaching key + Virtual Patient ground truth — never shown to students. */
export interface CaseHiddenContent {
  /** Full HPI/PMH/social narrative; drives the Virtual Patient persona. */
  fullBackground: string;
  hiddenDiagnosis: string;
  diagnosisSynonyms: string[];
  differentialDiagnoses: string[];
  clinicalPathway: ClinicalPathwayStep[];
  examFindings: CaseExamFinding[];
  correctTreatments: string[];
  contraindicatedTreatments: string[];
  redFlags: string[];
}

export type CaseContent = CaseVisibleContent & CaseHiddenContent;

export interface ClinicalCaseMeta {
  id: string;
  authorId: string;
  authorName?: string;
  title: string;
  specialty: ClinicalSpecialty;
  difficulty: Difficulty;
  status: CaseStatus;
  summary?: string | null;
  estimatedMinutes?: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type ClinicalCaseSummary = ClinicalCaseMeta;

export interface ClinicalCaseFull {
  meta: ClinicalCaseMeta;
  /** Full content for the author/admin; redacted (visible-only) for everyone else. */
  content: CaseContent | CaseVisibleContent;
  canEdit: boolean;
  /** True when `content` has been stripped of the teaching key. */
  redacted: boolean;
}

// ─── Request payloads ────────────────────────────────────────────
export interface CreateClinicalCaseInput {
  title: string;
  specialty: ClinicalSpecialty;
  difficulty: Difficulty;
  status?: CaseStatus;
  summary?: string;
  estimatedMinutes?: number;
  tags?: string[];
  content: CaseContent;
}

export type UpdateClinicalCaseInput = Partial<CreateClinicalCaseInput>;

export interface ClinicalCaseQuery {
  specialty?: ClinicalSpecialty;
  difficulty?: Difficulty;
  status?: CaseStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface LaunchCaseResult {
  sessionId: string;
}
