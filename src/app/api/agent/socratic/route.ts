import { NextRequest, NextResponse } from "next/server";
import { generateSocraticTurn } from "../../../../../lib/agents/socraticCoachAgent";
import {
  KnowledgeNode,
  SocraticMessage,
  AnalogyBackground,
} from "@/types/agent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      node,
      questionContext,
      conversationHistory,
      learnerMessage,
      hintLevel,
      analogyBackground,
    } = body as {
      node: KnowledgeNode;
      questionContext: string;
      conversationHistory: SocraticMessage[];
      learnerMessage: string;
      hintLevel?: 1 | 2 | 3;
      analogyBackground: AnalogyBackground;
    };

    if (!node || !learnerMessage) {
      return NextResponse.json(
        { error: "Node and learnerMessage are required." },
        { status: 400 },
      );
    }

    const response = await generateSocraticTurn({
      node,
      questionContext: questionContext || node.description,
      conversationHistory: conversationHistory || [],
      learnerMessage,
      hintLevel: hintLevel || 1,
      analogyBackground: analogyBackground || "Fullstack Web Developer",
    });

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error("[/api/agent/socratic] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate Socratic guidance." },
      { status: 500 },
    );
  }
}
