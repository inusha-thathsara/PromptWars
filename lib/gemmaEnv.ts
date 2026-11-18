import fs from "fs";
import path from "path";
import type { TriageDagNodeBlueprint } from "@/types/agent";
import { generateWithFallback } from "./geminiEnv";

/**
 * Gemmate AI Engine
 *
 * Provides unified inference for:
 * 1. Local Ollama: Open-weight Gemma (gemma3:1b, gemma4:e4b, gemma4:12b) + Moondream for visual question parsing
 * 2. Cloud Open-Weight Gemma API: (Groq gemma2-9b-it / OpenRouter google/gemma-2-9b-it)
 */

export interface TriageResult {
  domain_title: string;
  core_concepts: string[];
  the_trap: string[];
  attack_plan: string[];
  dag_nodes: TriageDagNodeBlueprint[];
  extracted_question?: string;
  model_used: string;
  inference_mode: "local-ollama" | "cloud-gemma";
  latency_ms: number;
}

export interface HintResult {
  hint: string;
  model_used: string;
  inference_mode: "local-ollama" | "cloud-gemma";
  latency_ms: number;
}

export interface PracticeResult {
  markdown: string;
  model_used: string;
  inference_mode: "local-ollama" | "cloud-gemma";
  latency_ms: number;
}

function getEnvVar(key: string, defaultValue = ""): string {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }
  } catch {}
  return process.env[key] || defaultValue;
}

export const OLLAMA_BASE_URL = getEnvVar(
  "OLLAMA_BASE_URL",
  "http://localhost:11434",
);
export const OLLAMA_MODEL = getEnvVar("OLLAMA_MODEL", "gemma3:1b");
export const OLLAMA_VISION_MODEL = getEnvVar(
  "OLLAMA_VISION_MODEL",
  "moondream:latest",
);
export const GROQ_API_KEY = getEnvVar("GROQ_API_KEY", "");
export const GEMMA_CLOUD_MODEL = getEnvVar("GEMMA_CLOUD_MODEL", "gemma2-9b-it");
export const GEMINI_API_KEY = getEnvVar("GEMINI_API_KEY", "");

function coerceToString(val: unknown): string {
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text.trim();
    if (typeof obj.step === "string") return obj.step.trim();
    if (typeof obj.description === "string" && typeof obj.title === "string") {
      return `${obj.title.trim()}: ${obj.description.trim()}`;
    }
    return Object.entries(obj)
      .map(([k, v]) => {
        const cleanKey = k.replace(/\*+$/g, "").trim();
        const cleanVal =
          typeof v === "string" ? v.trim() : v ? JSON.stringify(v) : "";
        return cleanVal ? `${cleanKey}: ${cleanVal}` : cleanKey;
      })
      .join(" ")
      .trim();
  }
  return "";
}

function coerceToStringArray(val: unknown, fallback: string[]): string[] {
  if (Array.isArray(val)) {
    const cleaned = val.map(coerceToString).filter((s) => s.length > 0);
    return cleaned.length > 0 ? cleaned : fallback;
  }
  if (typeof val === "string" && val.trim()) {
    return [val.trim()];
  }
  if (val && typeof val === "object") {
    const str = coerceToString(val);
    return str ? [str] : fallback;
  }
  return fallback;
}

/**
 * Check if local Ollama instance is alive and reachable.
 */
