export type AssignmentTargetType = "CASE" | "TEST";

/** DB stores ASSIGNED/IN_PROGRESS/SUBMITTED/GRADED; LATE is derived in views. */
export type SubmissionStatus = "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "LATE";

export type NotificationType =
  | "ASSIGNMENT_CREATED"
  | "DEADLINE_APPROACHING"
  | "SUBMISSION_RECEIVED"
  | "SUBMISSION_GRADED";

// ─── Students / groups ───
export interface StudentListItem {
  id: string;
  name: string;
  email: string;
  yearOfStudy?: number | null;
}

export interface GroupMemberView {
  id: string;
  name: string;
  email: string;
}

export interface GroupView {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  members?: GroupMemberView[];
  createdAt: string;
}

export interface CreateGroupInput {
  name: string;
  memberIds?: string[];
}

// ─── Assignments ───
export interface AssignmentMeta {
  id: string;
  teacherId: string;
  teacherName?: string;
  title: string;
  instructions?: string | null;
  targetType: AssignmentTargetType;
  caseId?: string | null;
  testId?: string | null;
  targetTitle?: string;
  dueAt: string;
  createdAt: string;
  submissionCount: number;
  submittedCount: number;
  gradedCount: number;
}

export interface SubmissionView {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName?: string;
  status: SubmissionStatus;
  resultRef?: string | null;
  score?: number | null;
  submittedAt?: string | null;
  grade?: number | null;
  feedback?: string | null;
  reviewedAt?: string | null;
}

export interface AssignmentDetail extends AssignmentMeta {
  submissions: SubmissionView[];
}

/** A student's view of an assigned task. */
export interface StudentTask {
  submissionId: string;
  assignmentId: string;
  title: string;
  instructions?: string | null;
  targetType: AssignmentTargetType;
  caseId?: string | null;
  testId?: string | null;
  targetTitle?: string;
  teacherName?: string;
  dueAt: string;
  status: SubmissionStatus;
  score?: number | null;
  grade?: number | null;
  feedback?: string | null;
  submittedAt?: string | null;
}

export interface CreateAssignmentInput {
  title: string;
  instructions?: string;
  targetType: AssignmentTargetType;
  caseId?: string;
  testId?: string;
  dueAt: string;
  studentIds?: string[];
  groupIds?: string[];
}

export interface UpdateAssignmentInput {
  title?: string;
  instructions?: string;
  dueAt?: string;
}

export interface ReviewSubmissionInput {
  grade?: number;
  feedback?: string;
}

// ─── Notifications ───
export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: string;
}
