import { NextRequest, NextResponse } from "next/server";
import { synthesizeKnowledgeGraphFromNotes } from "../../../../../lib/agents/curriculumSynthesizerAgent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 },
      );
    }

    const { title, notesText, images } = body as {
      title?: string;
      notesText?: string;
      images?: string[];
    };

    const hasNotes = Boolean(notesText && notesText.trim().length > 0);
    const hasImages = Boolean(images && images.length > 0);

    if (!hasNotes && !hasImages) {
      return NextResponse.json(
        { error: "Please provide study notes text, a file, or note photos." },
        { status: 400 },
      );
    }

    const result = await synthesizeKnowledgeGraphFromNotes({
      title,
      notesText,
      images,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[/api/agent/curriculum] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to synthesize knowledge graph from notes.",
      },
      { status: 500 },
    );
  }
}