export async function isOllamaReachable(): Promise<boolean> {
  // On Vercel, localhost Ollama is never available; skip immediately to avoid delay
  if (process.env.VERCEL) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Transcribe image to text using Google Gemini Flash Vision / Groq Vision first,
 * with local Ollama vision model (moondream) as offline fallback.
 */
export async function transcribeImageWithVision(
  base64Image: string,
): Promise<string> {
  const mimeMatch = base64Image.match(
    /^data:(image\/[a-zA-Z0-9\+\-]+);base64,/,
  );
  const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const cleanBase64 = base64Image
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/[\r\n\s]+/g, "");

  const preferLocal = process.env.PREFER_LOCAL_OLLAMA === "true";

  // 1. Fast Cloud Vision: Google Gemini Flash (parallel wave racing)
  const geminiKey = GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (geminiKey && !preferLocal) {
    try {
      const prompt =
        "Carefully read and transcribe the entire text, mathematical expressions, formulas, and diagrams in this exam question image verbatim. Return only the extracted question text.";
      const imagePart = {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType,
        },
      };
      const { result } = await generateWithFallback({
        apiKey: geminiKey,
        contents: [prompt, imagePart],
      });
      const text = result.response.text().trim();
      if (text) return text;
    } catch (err) {
      console.warn("[Vision Transcription - Gemini] Error:", err);
    }
  }

  // 2. Cloud Fallback: Groq Vision
  const groqKey = GROQ_API_KEY || process.env.GROQ_API_KEY;
  if (groqKey && !preferLocal) {
    const candidateGroqModels = [
      "llama-3.2-11b-vision-preview",
      "llama-3.2-90b-vision-preview",
    ];
    for (const gm of candidateGroqModels) {
      try {
        const res = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${groqKey}`,
            },
            body: JSON.stringify({
              model: gm,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text: "Carefully read and transcribe the entire text, mathematical expressions, formulas, and diagrams in this exam question image verbatim.",
                    },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${mimeType};base64,${cleanBase64}`,
                      },
                    },
                  ],
                },
              ],
              temperature: 0.1,
            }),
          },
        );
        if (res.ok) {
          const data = await res.json();
          const content = (data.choices?.[0]?.message?.content || "").trim();
          if (content) return content;
        }
      } catch (err) {
        console.warn(`[Vision Transcription - Groq ${gm}] Error:`, err);
      }
    }
  }

  // 3. Offline Fallback: Local Ollama Vision (6s timeout to prevent UI hangs)
  const ollamaOnline = await isOllamaReachable();
  if (ollamaOnline) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_VISION_MODEL,
          prompt:
            "Carefully read and transcribe the entire text, mathematical expressions, formulas, and diagrams in this exam question image verbatim.",
          images: [cleanBase64],
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const text = (data.response || "").trim();
        if (text) return text;
      }
    } catch (err) {
      console.warn("[Vision Transcription - Ollama] Error:", err);
    }
  }

  return "";
}

/**
 * Clean and extract JSON from raw model text (handles ```json fences).
 */
function extractJson<T>(rawText: string): T {
  let cleaned = rawText.trim();
  // Strip markdown code block fences if present
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Find first { and last }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const repaired = cleaned.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    return JSON.parse(repaired) as T;
  }
}

/**
 * Execute prompt with local Ollama Gemma.
 */
