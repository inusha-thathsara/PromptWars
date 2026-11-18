import {
  DiagnosticEvaluation,
  KnowledgeNode,
  RootCauseCategory,
  AnalogyBackground,
} from "@/types/agent";
import { generateWithFallback, getGeminiApiKey } from "../geminiEnv";

interface ProfilerInput {
  node: KnowledgeNode;
  questionText: string;
  studentAnswer: string;
  analogyBackground: AnalogyBackground;
}

export async function evaluateStudentResponse({
  node,
  questionText,
  studentAnswer,
  analogyBackground,
}: ProfilerInput): Promise<DiagnosticEvaluation> {
  const apiKey = getGeminiApiKey();

  const systemPrompt = `You are the Cognitive Profiler & Diagnostic Agent in Gemmate, an adaptive learning system.
Your job is to analyze a student's answer to an exam question, diagnose cognitive misconceptions, and evaluate their conceptual mastery.

CRITICAL INSTRUCTION:
Do not merely say "Right" or "Wrong". You must diagnose the root cause into exactly one of:
1. "PrerequisiteGap": The student is missing essential foundational concepts needed to solve this.
2. "Misconception": The student has an erroneous mental model (e.g., confusing average-case with worst-case, or believing a cycle always guarantees deadlock in multi-instance resources).
3. "DeceptiveTrap": The student understands the theory but fell into a subtle boundary trap or trick constraint.
4. "ExecutionSlip": The student understood and approached it correctly, but made a small arithmetic or syntax typo.

The learner's background is: "${analogyBackground}". Frame the Socratic follow-up question using an intuitive analogy from this background if helpful.

Return ONLY a valid JSON object matching this schema:
{
  "isCorrectOrSubstantial": boolean,
  "masteryDelta": number, // integer between -20 and +20
  "rootCauseCategory": "PrerequisiteGap" | "Misconception" | "DeceptiveTrap" | "ExecutionSlip",
  "diagnosticNotes": "Concise 2-3 sentence analysis of why the student reasoned this way and what cognitive blind spot was triggered.",
  "identifiedTrap": "Short name of the trap tripped (or 'None' if fully correct)",
  "socraticFollowUpQuestion": "A targeted Socratic question that prompts the student to realize and self-correct their error without spoonfeeding.",
  "needsBridgeNode": boolean, // true ONLY if rootCauseCategory is PrerequisiteGap and foundational theory is missing
  "bridgeNodeTitle": string | null, // e.g. "Foundational: Mutual Exclusion Invariants"
  "bridgeNodeDescription": string | null
}`;

  const userContent = `Topic/Node: ${node.title} (${node.category})
Key Concepts: ${node.keyConcepts.join(", ")}
Known Node Traps: ${node.activeTraps.join(", ")}

Question:
${questionText}

Student's Submitted Answer / Reasoning:
${studentAnswer}

Evaluate the student's submission now.`;

  if (apiKey) {
    try {
      const { result } = await generateWithFallback({
        apiKey,
        contents: userContent,
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      });

      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);

      const newScore = Math.max(
        0,
        Math.min(100, node.masteryScore + (parsed.masteryDelta || 0)),
      );

      let bridgeNode: KnowledgeNode | undefined = undefined;
      if (parsed.needsBridgeNode && parsed.bridgeNodeTitle) {
        bridgeNode = {
          id: `bridge-${Date.now()}`,
          title: parsed.bridgeNodeTitle,
          description:
            parsed.bridgeNodeDescription ||
            "Remedial bridge module created automatically by the Cognitive Profiler.",
          domain: node.domain,
          category: "Remedial Bridge",
          status: "unlocked",
          masteryScore: 25,
          prerequisites: node.prerequisites,
          activeTraps: [parsed.identifiedTrap || "Foundational Gap"],
          keyConcepts: ["Prerequisite Refresher"],
          position: {
            x: Math.max(80, node.position.x - 120),
            y: node.position.y + 70,
          },
          isBridgeNode: true,
        };
      }

      return {
        isCorrectOrSubstantial: Boolean(parsed.isCorrectOrSubstantial),
        masteryDelta: Number(parsed.masteryDelta) || 0,
        newMasteryScore: newScore,
        rootCauseCategory:
          (parsed.rootCauseCategory as RootCauseCategory) || "Misconception",
        diagnosticNotes:
          parsed.diagnosticNotes ||
          "Student demonstrated partial understanding with room for deeper structural clarity.",
        identifiedTrap: parsed.identifiedTrap || undefined,
        socraticFollowUpQuestion:
          parsed.socraticFollowUpQuestion ||
          "What invariant changes when we test this with the edge boundary condition?",
        unlockedNodeIds: newScore >= 75 ? [node.id] : [],
        bridgeNodeCreated: bridgeNode,
      };
    } catch (err) {
      console.warn(
        "[evaluateStudentResponse] Gemini evaluation failed, falling back to local heuristic:",
        err,
      );
    }
  }

  // Graceful fallback heuristic
  const isCorrect =
    studentAnswer.length > 50 &&
    !studentAnswer.toLowerCase().includes("deadlock is guaranteed");
  const delta = isCorrect ? 12 : -10;
  const newScore = Math.max(0, Math.min(100, node.masteryScore + delta));

  return {
    isCorrectOrSubstantial: isCorrect,
    masteryDelta: delta,
    newMasteryScore: newScore,
    rootCauseCategory: isCorrect ? "ExecutionSlip" : "Misconception",
    diagnosticNotes: isCorrect
      ? "Good structural approach. The reasoning aligns with the core invariants of this topic."
      : "The student fell into the common assumption trap without testing whether cycle invariants hold across all resource instances.",
    identifiedTrap: node.activeTraps[0] || "Boundary Trap",
    socraticFollowUpQuestion:
      "If one of the processes finishes and releases its allocated instance, what happens to the remaining request chain?",
    unlockedNodeIds: newScore >= 75 ? [node.id] : [],
  };
}
