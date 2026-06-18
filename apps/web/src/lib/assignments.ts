import type {
  AssignmentDetail,
  AssignmentMeta,
  CreateAssignmentInput,
  CreateGroupInput,
  GroupView,
  NotificationView,
  ReviewSubmissionInput,
  StudentListItem,
  StudentTask,
  SubmissionView,
  UpdateAssignmentInput,
} from "@med/shared";
import { api } from "./api";

// ─── Students & groups ───
export const listStudents = () => api<StudentListItem[]>("/users/students");
export const listGroups = () => api<GroupView[]>("/groups");
export const getGroup = (id: string) => api<GroupView>(`/groups/${id}`);
export const createGroup = (input: CreateGroupInput) =>
  api<GroupView>("/groups", { method: "POST", body: input });
export const renameGroup = (id: string, name: string) =>
  api<GroupView>(`/groups/${id}`, { method: "PATCH", body: { name } });
export const addGroupMembers = (id: string, userIds: string[]) =>
  api<GroupView>(`/groups/${id}/members`, { method: "POST", body: { userIds } });
export const removeGroupMember = (id: string, userId: string) =>
  api<GroupView>(`/groups/${id}/members/${userId}`, { method: "DELETE" });
export const deleteGroup = (id: string) =>
  api<{ deleted: boolean }>(`/groups/${id}`, { method: "DELETE" });

// ─── Assignments ───
export const listAssignments = () => api<AssignmentMeta[]>("/assignments");
export const getAssignment = (id: string) => api<AssignmentDetail>(`/assignments/${id}`);
export const createAssignment = (input: CreateAssignmentInput) =>
  api<AssignmentDetail>("/assignments", { method: "POST", body: input });
export const updateAssignment = (id: string, input: UpdateAssignmentInput) =>
  api<AssignmentDetail>(`/assignments/${id}`, { method: "PATCH", body: input });
export const deleteAssignment = (id: string) =>
  api<{ deleted: boolean }>(`/assignments/${id}`, { method: "DELETE" });
export const reviewSubmission = (submissionId: string, input: ReviewSubmissionInput) =>
  api<SubmissionView>(`/assignments/submissions/${submissionId}/review`, {
    method: "POST",
    body: input,
  });

// ─── Student tasks ───
export const myTasks = () => api<StudentTask[]>("/submissions/my");
export const submitTask = (submissionId: string) =>
  api<StudentTask>(`/submissions/${submissionId}/submit`, { method: "POST" });

// ─── Notifications ───
export const listNotifications = () => api<NotificationView[]>("/notifications");
export const unreadCount = () => api<{ count: number }>("/notifications/unread-count");
export const markNotificationRead = (id: string) =>
  api<{ ok: true }>(`/notifications/${id}/read`, { method: "PATCH" });
export const markAllNotificationsRead = () =>
  api<{ ok: true }>("/notifications/read-all", { method: "POST" });
