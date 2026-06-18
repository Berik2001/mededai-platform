import { Difficulty, MedicalSpecialty } from "./case";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Request to the AI tutor for a free-form Socratic conversation. */
export interface TutorRequest {
  messages: ChatMessage[];
  /** Optional case id to ground the conversation in a specific clinical case. */
  caseId?: string;
}

export interface TutorResponse {
  message: ChatMessage;
  model: string;
}

/** Request the AI to generate a brand-new clinical case. */
export interface GenerateCaseRequest {
  specialty: MedicalSpecialty;
  difficulty: Difficulty;
  topic?: string;
  numQuestions?: number;
}

/** Request feedback on a learner's free-text differential or answer. */
export interface EvaluateAnswerRequest {
  caseId: string;
  questionPrompt: string;
  learnerAnswer: string;
}

export interface EvaluateAnswerResponse {
  score: number; // 0–100
  strengths: string[];
  gaps: string[];
  feedback: string;
  model: string;
}
