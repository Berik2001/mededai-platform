import { Injectable, Logger } from "@nestjs/common";
import {
  ERROR_CATEGORIES,
  ERROR_CATEGORY_LABELS,
  ErrorCategory,
  ErrorCategoryCount,
} from "@med/shared";
import { GeminiService } from "../ai/gemini.service";

/** A single observed error, to be classified into an ErrorCategory. */
export interface ErrorEvent {
  text: string;
  /** Optional prior guess from the source (e.g. OSCE checklist category). */
  hint?: ErrorCategory;
}

export interface ClassifiedErrors {
  byCategory: ErrorCategoryCount[];
  total: number;
  aiUsed: boolean;
}

const KEYWORDS: Record<ErrorCategory, string[]> = {
  HISTORY: ["history", "anamnesis", "ask", "asks", "complaint", "onset", "duration", "smoking", "family history", "social", "presenting", "socrates", "rapport of pain"],
  EXAMINATION: ["exam", "examination", "palpat", "auscultat", "inspect", "percuss", "vital sign", "physical", "observation", "general appearance"],
  INVESTIGATION: ["ecg", "x-ray", "xray", "radiolog", "imaging", "lab", "troponin", "blood test", "investigation", "ultrasound", "ct scan", "mri", "interpret", "bloods", "d-dimer", "abg"],
  DIAGNOSIS: ["diagnos", "differential", "identif", "recognis", "recognize", "territory", "st elevation"],
  MANAGEMENT: ["treat", "manage", "prescrib", "drug", "dose", "medication", "therapy", "contraindicat", "aspirin", "fluid", "antibiotic", "analgesi"],
  COMMUNICATION: ["introduc", "consent", "explain", "rapport", "communicat", "reassur", "empath", "listen"],
  SAFETY: ["red flag", "critical", "safety", "allerg", "escalat", "deteriorat", "emergency", "sepsis", "airway", "resuscitat"],
  KNOWLEDGE: [],
};

@Injectable()
export class ErrorClassifierService {
  private readonly logger = new Logger(ErrorClassifierService.name);

  constructor(private readonly gemini: GeminiService) {}

  /**
   * Classify a batch of error events into the standard taxonomy. When `useAi`
   * is set the model performs NLP classification; otherwise (and on any AI
   * failure) a deterministic keyword classifier is used.
   */
  async classify(events: ErrorEvent[], opts: { useAi: boolean }): Promise<ClassifiedErrors> {
    const counts = new Map<ErrorCategory, number>();
    if (events.length === 0) {
      return { byCategory: [], total: 0, aiUsed: false };
    }

    let categories: ErrorCategory[] | null = null;
    let aiUsed = false;
    if (opts.useAi) {
      categories = await this.classifyWithAi(events).catch((err) => {
        this.logger.warn(`AI error classification failed: ${(err as Error).message}`);
        return null;
      });
      aiUsed = categories !== null;
    }

    events.forEach((e, i) => {
      const cat = categories?.[i] ?? this.heuristic(e);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    });

    const byCategory: ErrorCategoryCount[] = ERROR_CATEGORIES.map((category) => ({
      category,
      label: ERROR_CATEGORY_LABELS[category].en,
      count: counts.get(category) ?? 0,
    }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);

    return { byCategory, total: events.length, aiUsed };
  }

  // ─── NLP (Gemini) ───

  private async classifyWithAi(events: ErrorEvent[]): Promise<ErrorCategory[]> {
    // Bound the prompt size; classify the most recent slice with AI and fall
    // back to the heuristic for any overflow.
    const slice = events.slice(0, 80);
    const list = slice.map((e, i) => `${i}. ${e.text.replace(/\s+/g, " ").slice(0, 200)}`).join("\n");
    const cats = ERROR_CATEGORIES.join(", ");
    const prompt =
      `Classify each clinical error below into exactly one category from this set: ${cats}.\n` +
      `Categories: HISTORY=history taking, EXAMINATION=physical exam, INVESTIGATION=ordering/interpreting tests & imaging, ` +
      `DIAGNOSIS=diagnostic reasoning, MANAGEMENT=treatment/prescribing, COMMUNICATION=rapport/consent/explanation, ` +
      `SAFETY=critical safety actions & red flags, KNOWLEDGE=factual/theory gaps.\n\n` +
      `Errors:\n${list}\n\n` +
      `Respond as strict JSON: { "items": [{ "index": number, "category": string }] } covering every index.`;

    const res = await this.gemini.generateText(prompt, {
      system: "You are a medical education analyst. Output JSON only.",
      json: true,
      maxOutputTokens: 1500,
    });
    const parsed = JSON.parse(res.text) as { items?: { index: number; category: string }[] };
    const map = new Map<number, ErrorCategory>();
    for (const it of parsed.items ?? []) {
      const cat = (it.category ?? "").toUpperCase() as ErrorCategory;
      if (ERROR_CATEGORIES.includes(cat)) map.set(it.index, cat);
    }
    // Fill any gaps (overflow or unparsed) with the heuristic.
    return events.map((e, i) => map.get(i) ?? this.heuristic(e));
  }

  // ─── Heuristic fallback ───

  private heuristic(event: ErrorEvent): ErrorCategory {
    const text = event.text.toLowerCase();
    let best: ErrorCategory | null = null;
    let bestHits = 0;
    for (const category of ERROR_CATEGORIES) {
      const hits = KEYWORDS[category].reduce((n, kw) => (text.includes(kw) ? n + 1 : n), 0);
      if (hits > bestHits) {
        bestHits = hits;
        best = category;
      }
    }
    if (best) return best;
    if (event.hint) return event.hint;
    return "KNOWLEDGE";
  }
}
