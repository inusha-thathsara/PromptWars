import fs from "fs";
import path from "path";
import {
  GoogleGenerativeAI,
  GenerateContentResult,
  GenerationConfig,
  Part,
} from "@google/generative-ai";

/**
 * Returns the Gemini API key.
 * In development, reads directly from `.env.local` first so changes take effect
 * immediately without having to restart the Next.js dev server.
 * In production, falls back to `process.env.GEMINI_API_KEY`.
 */
export function getGeminiApiKey(): string | undefined {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const match = content.match(/^GEMINI_API_KEY=(.*)$/m);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }
  } catch (err) {
    console.warn("[getGeminiApiKey] Failed to read .env.local directly:", err);
  }
  return process.env.GEMINI_API_KEY;
}

/**
 * Returns the configured Gemini model (default: "gemini-3.1-flash-lite-preview").
 */
export function getGeminiModel(): string {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const match = content.match(/^GEMINI_MODEL=(.*)$/m);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }
  } catch {}
  return process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
}

export interface GenerateOptions {
  apiKey: string;
  contents: string | Array<string | Part>;
  systemInstruction?: string;
  responseMimeType?: string;
  preferredModel?: string;
}

export interface GenerateResult {
  result: GenerateContentResult;
  modelUsed: string;
}

function modelSupportsThinkingConfig(modelName: string): boolean {
  return (
    modelName === "gemini-3.1-flash-lite-preview" ||
    modelName === "gemini-3-flash-preview" ||
    modelName === "gemini-3.6-flash" ||
    modelName === "gemini-3.5-flash"
  );
}

/**
 * Calls Gemini with parallel wave racing (Promise.any) and per-model thinkingConfig.
 * Races top low-latency models concurrently and cancels slower in-flight requests
 * as soon as the first valid non-empty response arrives.
 */
export async function generateWithFallback({
  apiKey,
  contents,
  systemInstruction,
  responseMimeType,
  preferredModel,
}: GenerateOptions): Promise<GenerateResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const primary = preferredModel || getGeminiModel();

  const callSingleModel = async (
    modelName: string,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<GenerateResult> => {
    const generationConfig = {
      temperature: 0.2,
      ...(responseMimeType ? { responseMimeType } : {}),
      ...(modelSupportsThinkingConfig(modelName)
        ? { thinkingConfig: { thinkingBudget: 0 } }
        : {}),
    } as GenerationConfig;

    for (let attempt = 1; attempt <= 2; attempt++) {
      if (signal.aborted) {
        throw new Error(`Request aborted before calling ${modelName}`);
      }
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction,
          generationConfig,
        });

        const result = await model.generateContent(contents, {
          timeout: timeoutMs,
          signal,
        });
        const txt = result.response.text().trim();
        if (!txt) {
          throw new Error(`Empty response from ${modelName}`);
        }
        return { result, modelUsed: modelName };
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (attempt === 1 && status === 503 && !signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        if (!signal.aborted) {
          console.warn(
            `[Gemini] ${modelName} failed${status ? ` (${status})` : ""}`,
          );
        }
        throw err;
      }
    }

    throw new Error(`Model ${modelName} exhausted attempts`);
  };

  const raceModelWave = async (
    models: string[],
    timeoutMs: number,
  ): Promise<GenerateResult> => {
    const waveController = new AbortController();
    try {
      return await Promise.any(
        models.map((m) => callSingleModel(m, timeoutMs, waveController.signal)),
      );
    } finally {
      waveController.abort();
    }
  };

  const wave1 = Array.from(
    new Set([
      primary,
      "gemini-3.1-flash-lite-preview",
      "gemini-3-flash-preview",
      "gemini-3.5-flash-lite",
    ]),
  );

  try {
    return await raceModelWave(wave1, 10000);
  } catch (wave1Err) {
    console.warn("[Gemini] Wave 1 failed, trying Wave 2...", wave1Err);
  }

  const wave2 = [
    "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
  ];

  return await raceModelWave(wave2, 12000);
}
