import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../config/configuration";

/**
 * Server-side Google Gemini client.
 *
 * Ported from the "qumalak ashu" backend: same model-fallback chain plus
 * transient-retry behaviour, against the public Generative Language REST API.
 * Uses the native `fetch` (Node 18+) so no SDK dependency is required.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
const REQUEST_TIMEOUT_MS = 25_000;
const RETRY_BACKOFF_MS = 700;

const SAFETY_SETTINGS = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" }));

export interface GeminiMessage {
  /** Gemini uses "model" for assistant turns. */
  role: "user" | "model";
  text: string;
}

export interface GenerateOptions {
  /** System instruction that steers the whole conversation. */
  system?: string;
  /** Force `application/json` output (for structured responses). */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GenerateResult {
  text: string;
  /** The model that actually produced the response (after any fallback). */
  model: string;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey: string;
  private readonly primaryModel: string;

  constructor(config: ConfigService<AppConfig, true>) {
    const gemini = config.get("gemini", { infer: true });
    this.apiKey = gemini.apiKey;
    this.primaryModel = gemini.model;
  }

  /** Single-prompt convenience wrapper. */
  generateText(prompt: string, opts: GenerateOptions = {}): Promise<GenerateResult> {
    return this.generate([{ role: "user", text: prompt }], opts);
  }

  /**
   * Streaming generation via `streamGenerateContent?alt=sse`.
   *
   * Yields text deltas; the generator's *return value* is the model that served
   * the response. Model fallback happens only before the first byte — once a
   * stream is committed we stay on that model.
   */
  async *generateStream(
    messages: GeminiMessage[],
    opts: GenerateOptions = {},
  ): AsyncGenerator<string, { model: string }, unknown> {
    const key = this.apiKey.trim();
    if (!key) {
      throw new ServiceUnavailableException("Gemini API key is not configured");
    }

    const body = this.buildBody(messages, opts);
    let lastError: Error | null = null;

    for (const model of this.modelChain()) {
      const url = `${ENDPOINT}/${model}:streamGenerateContent?alt=sse&key=${key}`;
      let resp: Response;
      try {
        resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        throw new ServiceUnavailableException(
          `Gemini network error: ${(err as Error).message}`,
        );
      }

      if (!resp.ok || !resp.body) {
        const raw = await resp.text().catch(() => "");
        lastError = new Error(`HTTP ${resp.status}: ${raw.slice(0, 300)}`);
        if (!this.isTransient(resp.status, raw)) {
          this.logger.error(`Gemini stream error (${model}): ${lastError.message}`);
          throw new ServiceUnavailableException("AI service request failed");
        }
        continue; // transient — try the next model
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const delta = this.extractDelta(JSON.parse(payload) as GeminiResponse);
              if (delta) yield delta;
            } catch {
              // Partial JSON split across chunks — ignore; next chunk completes it.
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      return { model };
    }

    this.logger.error(`Gemini stream exhausted all models: ${lastError?.message}`);
    throw new ServiceUnavailableException("AI service is currently unavailable");
  }

  /** Multi-turn generation with model fallback and transient-retry. */
  async generate(messages: GeminiMessage[], opts: GenerateOptions = {}): Promise<GenerateResult> {
    const key = this.apiKey.trim();
    if (!key) {
      throw new ServiceUnavailableException("Gemini API key is not configured");
    }

    const body = this.buildBody(messages, opts);
    let lastError: Error | null = null;

    for (const model of this.modelChain()) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const url = `${ENDPOINT}/${model}:generateContent?key=${key}`;
        let resp: Response;
        try {
          resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
        } catch (err) {
          // Network/timeout failures won't be fixed by trying another model.
          throw new ServiceUnavailableException(
            `Gemini network error: ${(err as Error).message}`,
          );
        }

        const raw = await resp.text();
        if (resp.ok) {
          return { text: this.extractText(JSON.parse(raw) as GeminiResponse), model };
        }

        lastError = new Error(`HTTP ${resp.status}: ${raw.slice(0, 300)}`);
        if (!this.isTransient(resp.status, raw)) {
          this.logger.error(`Gemini error (${model}): ${lastError.message}`);
          throw new ServiceUnavailableException("AI service request failed");
        }
        // Transient: brief backoff and retry the same model once, else fall
        // through to the next model in the chain.
        if (attempt === 0) {
          await this.delay(RETRY_BACKOFF_MS);
        }
      }
    }

    this.logger.error(`Gemini exhausted all models: ${lastError?.message}`);
    throw new ServiceUnavailableException("AI service is currently unavailable");
  }

  /** Primary model first, then distinct fallbacks. */
  private modelChain(): string[] {
    const chain = [this.primaryModel];
    for (const m of FALLBACK_MODELS) {
      if (m !== this.primaryModel) chain.push(m);
    }
    return chain;
  }

  private isTransient(status: number, body: string): boolean {
    if (status === 429 || status === 503) return true;
    const b = body.toLowerCase();
    return ["unavailable", "overload", "high demand"].some((s) => b.includes(s));
  }

  private buildBody(messages: GeminiMessage[], opts: GenerateOptions): Record<string, unknown> {
    const generationConfig: Record<string, unknown> = {
      temperature: opts.temperature ?? 0.7,
      topP: 0.95,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      // Flash is a thinking model; disable thinking so output isn't truncated
      // by hidden reasoning tokens.
      thinkingConfig: { thinkingBudget: 0 },
    };
    if (opts.json) {
      generationConfig.responseMimeType = "application/json";
    }

    const body: Record<string, unknown> = {
      contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig,
      safetySettings: SAFETY_SETTINGS,
    };
    if (opts.system) {
      body.systemInstruction = { parts: [{ text: opts.system }] };
    }
    return body;
  }

  private extractText(data: GeminiResponse): string {
    const candidates = data.candidates ?? [];
    if (candidates.length === 0) {
      throw new ServiceUnavailableException("AI returned no candidates (blocked or empty)");
    }
    const parts = candidates[0].content?.parts ?? [];
    const text = parts
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) {
      throw new ServiceUnavailableException("AI returned an empty response");
    }
    return text;
  }

  /** Non-throwing per-chunk text extraction for streaming. */
  private extractDelta(data: GeminiResponse): string {
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => p.text ?? "").join("");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
