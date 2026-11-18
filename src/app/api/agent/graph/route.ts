import { NextRequest, NextResponse } from "next/server";
import { DomainType, KnowledgeGraph } from "@/types/agent";

// Local in-memory graph cache per domain
const graphStore: Record<string, KnowledgeGraph> = {};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = (searchParams.get("domain") as DomainType) || "";

  if (domain && graphStore[domain]) {
    return NextResponse.json(graphStore[domain]);
  }
  return NextResponse.json({ domain, nodes: [], edges: [] });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { domain, updatedGraph } = body;
    if (domain && updatedGraph) {
      graphStore[domain] = updatedGraph;
      return NextResponse.json({ success: true, graph: updatedGraph });
    }
    return NextResponse.json(
      { error: "Missing domain or updatedGraph" },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to persist graph" },
      { status: 500 },
    );
  }
}