async function queryOllamaGemma(
  prompt: string,
  systemPrompt?: string,
  modelName = OLLAMA_MODEL,
  formatJson = false,
): Promise<{ text: string; model: string }> {
  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\nUser: ${prompt}`
    : prompt;

  const bodyPayload: Record<string, unknown> = {
    model: modelName,
    prompt: fullPrompt,
    stream: false,
    options: {
      temperature: 0.2,
      top_p: 0.9,
    },
  };

  if (formatJson) {
    bodyPayload.format = "json";
  }

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Ollama generation failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return {
    text: data.response || "",
    model: modelName,
  };
}

/**
 * Cloud Open-Weight Gemma / Fast Gemini API
 */
async function queryCloudGemma(
  prompt: string,
  systemPrompt?: string,
  formatJson = false,
): Promise<{ text: string; model: string }> {
  const groqKey = GROQ_API_KEY || process.env.GROQ_API_KEY;
  const geminiKey = GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  // 1. Try Groq open-weight Gemma
  if (groqKey) {
    try {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: GEMMA_CLOUD_MODEL,
            messages,
            temperature: 0.2,
            response_format: formatJson ? { type: "json_object" } : undefined,
          }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        return {
          text: data.choices?.[0]?.message?.content || "",
          model: `groq-${GEMMA_CLOUD_MODEL}`,
        };
      }
    } catch (groqErr) {
      console.warn("[Cloud Groq] Error:", groqErr);
    }
  }

  // 2. Try Google AI Studio (Parallel wave racing via generateWithFallback)
  if (geminiKey) {
    const { result, modelUsed } = await generateWithFallback({
      apiKey: geminiKey,
      contents: prompt,
      systemInstruction: systemPrompt,
      responseMimeType: formatJson ? "application/json" : undefined,
    });
    const txt = result.response.text();
    if (txt) {
      return {
        text: txt,
        model: `gemini-cloud-${modelUsed}`,
      };
    }
  }

  throw new Error(
    "Local Ollama is unavailable on Vercel and neither GEMINI_API_KEY nor GROQ_API_KEY is configured in Vercel Project Environment Variables.",
  );
}

/**
 * Universal reasoning executor: uses fast Cloud Gemini/Gemma when API keys are configured
 * (unless PREFER_LOCAL_OLLAMA="true"), with local Ollama Gemma fallback.
 */
async function runGemma(
  prompt: string,
  systemPrompt: string,
  formatJson = false,
): Promise<{
  text: string;
  model: string;
  mode: "local-ollama" | "cloud-gemma";
  latencyMs: number;
}> {
  const startTime = Date.now();
  const hasCloudKey = Boolean(
    GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    GROQ_API_KEY ||
    process.env.GROQ_API_KEY,
  );
  const preferLocal = process.env.PREFER_LOCAL_OLLAMA === "true";

  if (hasCloudKey && !preferLocal) {
    try {
      const cloudRes = await queryCloudGemma(prompt, systemPrompt, formatJson);
      return {
        text: cloudRes.text,
        model: cloudRes.model,
        mode: "cloud-gemma",
        latencyMs: Date.now() - startTime,
      };
    } catch (cloudErr) {
      console.warn(
        "[Cloud Gemma] Cloud call failed, attempting local Ollama fallback...",
        cloudErr,
      );
    }
  }

  const ollamaAvailable = await isOllamaReachable();

  if (ollamaAvailable) {
    try {
      // Try configured model, fallback to gemma3:1b or gemma4:e4b
      const candidateModels = Array.from(
        new Set([OLLAMA_MODEL, "gemma3:1b", "gemma4:e4b", "gemma4:12b"]),
      );
      let lastErr: unknown;

      for (const m of candidateModels) {
        try {
          const res = await queryOllamaGemma(
            prompt,
            systemPrompt,
            m,
            formatJson,
          );
          return {
            text: res.text,
            model: res.model,
            mode: "local-ollama",
            latencyMs: Date.now() - startTime,
          };
        } catch (err) {
          lastErr = err;
          console.warn(
            `[Gemma Local] Failed with ${m}, trying next candidate...`,
          );
        }
      }
      throw lastErr;
    } catch (ollamaErr) {
      console.warn(
        "[Gemma Local] Ollama failed, attempting cloud fallback...",
        ollamaErr,
      );
    }
  }

  // Final fallback to Cloud if not already tried
  const cloudRes = await queryCloudGemma(prompt, systemPrompt, formatJson);
  return {
    text: cloudRes.text,
    model: cloudRes.model,
    mode: "cloud-gemma",
    latencyMs: Date.now() - startTime,
  };
}

const TRIAGE_SYSTEM_PROMPT = `You are Gemmate, an empathetic, top-tier study partner helping students conquer tricky exam questions.
Your goal is to triage the question to relieve their exam anxiety and map its prerequisite concepts into a Directed Acyclic Graph (DAG).
DO NOT solve the question directly or output the final answer.
Every item in core_concepts, the_trap, and attack_plan MUST be a plain text string (never nested JSON objects).
Instead, perform a structured triage:
1. Extracted Question: If images are attached, transcribe the exam question verbatim into extracted_question.
2. Domain Title: A concise 2-4 word academic subject/module name inferred from the question (e.g., "Operating Systems", "Calculus & Limits", "Signals & Fourier Series").
3. Core Concepts: 2 to 4 essential underlying theoretical principles (plain strings).
4. The Trap(s): The deceptive wording, subtle edge cases, unit traps, or misconceptions designed to trick students (plain strings).
5. Attack Plan: 3 to 4 sequential, actionable steps to solve the problem systematically (plain strings like "Step 1: ...").
6. DAG Nodes: Decompose the problem into 3 to 5 prerequisite-ordered concept nodes leading up to this exam challenge:
   - Start with 1-2 foundational prerequisite nodes (prerequisites: [], category: "Prerequisite").
   - Follow with 1-2 intermediate concept nodes (referencing earlier node IDs in prerequisites, category: "Core Concept").
   - End with 1 target node representing this specific exam problem's focus (referencing intermediate node IDs in prerequisites, category: "Exam Challenge").

You must respond ONLY with a valid JSON object matching this schema:
{
  "extracted_question": "Full text of the exam question",
  "domain_title": "Subject Name",
  "core_concepts": ["concept 1", "concept 2"],
  "the_trap": ["The primary trap or subtle trick", "Secondary trap if applicable"],
  "attack_plan": ["Step 1: First action...", "Step 2: Key formulation...", "Step 3: Verification..."],
  "dag_nodes": [
    {
      "id": "node-1",
      "title": "Foundational Prerequisite Title",
      "description": "1 concise sentence explaining why this prerequisite is needed.",
      "category": "Prerequisite",
      "prerequisites": [],
      "activeTraps": ["Specific foundational pitfall"],
      "keyConcepts": ["Key sub-concept"]
    },
    {
      "id": "node-2",
      "title": "Core Mechanism Title",
      "description": "1 concise sentence explaining the core mechanism.",
      "category": "Core Concept",
      "prerequisites": ["node-1"],
      "activeTraps": ["Specific conceptual trap"],
      "keyConcepts": ["Key principle"]
    },
    {
      "id": "node-3",
      "title": "Target Exam Problem Concept",
      "description": "1 concise sentence summarizing the triaged exam challenge.",
      "category": "Exam Challenge",
      "prerequisites": ["node-2"],
      "activeTraps": ["The primary trap from the question"],
      "keyConcepts": ["concept 1", "concept 2"]
    }
  ]
}`;

/**
 * Triage an exam question (text and/or images) using Gemma/Gemini.
 */
export async function triageExamQuestion(params: {
  images?: string[];
  questionText?: string;
}): Promise<TriageResult> {
  const startTime = Date.now();
  let combinedQuestionText = (params.questionText || "").trim();

  interface RawDagNode {
    id?: unknown;
    title?: unknown;
    description?: unknown;
    category?: unknown;
    prerequisites?: unknown;
    activeTraps?: unknown;
    keyConcepts?: unknown;
  }

  interface ParsedTriage {
    extracted_question?: unknown;
    domain_title?: unknown;
    core_concepts?: unknown;
    the_trap?: unknown;
    attack_plan?: unknown;
    dag_nodes?: RawDagNode[];
  }

  let parsed: ParsedTriage | null = null;
  let model = "";
  let mode: "local-ollama" | "cloud-gemma" = "cloud-gemma";
  let latencyMs = 0;

  const geminiKey = GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const preferLocal = process.env.PREFER_LOCAL_OLLAMA === "true";

  // Fast Path: Single-pass multimodal inference directly on images + question text
  if (params.images && params.images.length > 0 && geminiKey && !preferLocal) {
    try {
      const imageParts = params.images.map((img) => {
        const mimeMatch = img.match(/^data:(image\/[a-zA-Z0-9\+\-]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const cleanBase64 = img
          .replace(/^data:[^;]+;base64,/, "")
          .replace(/[\r\n\s]+/g, "");
        return {
          inlineData: {
            data: cleanBase64,
            mimeType,
          },
        };
      });

      const multimodalPrompt = combinedQuestionText
        ? `Student's question context:\n${combinedQuestionText}\n\nRead the attached image(s), put the full question text into "extracted_question", identify domain_title, core_concepts, the_trap, attack_plan (plain strings), and decompose prerequisite concepts into dag_nodes.`
        : `Read and transcribe the exam question visible in the attached image(s) into "extracted_question", identify domain_title, core_concepts, the_trap, attack_plan (plain strings), and decompose prerequisite concepts into dag_nodes.`;

      const { result: res, modelUsed } = await generateWithFallback({
        apiKey: geminiKey,
        contents: [multimodalPrompt, ...imageParts],
        systemInstruction: TRIAGE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
      });
      const txt = res.response.text();
      if (txt) {
        const candidate = extractJson<ParsedTriage>(txt);
        if (
          candidate &&
          (candidate.core_concepts ||
            candidate.the_trap ||
            candidate.attack_plan)
        ) {
          parsed = candidate;
          model = `gemini-cloud-${modelUsed}`;
          mode = "cloud-gemma";
          latencyMs = Date.now() - startTime;

          const visionExtracted = coerceToString(candidate.extracted_question);
          if (visionExtracted && !combinedQuestionText) {
            combinedQuestionText = visionExtracted;
          } else if (
            visionExtracted &&
            combinedQuestionText &&
            !combinedQuestionText.includes(visionExtracted.slice(0, 24))
          ) {
            combinedQuestionText = `${combinedQuestionText}\n\n${visionExtracted}`;
          }
        }
      }
    } catch (err) {
      console.warn(
        "[Triage Single-Pass] Error, falling back to OCR + LLM:",
        err,
      );
    }
  }

  // Standard / Offline Path: OCR image transcription (parallel) + runGemma
  if (!parsed) {
    if (params.images && params.images.length > 0) {
      const transcriptions: string[] = [];
      const transcriptionResults = await Promise.all(
        params.images.map((img) => transcribeImageWithVision(img)),
      );
      transcriptionResults.forEach((transcription, i) => {
        if (transcription) {
          transcriptions.push(
            `[Image ${i + 1} Question Content]:\n${transcription}`,
          );
        }
      });
      if (transcriptions.length > 0) {
        combinedQuestionText =
          `${combinedQuestionText}\n\n${transcriptions.join("\n\n")}`.trim();
      }
    }

    if (!combinedQuestionText) {
      const hasGemini = Boolean(GEMINI_API_KEY || process.env.GEMINI_API_KEY);
      if (!hasGemini) {
        throw new Error(
          "Groq has decommissioned all vision and Gemma models on their platform. To enable photo reading and cloud reasoning on Vercel, please add GEMINI_API_KEY (from https://aistudio.google.com) to your Environment Variables.",
        );
      }
      throw new Error(
        "Could not extract readable question text from the uploaded images. Please ensure the photos are clear and legible, or use the 'Type or Paste Question' tab.",
      );
    }

    const userPrompt = `Here is the exam question being studied:\n\n${combinedQuestionText}\n\nAnalyze this question, identify all tricks/traps, decompose its prerequisite concepts into dag_nodes, and output the required JSON format (all items in core_concepts, the_trap, and attack_plan must be plain strings).`;

    const llmRes = await runGemma(userPrompt, TRIAGE_SYSTEM_PROMPT, true);
    model = llmRes.model;
    mode = llmRes.mode;
    latencyMs = llmRes.latencyMs;

    try {
      parsed = extractJson<ParsedTriage>(llmRes.text);
    } catch {
      console.error(
        "[triageExamQuestion] JSON Parse Error on raw text:",
        llmRes.text,
      );
      parsed = {
        domain_title: "Problem Analysis",
        core_concepts: ["Problem Formulation", "System Analysis"],
        the_trap: [
          "Be cautious of boundary conditions and hidden question constraints.",
        ],
        attack_plan: [
          "1. Identify the given parameters and required output.",
          "2. Apply the fundamental equations matching the core concept.",
          "3. Check for edge case constraints before finalizing.",
        ],
      };
    }
  }

  const traps = coerceToStringArray(parsed.the_trap, [
    "Watch for tricky wording and hidden assumptions in the question statement.",
  ]);

  const coreConcepts = coerceToStringArray(parsed.core_concepts, [
    "Core Theory Analysis",
  ]);

  const attackPlan = coerceToStringArray(parsed.attack_plan, [
    "Formulate the given constraints.",
    "Calculate methodically.",
  ]);

  const domainTitle =
    coerceToString(parsed.domain_title) ||
    coreConcepts[0] ||
    "Triaged Study Module";

  const candidateNodes: TriageDagNodeBlueprint[] = [];
  if (Array.isArray(parsed.dag_nodes)) {
    parsed.dag_nodes.forEach((raw, idx) => {
      const cleanTitle = coerceToString(raw?.title);
      if (!cleanTitle) return;
      const id = coerceToString(raw.id) || `node-${idx + 1}`;
      const cleanDescription =
        coerceToString(raw.description) ||
        `Master ${cleanTitle} to solve the target exam problem.`;
      const cleanCategory =
        coerceToString(raw.category) ||
        (idx === 0 ? "Prerequisite" : "Core Concept");
      const cleanPrereqs = Array.isArray(raw.prerequisites)
        ? raw.prerequisites.map(coerceToString).filter((p) => p.length > 0)
        : [];
      candidateNodes.push({
        id,
        title: cleanTitle.slice(0, 64),
        description: cleanDescription,
        category: cleanCategory,
        prerequisites: cleanPrereqs,
        activeTraps: coerceToStringArray(raw.activeTraps, [traps[0]]),
        keyConcepts: coerceToStringArray(
          raw.keyConcepts,
          coreConcepts.slice(0, 2),
        ),
      });
    });
  }

  // Ensure DAG validity (known prerequisite IDs only, acyclic, >= 2 nodes)
  let dagNodes: TriageDagNodeBlueprint[];
  if (candidateNodes.length >= 2) {
    const seenIds = new Set<string>();
    dagNodes = candidateNodes.map((n, idx) => {
      const validPrereqs =
        idx === 0
          ? []
          : n.prerequisites.filter((p) => seenIds.has(p) && p !== n.id);
      seenIds.add(n.id);
      return {
        ...n,
        prerequisites:
          idx > 0 && validPrereqs.length === 0
            ? [candidateNodes[idx - 1].id]
            : validPrereqs,
      };
    });
  } else {
    const primaryConcept = coreConcepts[0] || "Foundational Principles";
    const secondaryConcept = coreConcepts[1] || `${primaryConcept} Mechanics`;
    const excerpt = (combinedQuestionText || domainTitle)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    dagNodes = [
      {
        id: "node-1",
        title: primaryConcept.slice(0, 48),
        description: `Foundational definitions and invariants behind ${primaryConcept}.`,
        category: "Prerequisite",
        prerequisites: [],
        activeTraps: [traps[1] || "Unchecked Baseline Assumptions"],
        keyConcepts: coreConcepts.slice(0, 2),
      },
      {
        id: "node-2",
        title: secondaryConcept.slice(0, 48),
        description: `Intermediate mechanism linking ${primaryConcept} to subtle constraints.`,
        category: "Core Concept",
        prerequisites: ["node-1"],
        activeTraps: [traps[0]],
        keyConcepts: coreConcepts,
      },
      {
        id: "node-3",
        title: `Exam Challenge: ${primaryConcept.slice(0, 32)}`,
        description:
          excerpt ||
          `Solve the triaged ${domainTitle} problem without falling for its trap.`,
        category: "Exam Challenge",
        prerequisites: ["node-2"],
        activeTraps: traps.slice(0, 2),
        keyConcepts: coreConcepts,
      },
    ];
  }

  return {
    domain_title: domainTitle,
    core_concepts: coreConcepts,
    the_trap: traps,
    attack_plan: attackPlan,
    dag_nodes: dagNodes,
    extracted_question: combinedQuestionText || domainTitle,
    model_used: model,
    inference_mode: mode,
    latency_ms: latencyMs,
  };
}

