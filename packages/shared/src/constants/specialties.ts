/**
 * Clinical specialty taxonomy for the Clinical Cases module.
 * Keep in sync with the Prisma `Specialty` enum (apps/api/prisma/schema.prisma).
 */
export enum ClinicalSpecialty {
  THERAPY = "THERAPY",
  SURGERY = "SURGERY",
  CARDIOLOGY = "CARDIOLOGY",
  NEUROLOGY = "NEUROLOGY",
  PEDIATRICS = "PEDIATRICS",
  CRITICAL_CARE = "CRITICAL_CARE",
  NURSING = "NURSING",
}

export const CLINICAL_SPECIALTIES: ClinicalSpecialty[] = [
  ClinicalSpecialty.THERAPY,
  ClinicalSpecialty.SURGERY,
  ClinicalSpecialty.CARDIOLOGY,
  ClinicalSpecialty.NEUROLOGY,
  ClinicalSpecialty.PEDIATRICS,
  ClinicalSpecialty.CRITICAL_CARE,
  ClinicalSpecialty.NURSING,
];

/** Display labels (Russian primary, English secondary). */
export const CLINICAL_SPECIALTY_LABELS: Record<ClinicalSpecialty, { ru: string; en: string }> = {
  [ClinicalSpecialty.THERAPY]: { ru: "Терапия", en: "Internal Medicine" },
  [ClinicalSpecialty.SURGERY]: { ru: "Хирургия", en: "Surgery" },
  [ClinicalSpecialty.CARDIOLOGY]: { ru: "Кардиология", en: "Cardiology" },
  [ClinicalSpecialty.NEUROLOGY]: { ru: "Неврология", en: "Neurology" },
  [ClinicalSpecialty.PEDIATRICS]: { ru: "Педиатрия", en: "Pediatrics" },
  [ClinicalSpecialty.CRITICAL_CARE]: { ru: "Реанимация", en: "Critical Care" },
  [ClinicalSpecialty.NURSING]: { ru: "Сестринское дело", en: "Nursing" },
};

export type CaseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export const CASE_STATUSES: CaseStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
