import { NextRequest, NextResponse } from "next/server";
import { evaluateStudentResponse } from "../../../../../lib/agents/profilerAgent";
import {
  updateGraphAfterEvaluation,
  computeOverallDomainMastery,
} from "../../../../../lib/agents/graphPlannerAgent";
import {
  KnowledgeNode,
  KnowledgeGraph,
  AnalogyBackground,
} from "@/types/agent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      node,
      questionText,
      studentAnswer,
      analogyBackground,
      currentGraph,
    } = body as {
      node: KnowledgeNode;
      questionText: string;
      studentAnswer: string;
      analogyBackground: AnalogyBackground;
      currentGraph?: KnowledgeGraph;
    };

    if (!node || !studentAnswer) {
      return NextResponse.json(
        { error: "Node and studentAnswer are required." },
        { status: 400 },
      );
    }

    // 1. Profiler Agent evaluates reasoning & diagnoses root cause
    const evaluation = await evaluateStudentResponse({
      node,
      questionText: questionText || node.description,
      studentAnswer,
      analogyBackground: analogyBackground || "Fullstack Web Developer",
    });

    // 2. Graph Planner Agent updates mastery DAG and checks unlock conditions
    let updatedGraph: KnowledgeGraph | undefined = undefined;
    let newlyUnlocked: string[] = [];
    let newDomainMastery: number | undefined = undefined;

    if (currentGraph) {
      const graphResult = updateGraphAfterEvaluation(
        currentGraph,
        node.id,
        evaluation.newMasteryScore,
        evaluation.bridgeNodeCreated,
      );
      updatedGraph = graphResult.updatedGraph;
      newlyUnlocked = graphResult.newlyUnlocked;
      newDomainMastery = computeOverallDomainMastery(updatedGraph);
    }

    return NextResponse.json({
      evaluation,
      updatedGraph,
      newlyUnlocked,
      newDomainMastery,
    });
  } catch (err: unknown) {
    console.error("[/api/agent/diagnose] Error:", err);
    return NextResponse.json(
      { error: "Diagnostic evaluation failed." },
      { status: 500 },
    );
  }
}
