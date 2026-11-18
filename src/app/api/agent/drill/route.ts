import { NextRequest, NextResponse } from "next/server";
import { synthesizeTargetedDrill } from "../../../../../lib/agents/drillSynthesizerAgent";
import { KnowledgeNode, TrapVulnerability } from "@/types/agent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { node, targetedTrap } = body as {
      node: KnowledgeNode;
      targetedTrap?: TrapVulnerability | string;
    };

    if (!node) {
      return NextResponse.json(
        { error: "Node is required to synthesize drill." },
        { status: 400 },
      );
    }

    const drill = await synthesizeTargetedDrill({
      node,
      targetedTrap,
    });

    return NextResponse.json(drill);
  } catch (err: unknown) {
    console.error("[/api/agent/drill] Error:", err);
    return NextResponse.json(
      { error: "Failed to synthesize practice drill." },
      { status: 500 },
    );
  }
}
