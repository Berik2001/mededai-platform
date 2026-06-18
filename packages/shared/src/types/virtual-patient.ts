import { Difficulty } from "./case";

export type VPStability = "STABLE" | "IMPROVING" | "DETERIORATING" | "CRITICAL";
export type VPSessionStatus = "ACTIVE" | "COMPLETED" | "ABANDONED";
export type VPMessageRole = "student" | "patient" | "narrator" | "system";
export type VPMessageKind =
  | "opening"
  | "chat"
  | "exam"
  | "treatment"
  | "diagnosis"
  | "debrief";
export type VPTreatmentEffect = "IMPROVING" | "NEUTRAL" | "DETERIORATING";

export interface VPVitals {
  heartRate?: number;
  bloodPressure?: string;
  respiratoryRate?: number;
  temperatureC?: number;
  oxygenSaturation?: number;
}

export interface VPCondition {
  stability: VPStability;
  vitals: VPVitals;
  narrative: string;
}

export interface VPMessage {
  role: VPMessageRole;
  kind: VPMessageKind;
  content: string;
  createdAt: string;
}

export interface VPExamResult {
  name: string;
  category?: string;
  result: string;
  abnormal: boolean;
  orderedAt: string;
}

export interface VPTreatmentRecord {
  name: string;
  dosage?: string;
  effect: VPTreatmentEffect;
  prescribedAt: string;
}

export interface VPDiagnosisAttempt {
  value: string;
  correct: boolean;
  feedback: string;
  submittedAt: string;
}

/** Non-sensitive scenario info safe to show the learner during the encounter. */
export interface VPScenarioSummary {
  title: string;
  /** Free-form specialty label (may be a ClinicalSpecialty or AI-provided value). */
  specialty: string;
  difficulty: Difficulty;
  presentingComplaint: string;
  patient: { name: string; age: number; sex: "MALE" | "FEMALE" | "OTHER" };
}

/** Post-encounter reveal — only present once the session is finalized. */
export interface VPDebrief {
  score: number;
  summary: string;
  correctDiagnosis: string;
  recommendedTreatments: string[];
  missedRedFlags: string[];
  whatWentWell: string[];
}

export interface VirtualPatientSessionView {
  id: string;
  status: VPSessionStatus;
  scenario: VPScenarioSummary;
  condition: VPCondition;
  messages: VPMessage[];
  orderedExams: VPExamResult[];
  treatments: VPTreatmentRecord[];
  diagnosis?: VPDiagnosisAttempt | null;
  score?: number | null;
  debrief?: VPDebrief | null;
  startedAt: string;
  completedAt?: string | null;
}

export interface VPSessionSummary {
  id: string;
  status: VPSessionStatus;
  title: string;
  specialty: string;
  difficulty: Difficulty;
  startedAt: string;
  score?: number | null;
}

// ─── Request payloads ────────────────────────────────────────────
export interface CreateVPSessionInput {
  specialty?: string;
  difficulty?: Difficulty;
  topic?: string;
}
export interface VPMessageInput {
  content: string;
}
export interface VPExamInput {
  name: string;
}
export interface VPTreatmentInput {
  name: string;
  dosage?: string;
}
export interface VPDiagnosisInput {
  value: string;
}

// ─── Streaming (SSE) events emitted by message/treatment endpoints ──
export type VPStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; condition: VPCondition; model?: string }
  | { type: "error"; message: string };
