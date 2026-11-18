import { DrillProblem, KnowledgeNode, TrapVulnerability } from "@/types/agent";
import { generateWithFallback, getGeminiApiKey } from "../geminiEnv";

interface DrillSynthesizerInput {
  node: KnowledgeNode;
  targetedTrap?: TrapVulnerability | string;
}

export async function synthesizeTargetedDrill({
  node,
  targetedTrap,
}: DrillSynthesizerInput): Promise<DrillProblem> {
  const apiKey = getGeminiApiKey();
  const trapName =
    typeof targetedTrap === "string"
      ? targetedTrap
      : targetedTrap?.name || node.activeTraps[0] || "Boundary Invariant Slip";

  const systemInstruction = `You are Gemmate's Autonomous Drill Synthesizer Agent.
Your job is to generate a deceptive, high-yield technical exam problem specifically designed to test whether a student can spot and neutralize an exam trap.

TOPIC: "${node.title}" (${node.category})
TARGET TRAP TO TEST: "${trapName}"
KEY CONCEPTS: ${node.keyConcepts.join(", ")}

REQUIREMENTS:
1. The question must look plausible on the surface, but contain a subtle trap or deceptive edge case that naive students always trip over.
2. Formulate clear mathematical or algorithmic rigor using Markdown and LaTeX ($...$ / $$...$$).
3. Provide:
   - "title": Short punchy title (e.g. "The Multi-Instance Deadlock Illusion")
   - "questionText": The full question prompt with precise numbers, constraints, and setup.
   - "theTrap": Exact explanation of the cognitive trap and why standard intuitions fail.
   - "attackPlan": 3-4 sequential action steps to systematically solve it without falling for the trap.
   - "hintL1": Intuition nudge.
   - "hintL2": Constraint/boundary spotlight.
   - "hintL3": Concrete structural execution step.
   - "gradingRubric": 3 bullet criteria for full mastery.

Return ONLY valid JSON matching this schema:
{
  "title": string,
  "questionText": string,
  "theTrap": string,
  "attackPlan": string[],
  "hintL1": string,
  "hintL2": string,
  "hintL3": string,
  "gradingRubric": string[]
}`;

  const userContent = `Generate a fresh, challenging exam trap problem targeting "${trapName}" within "${node.title}".`;

  if (apiKey) {
    try {
      const { result } = await generateWithFallback({
        apiKey,
        contents: userContent,
        systemInstruction,
        responseMimeType: "application/json",
      });

      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);

      return {
        id: `drill-${Date.now()}`,
        nodeId: node.id,
        nodeTitle: node.title,
        title: parsed.title || `${node.title}: Advanced Trap`,
        questionText:
          parsed.questionText ||
          "Analyze the following system boundary condition...",
        targetTraps: [trapName],
        coreConcepts: node.keyConcepts,
        theTrap:
          parsed.theTrap ||
          "Failing to account for multi-instance resource availability.",
        attackPlan: parsed.attackPlan || [
          "Identify all allocated vs requested resources.",
          "Check if any process can complete immediately.",
          "Trace the resulting available resource vector.",
        ],
        hintL1:
          parsed.hintL1 ||
          "What is the key invariant that distinguishes single vs multi-instance resources?",
        hintL2:
          parsed.hintL2 ||
          "Look at the available vector after any one process releases its hold.",
        hintL3:
          parsed.hintL3 ||
          "Construct the reduction sequence: does there exist an execution order where all finish?",
        gradingRubric: parsed.gradingRubric || [
          "Correctly identifies why a simple cycle is not sufficient for failure.",
          "Demonstrates valid reduction sequence.",
          "States final answer with mathematical justification.",
        ],
      };
    } catch (err) {
      console.warn(
        "[synthesizeTargetedDrill] Gemini synthesis failed, falling back to curated drill:",
        err,
      );
    }
  }

  // Curated fallback problem
  return {
    id: `drill-fallback-${Date.now()}`,
    nodeId: node.id,
    nodeTitle: node.title,
    title: `${node.title}: Boundary Invariant Trap`,
    questionText: `Consider a system with $N$ concurrent tasks sharing $M$ resources where each task requires at most 2 instances of a resource type $R$. If there are 3 tasks ($T_1, T_2, T_3$) and 4 total instances of $R$, and each task currently holds 1 instance while requesting another, prove whether this system can deadlock. What is the minimum number of total instances required to guarantee deadlock freedom?`,
    targetTraps: [trapName],
    coreConcepts: node.keyConcepts,
    theTrap:
      "Assuming that equal resource requests guarantee simultaneous contention and deadlock without calculating the Pigeonhole allocation threshold.",
    attackPlan: [
      "Calculate total maximum claim: $\\sum Max_i = 3 \\times 2 = 6$.",
      "Apply the deadlock-free invariant condition: Total Resources $R \\ge \\sum (Max_i - 1) + 1$.",
      "Compare the current available instances with pending requests.",
      "Conclude whether a safe sequence exists.",
    ],
    hintL1: "Think about the Pigeonhole Principle applied to resource claims.",
    hintL2:
      "With 4 instances and 3 held, how many instances remain free in the pool right now?",
    hintL3:
      "Give the 1 free instance to any task; that task finishes and returns 2 instances. Can the rest finish?",
    gradingRubric: [
      "Identifies that 1 free instance is enough to satisfy one task's maximum claim.",
      "Demonstrates safe sequence $(T_1 \\to T_2 \\to T_3)$.",
      "Proves that 4 instances guarantee deadlock freedom.",
    ],
  };
}
