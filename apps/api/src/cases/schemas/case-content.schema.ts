import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import type {
  CaseExamFinding,
  CasePatient,
  CaseVitals,
  ClinicalPathwayStep,
} from "@med/shared";

export type CaseContentDocument = HydratedDocument<CaseContent>;

/**
 * Flexible clinical-case content (MongoDB). Relational metadata lives in
 * PostgreSQL (`clinical_cases`); `metaId` back-references it.
 */
@Schema({
  timestamps: true,
  collection: "case_contents",
  minimize: false,
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
export class CaseContent {
  @Prop({ index: true })
  metaId!: string;

  // ─── Visible to students ───
  @Prop({ type: Object, required: true })
  patient!: CasePatient;

  @Prop({ required: true })
  initialComplaint!: string;

  @Prop({ default: "" })
  presentation!: string;

  @Prop({ type: Object, default: {} })
  initialVitals!: CaseVitals;

  @Prop({ type: [String], default: [] })
  learningObjectives!: string[];

  @Prop({ type: [String], default: [] })
  references!: string[];

  // ─── Hidden teaching key / Virtual Patient ground truth ───
  @Prop({ default: "" })
  fullBackground!: string;

  @Prop({ required: true })
  hiddenDiagnosis!: string;

  @Prop({ type: [String], default: [] })
  diagnosisSynonyms!: string[];

  @Prop({ type: [String], default: [] })
  differentialDiagnoses!: string[];

  @Prop({ type: [Object], default: [] })
  clinicalPathway!: ClinicalPathwayStep[];

  @Prop({ type: [Object], default: [] })
  examFindings!: CaseExamFinding[];

  @Prop({ type: [String], default: [] })
  correctTreatments!: string[];

  @Prop({ type: [String], default: [] })
  contraindicatedTreatments!: string[];

  @Prop({ type: [String], default: [] })
  redFlags!: string[];
}

export const CaseContentSchema = SchemaFactory.createForClass(CaseContent);
