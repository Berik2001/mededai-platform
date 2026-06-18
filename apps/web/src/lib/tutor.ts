import type { ChatMessage, TutorResponse } from "@med/shared";
import { api } from "./api";

/** Send the conversation to the Socratic AI tutor (grounded in the student's progress). */
export function tutorChat(messages: ChatMessage[]): Promise<TutorResponse> {
  return api<TutorResponse>("/tutor/chat", { method: "POST", body: { messages } });
}
