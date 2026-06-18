import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type {
  Difficulty,
  VPCondition,
  VPDebrief,
  VPDiagnosisAttempt,
  VPMessageKind,
  VPMessageRole,
  VPSessionStatus,
  VPTreatmentEffect,
  VPVitals,
} from "@med/shared";

export type VirtualPatientSessionDocument = HydratedDocument<VirtualPatientSession>;

/** A single examination result baked into the scenario (the hidden ground truth). */
export interface VPExamFinding {
  name: string;
  category?: string;
  result: string;
  abnormal: boolean;
}

/**
 * The hidden scenario — the simulation's source of truth. NEVER serialized to
 * the client during an active encounter (the service maps to a safe view).
 */
export interface VPScenario {
  title: string;
  /** Free-form specialty label (ClinicalSpecialty for case-seeded, MedicalSpecialty for AI). */
  specialty: string;
  difficulty: Difficulty;
  patient: { name: string; age: number; sex: "MALE" | "FEMALE" | "OTHER" };
  presentingComplaint: string;
  /** HPI / PMH / meds / social narrative used to drive the patient persona. */
  background: string;
  /** Occupation — colours how the patient speaks (optional). */
  occupation?: string;
  /** Temperament: e.g. "тревожный" | "спокойный" | "раздражительный" (optional). */
  personality?: string;
  /**
   * Something the patient is reluctant to volunteer (smoking, drinking, a
   * symptom they're embarrassed about) — only admitted when directly asked.
   */
  hiddenAgenda?: string;
  initialVitals: VPVitals;
  hiddenDiagnosis: string;
  diagnosisSynonyms: string[];
  correctTreatments: string[];
  contraindicatedTreatments: string[];
  examFindings: VPExamFinding[];
  redFlags: string[];
}

export interface VPMessageDoc {
  role: VPMessageRole;
  kind: VPMessageKind;
  content: string;
  createdAt: Date;
}

export interface VPExamDoc {
  name: string;
  category?: string;
  result: string;
  abnormal: boolean;
  orderedAt: Date;
}

export interface VPTreatmentDoc {
  name: string;
  dosage?: string;
  effect: VPTreatmentEffect;
  prescribedAt: Date;
}

export interface VPDiagnosisDoc extends Omit<VPDiagnosisAttempt, "submittedAt"> {
  submittedAt: Date;
}

@Schema({
  timestamps: true,
  collection: "virtual_patient_sessions",
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = (ret._id as { toString(): string })?.toString();
      delete ret._id;
      return ret;
    },
  },
})
export class VirtualPatientSession {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, default: "ACTIVE", index: true })
  status!: VPSessionStatus;

  /** Set when the session was launched from a Clinical Case (for assignment linking). */
  @Prop({ type: String, index: true, default: null })
  sourceCaseId!: string | null;

  @Prop({ type: Object, required: true })
  scenario!: VPScenario;

  @Prop({ type: Object, required: true })
  condition!: VPCondition;

  @Prop({ type: [Object], default: [] })
  messages!: VPMessageDoc[];

  @Prop({ type: [Object], default: [] })
  orderedExams!: VPExamDoc[];

  @Prop({ type: [Object], default: [] })
  treatments!: VPTreatmentDoc[];

  @Prop({ type: Object, default: null })
  diagnosis!: VPDiagnosisDoc | null;

  @Prop({ type: Number, default: null })
  score!: number | null;

  @Prop({ type: Object, default: null })
  debrief!: VPDebrief | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;
}

export const VirtualPatientSessionSchema =
  SchemaFactory.createForClass(VirtualPatientSession);
