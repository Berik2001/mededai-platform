/** Clinical teaching cases — stored in MongoDB. */

export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export type MedicalSpecialty =
  | "CARDIOLOGY"
  | "NEUROLOGY"
  | "PEDIATRICS"
  | "ONCOLOGY"
  | "EMERGENCY"
  | "INTERNAL_MEDICINE"
  | "SURGERY"
  | "PSYCHIATRY"
  | "OTHER";

export interface VitalSigns {
  heartRate?: number;
  bloodPressure?: string;
  respiratoryRate?: number;
  temperatureC?: number;
  oxygenSaturation?: number;
}

export interface PatientProfile {
  age: number;
  sex: "MALE" | "FEMALE" | "OTHER";
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory?: string[];
  medications?: string[];
  allergies?: string[];
  vitals?: VitalSigns;
}

export interface CaseQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface ClinicalCase {
  id: string;
  title: string;
  specialty: MedicalSpecialty;
  difficulty: Difficulty;
  summary: string;
  patient: PatientProfile;
  learningObjectives: string[];
  questions: CaseQuestion[];
  tags: string[];
  authorId: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCaseInput {
  title: string;
  specialty: MedicalSpecialty;
  difficulty: Difficulty;
  summary: string;
  patient: PatientProfile;
  learningObjectives: string[];
  questions: Omit<CaseQuestion, "id">[];
  tags?: string[];
  published?: boolean;
}

export type UpdateCaseInput = Partial<CreateCaseInput>;

export interface CaseQuery {
  specialty?: MedicalSpecialty;
  difficulty?: Difficulty;
  search?: string;
  publishedOnly?: boolean;
  page?: number;
  limit?: number;
}
