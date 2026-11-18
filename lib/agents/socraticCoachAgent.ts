import {
  KnowledgeNode,
  SocraticMessage,
  AnalogyBackground,
} from "@/types/agent";
import { generateWithFallback, getGeminiApiKey } from "../geminiEnv";

interface SocraticTurnInput {
  node: KnowledgeNode;
  questionContext: string;
  conversationHistory: SocraticMessage[];
  learnerMessage: string;
  hintLevel?: 1 | 2 | 3;
  analogyBackground: AnalogyBackground;
}

export interface SocraticTurnResponse {
  reply: string;
  hintLevel: 1 | 2 | 3;
  domainAnalogyUsed?: string;
  pedagogicalObjective: string;
  suggestedStudentPrompt?: string;
}

export async function generateSocraticTurn({
  node,
  questionContext,
  conversationHistory,
  learnerMessage,
  hintLevel = 1,
  analogyBackground,
}: SocraticTurnInput): Promise<SocraticTurnResponse> {
  const apiKey = getGeminiApiKey();

  const historyFormatted = conversationHistory
    .slice(-6)
    .map(
      (m) =>
        `${m.role === "user" ? "Student" : "Socratic Coach"}: ${m.content}`,
    )
    .join("\n");

  const systemInstruction = `You are Gemmate's Autonomous Socratic Coach.
Your goal is to guide the student toward understanding without ever giving away the direct numeric answer, code solution, or bottom line.

PEDAGOGICAL RULES:
1. Socratic Questioning: Ask guiding questions that challenge false assumptions and encourage active recall.
2. Hint Scaffolding Level = ${hintLevel}:
   - Level 1 (Nudge): High-level intuition. Ask them about the invariant or underlying definition.
   - Level 2 (Constraint Spotlight): Point their attention to the deceptive boundary condition or the specific variable in the question.
   - Level 3 (Attack Step): Outline the concrete algebraic or algorithmic next step, but leave the execution to the student.
3. Domain Analogy Engine:
   - The student has a background in: "${analogyBackground}".
   - Where helpful, weave in an analogy that bridges the technical abstraction to concepts from ${analogyBackground}. Keep it natural and illuminating.
4. Tone: Encouraging, rigorous, mathematically precise, empathetic. Use Markdown and LaTeX ($...$) for formulas where helpful.

Return ONLY a valid JSON object matching:
{
  "reply": "Your Socratic dialogue response to the student.",
  "domainAnalogyUsed": "Brief description of the domain analogy you integrated (or null if not needed this turn).",
  "pedagogicalObjective": "What mental model shift this response aims to create.",
  "suggestedStudentPrompt": "A quick 1-sentence thought prompt the student could think about or reply with."
}`;

  const userContent = `Topic: ${node.title} (${node.category})
Key Concepts: ${node.keyConcepts.join(", ")}
Active Traps in this topic: ${node.activeTraps.join(", ")}

Question Under Discussion:
${questionContext}

Recent Dialogue:
${historyFormatted}

Student's Latest Input:
"${learnerMessage}"

Generate your Socratic response at Hint Level ${hintLevel}.`;

  if (apiKey) {
    try {
      const { result } = await generateWithFallback({
        apiKey,
        contents: userContent,
        systemInstruction,
        responseMimeType: "application/json",
      });

      const responseText = result.response.text();
      let parsed: {
        reply?: string;
        domainAnalogyUsed?: string;
        pedagogicalObjective?: string;
        suggestedStudentPrompt?: string;
      } = {};
      try {
        parsed = JSON.parse(responseText);
      } catch {
        const repaired = responseText.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
        parsed = JSON.parse(repaired);
      }

      return {
        reply:
          parsed.reply ||
          "Let's examine the invariants. What condition must hold here?",
        hintLevel,
        domainAnalogyUsed: parsed.domainAnalogyUsed || undefined,
        pedagogicalObjective:
          parsed.pedagogicalObjective || "Guide active recall",
        suggestedStudentPrompt: parsed.suggestedStudentPrompt || undefined,
      };
    } catch (err) {
      console.warn(
        "[generateSocraticTurn] Gemini call failed, falling back to local coach heuristic:",
        err,
      );
    }
  }

  // Fallback heuristic if API is offline
  const fallbackReplies: Record<1 | 2 | 3, string> = {
    1: `Think about the core invariant in **${node.title}**. If we consider the worst-case boundary, what assumption might break down?`,
    2: `Look closely at the constraints in the problem. Notice how the resource instances or array bounds are distributed. Why does the naive assumption fail there?`,
    3: `Let's write down the exact state transition: what happens when step $k$ completes? Trace the allocation graph or loop condition directly.`,
  };

  return {
    reply: fallbackReplies[hintLevel],
    hintLevel,
    pedagogicalObjective: "Reinforce boundary testing",
    suggestedStudentPrompt:
      "What happens if we test the smallest possible non-trivial case?",
  };
}
