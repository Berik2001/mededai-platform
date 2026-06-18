/**
 * Russian display labels for enum-like values that come from the API.
 *
 * The raw enum values (BEGINNER, DRAFT, PEDIATRICS, …) are the contract with the
 * backend and must NOT change. These helpers only translate what the user sees.
 * Always render with these helpers; keep `value={enum}` on inputs untouched.
 */

// ─── Difficulty ────────────────────────────────────────────────────
const DIFFICULTY_LABELS: Record<string, string> = {
  BEGINNER: "Начальный",
  INTERMEDIATE: "Средний",
  ADVANCED: "Продвинутый",
};

export function difficultyLabel(value: string | null | undefined): string {
  if (!value) return "";
  return DIFFICULTY_LABELS[value] ?? value;
}

// ─── Specialty (covers both MedicalSpecialty and ClinicalSpecialty) ─
const SPECIALTY_LABELS: Record<string, string> = {
  THERAPY: "Терапия",
  INTERNAL_MEDICINE: "Терапия",
  SURGERY: "Хирургия",
  CARDIOLOGY: "Кардиология",
  NEUROLOGY: "Неврология",
  PEDIATRICS: "Педиатрия",
  CRITICAL_CARE: "Реанимация",
  EMERGENCY: "Неотложная помощь",
  ONCOLOGY: "Онкология",
  PSYCHIATRY: "Психиатрия",
  NURSING: "Сестринское дело",
  OTHER: "Другое",
};

export function specialtyLabel(value: string | null | undefined): string {
  if (!value) return "";
  return SPECIALTY_LABELS[value] ?? value.replace(/_/g, " ");
}

// ─── Content status (cases / tests / questions) ────────────────────
const CONTENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликовано",
  ARCHIVED: "В архиве",
};

export function contentStatusLabel(value: string | null | undefined): string {
  if (!value) return "";
  return CONTENT_STATUS_LABELS[value] ?? value;
}

// ─── Virtual-patient stability ─────────────────────────────────────
const VP_STABILITY_LABELS: Record<string, string> = {
  CRITICAL: "Критическое",
  DETERIORATING: "Ухудшается",
  STABLE: "Стабильно",
  IMPROVING: "Улучшается",
};

export function stabilityLabel(value: string | null | undefined): string {
  if (!value) return "";
  return VP_STABILITY_LABELS[value] ?? value;
}

// ─── Virtual-patient session status ────────────────────────────────
const VP_SESSION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активна",
  COMPLETED: "Завершена",
  ABANDONED: "Прервана",
};

export function vpSessionStatusLabel(value: string | null | undefined): string {
  if (!value) return "";
  return VP_SESSION_STATUS_LABELS[value] ?? value;
}

// ─── Test session status ───────────────────────────────────────────
const TEST_SESSION_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: "В процессе",
  SUBMITTED: "Отправлено",
  EXPIRED: "Истекло",
};

export function testSessionStatusLabel(value: string | null | undefined): string {
  if (!value) return "";
  return TEST_SESSION_STATUS_LABELS[value] ?? value;
}

// ─── Patient sex ───────────────────────────────────────────────────
const SEX_LABELS: Record<string, string> = {
  MALE: "мужской",
  FEMALE: "женский",
  OTHER: "другой",
};

export function sexLabel(value: string | null | undefined): string {
  if (!value) return "";
  return SEX_LABELS[value] ?? value;
}
