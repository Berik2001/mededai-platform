import { Injectable, Logger } from "@nestjs/common";
import {
  EvaluateAnswerResponse,
  GenerateCaseRequest,
  TutorResponse,
} from "@med/shared";
import { GeminiService, GeminiMessage } from "./gemini.service";
import { TutorDto } from "./dto/tutor.dto";
import { GenerateCaseDto } from "./dto/generate-case.dto";
import { EvaluateAnswerDto } from "./dto/evaluate-answer.dto";

const TUTOR_SYSTEM_PROMPT = `You are an expert medical educator and Socratic tutor for medical students.
Guide learners toward clinical reasoning rather than handing them answers.
Ask probing questions, reference pathophysiology, and keep responses concise and evidence-based.
Always remind learners that this is for educational purposes and not a substitute for clinical judgment.`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly gemini: GeminiService) {}

  /** Free-form Socratic tutoring conversation. */
  async tutor(dto: TutorDto): Promise<TutorResponse> {
    // Fold any system turns into the system instruction; map the rest to
    // Gemini roles (user → user, assistant → model).
    const systemParts = [TUTOR_SYSTEM_PROMPT];
    const chat: GeminiMessage[] = [];
    for (const m of dto.messages) {
      if (m.role === "system") {
        systemParts.push(m.content);
      } else {
        chat.push({ role: m.role === "assistant" ? "model" : "user", text: m.content });
      }
    }

    const result = await this.gemini.generate(chat, {
      system: systemParts.join("\n\n"),
      temperature: 0.7,
      maxOutputTokens: 1024,
    });

    return {
      message: { role: "assistant", content: result.text },
      model: result.model,
    };
  }

  /** Generate a structured clinical case as JSON. */
  async generateCase(dto: GenerateCaseDto): Promise<GenerateCaseRequest & { draft: unknown }> {
    const numQuestions = dto.numQuestions ?? 3;
    const prompt = `Generate a realistic clinical teaching case as strict JSON matching this TypeScript shape:
{
  "title": string,
  "specialty": "${dto.specialty}",
  "difficulty": "${dto.difficulty}",
  "summary": string,
  "patient": {
    "age": number, "sex": "MALE"|"FEMALE"|"OTHER",
    "chiefComplaint": string, "historyOfPresentIllness": string,
    "pastMedicalHistory": string[], "medications": string[], "allergies": string[],
    "vitals": { "heartRate": number, "bloodPressure": string, "respiratoryRate": number, "temperatureC": number, "oxygenSaturation": number }
  },
  "learningObjectives": string[],
  "questions": [{ "prompt": string, "options": string[], "correctOptionIndex": number, "explanation": string }],
  "tags": string[]
}
Specialty: ${dto.specialty}. Difficulty: ${dto.difficulty}. ${
      dto.topic ? `Topic focus: ${dto.topic}.` : ""
    } Produce exactly ${numQuestions} multiple-choice questions. Respond with JSON only.`;

    const result = await this.gemini.generateText(prompt, {
      system: "You are a medical content author. Output valid JSON only.",
      json: true,
      maxOutputTokens: 4096,
    });

    const draft = this.safeJson(result.text);
    return { specialty: dto.specialty, difficulty: dto.difficulty, topic: dto.topic, numQuestions, draft };
  }

  /** Evaluate a learner's free-text answer and return structured feedback. */
  async evaluateAnswer(dto: EvaluateAnswerDto): Promise<EvaluateAnswerResponse> {
    const prompt = `A medical student answered a clinical question.
Question: ${dto.questionPrompt}
Student answer: ${dto.learnerAnswer}

Assess the answer. Respond with strict JSON:
{ "score": number (0-100), "strengths": string[], "gaps": string[], "feedback": string }`;

    const result = await this.gemini.generateText(prompt, {
      system: "You are a rigorous but supportive medical examiner. Output JSON only.",
      json: true,
      maxOutputTokens: 1024,
    });

    const parsed = this.safeJson(result.text) as Partial<EvaluateAnswerResponse> | null;

    return {
      score: typeof parsed?.score === "number" ? parsed.score : 0,
      strengths: parsed?.strengths ?? [],
      gaps: parsed?.gaps ?? [],
      feedback: parsed?.feedback ?? "No feedback generated.",
      model: result.model,
    };
  }

  private safeJson(raw: string | null | undefined): unknown {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      this.logger.warn("Failed to parse AI JSON response");
      return null;
    }
  }
}