/**
 * Generate a progressive Socratic hint without spoiling the answer.
 */
export async function generateSocraticHint(params: {
  question: string;
  existingHints?: string[];
}): Promise<HintResult> {
  const hintCount = (params.existingHints || []).length;
  const previousHintsContext = params.existingHints?.length
    ? `Previous hints already given (do NOT repeat these):\n${params.existingHints.map((h, i) => `${i + 1}. ${h}`).join("\n")}`
    : "This is the first hint.";

  const systemPrompt = `You are Gemmate, an empathetic Socratic study coach. 
Give ONE progressive, thought-provoking hint that guides the student forward without giving away the solution or final formula.
Keep it conversational, encouraging, and under 3 sentences. Hint Level: ${hintCount + 1}/3.`;

  const userPrompt = `Question:\n${params.question}\n\n${previousHintsContext}\n\nGive the next Socratic hint.`;

  const { text, model, mode, latencyMs } = await runGemma(
    userPrompt,
    systemPrompt,
    false,
  );

  return {
    hint: text.trim(),
    model_used: model,
    inference_mode: mode,
    latency_ms: latencyMs,
  };
}

/**
 * Generate a practice question targeting the same core concepts and traps.
 */
export async function generatePracticeQuestion(params: {
  coreConcepts?: string[];
  theTrap?: string[] | string;
}): Promise<PracticeResult> {
  const conceptsStr =
    (params.coreConcepts || []).join(", ") || "General Technical Analysis";
  const trapStr = Array.isArray(params.theTrap)
    ? params.theTrap.join("; ")
    : params.theTrap || "Subtle edge case";

  const systemPrompt = `You are Gemmate. Generate a brand new, original exam-style practice problem that tests the same core concepts and features a similar hidden trap.
Format clearly in Markdown with:
- ## Practice Question
- Description and given parameters
- Do NOT include the solution.`;

  const userPrompt = `Concepts to test: ${conceptsStr}\nTrap style: ${trapStr}\n\nGenerate the new practice problem in Markdown format.`;

  const { text, model, mode, latencyMs } = await runGemma(
    userPrompt,
    systemPrompt,
    false,
  );

  return {
    markdown: text.trim(),
    model_used: model,
    inference_mode: mode,
    latency_ms: latencyMs,
  };
}
