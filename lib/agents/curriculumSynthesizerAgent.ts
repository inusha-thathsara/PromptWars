import { KnowledgeEdge, KnowledgeGraph, KnowledgeNode } from "@/types/agent";
import { generateWithFallback, getGeminiApiKey } from "../geminiEnv";
import { transcribeImageWithVision } from "../gemmaEnv";

interface RawSynthesizedNode {
  id: string;
  title: string;
  description: string;
  category: string;
  prerequisites: string[];
  activeTraps: string[];
  keyConcepts: string[];
}

interface RawCurriculumResponse {
  domainTitle?: string;
  summary?: string;
  nodes?: RawSynthesizedNode[];
}

function buildPositionedGraph(
  domainTitle: string,
  rawNodes: RawSynthesizedNode[],
): KnowledgeGraph {
  const validIds = new Set(rawNodes.map((n) => n.id));
  const depthMap = new Map<string, number>();

  // Topological depth calculation with cycle protection
  const computeDepth = (id: string, visiting = new Set<string>()): number => {
    if (depthMap.has(id)) return depthMap.get(id)!;
    if (visiting.has(id)) return 0;

    visiting.add(id);
    const node = rawNodes.find((n) => n.id === id);
    if (!node || !node.prerequisites || node.prerequisites.length === 0) {
      depthMap.set(id, 0);
      return 0;
    }

    const validPrereqs = node.prerequisites.filter(
      (p) => validIds.has(p) && p !== id,
    );
    if (validPrereqs.length === 0) {
      depthMap.set(id, 0);
      return 0;
    }

    const maxPrereqDepth = Math.max(
      ...validPrereqs.map((p) => computeDepth(p, new Set(visiting))),
    );
    const depth = Math.min(3, maxPrereqDepth + 1);
    depthMap.set(id, depth);
    return depth;
  };

  rawNodes.forEach((n) => computeDepth(n.id));

  // Group nodes by depth layer (0..3)
  const layers = new Map<number, RawSynthesizedNode[]>();
  rawNodes.forEach((n) => {
    const d = depthMap.get(n.id) ?? 0;
    const list = layers.get(d) || [];
    list.push(n);
    layers.set(d, list);
  });

  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];

  for (const [depth, layerNodes] of layers.entries()) {
    const count = layerNodes.length;
    layerNodes.forEach((raw, idx) => {
      const x = 100 + depth * 230;
      const y =
        count === 1
          ? 210
          : 110 + idx * Math.min(160, Math.floor(240 / Math.max(1, count - 1)));

      const cleanPrereqs = (raw.prerequisites || []).filter(
        (p) => validIds.has(p) && p !== raw.id,
      );

      nodes.push({
        id: raw.id,
        title: raw.title,
        description: raw.description,
        domain: domainTitle,
        category: raw.category || "Core Concept",
        status: depth === 0 ? "unlocked" : "locked",
        masteryScore: 0,
        prerequisites: cleanPrereqs,
        activeTraps:
          raw.activeTraps && raw.activeTraps.length > 0
            ? raw.activeTraps
            : ["Boundary Assumption Slip"],
        keyConcepts:
          raw.keyConcepts && raw.keyConcepts.length > 0
            ? raw.keyConcepts
            : [raw.title],
        position: { x, y },
        retentionDecay: 1.0,
      });

      cleanPrereqs.forEach((prereqId, pIdx) => {
        edges.push({
          id: `edge-${prereqId}-${raw.id}-${pIdx}`,
          source: prereqId,
          target: raw.id,
        });
      });
    });
  }

  return {
    domain: domainTitle,
    nodes,
    edges,
  };
}

export async function synthesizeKnowledgeGraphFromNotes({
  title,
  notesText,
  images,
}: {
  title?: string;
  notesText?: string;
  images?: string[];
}): Promise<{ graph: KnowledgeGraph; summary: string }> {
  const transcribedParts: string[] = [];

  if (notesText && notesText.trim()) {
    transcribedParts.push(notesText.trim());
  }

  if (images && images.length > 0) {
    const transcriptions = await Promise.all(
      images.map(async (img) => {
        try {
          return await transcribeImageWithVision(img);
        } catch (err) {
          console.warn(
            "[curriculumSynthesizer] Image transcription failed:",
            err,
          );
          return "";
        }
      }),
    );
    transcriptions.forEach((text) => {
      if (text && text.trim()) {
        transcribedParts.push(text.trim());
      }
    });
  }

  const combinedNotes = transcribedParts.join("\n\n---\n\n").trim();
  if (!combinedNotes) {
    throw new Error(
      "Could not extract readable study notes from the provided text or images.",
    );
  }

  const apiKey = getGeminiApiKey();
  const suffix = Date.now().toString().slice(-4);

  const systemInstruction = `You are Gemmate's Curriculum Synthesizer Agent.
Analyze the student's lecture notes or study material and decompose it into a prerequisite-ordered Knowledge Graph (DAG) of 5 to 7 concepts.

REQUIREMENTS:
1. Extract 5 to 7 distinct, progressive concepts from foundational to advanced.
2. Assign sequential IDs: "custom-${suffix}-01", "custom-${suffix}-02", etc.
3. Order prerequisites cleanly as a Directed Acyclic Graph (no cycles; every prerequisite ID must reference an earlier node ID in the list). At least 1 foundational node must have prerequisites: [].
4. For every node, identify 1-2 specific "activeTraps" (deceptive exam pitfalls or common misconceptions specific to that material) and 2-3 "keyConcepts".
5. ${title ? `Use "${title.trim()}" as domainTitle.` : `Infer a concise, crisp 2-4 word subject title for "domainTitle".`}

Return ONLY valid JSON matching:
{
  "domainTitle": string,
  "summary": "1-2 sentence overview of what this learning graph covers.",
  "nodes": [
    {
      "id": string,
      "title": string,
      "description": "1 concise sentence explaining the concept.",
      "category": "Short 1-2 word module category",
      "prerequisites": string[],
      "activeTraps": string[],
      "keyConcepts": string[]
    }
  ]
}`;

  if (apiKey) {
    try {
      const { result } = await generateWithFallback({
        apiKey,
        contents: `Study Material / Lecture Notes:\n\n${combinedNotes.slice(0, 18000)}`,
        systemInstruction,
        responseMimeType: "application/json",
      });

      const text = result.response.text();
      const parsed = JSON.parse(text) as RawCurriculumResponse;

      if (parsed.nodes && parsed.nodes.length >= 2) {
        const domainTitle =
          title?.trim() || parsed.domainTitle?.trim() || "Custom Study Notes";
        const graph = buildPositionedGraph(domainTitle, parsed.nodes);
        return {
          graph,
          summary:
            parsed.summary ||
            `Synthesized a ${graph.nodes.length}-node Knowledge DAG for ${domainTitle}.`,
        };
      }
    } catch (err) {
      console.warn(
        "[synthesizeKnowledgeGraphFromNotes] Gemini synthesis failed, using structured heuristic fallback:",
        err,
      );
    }
  }

  // Fallback heuristic when offline or model fails
  const fallbackTitle = title?.trim() || "Uploaded Study Module";
  const lines = combinedNotes
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .filter((l) => l.length > 6)
    .slice(0, 5);

  const fallbackRaw: RawSynthesizedNode[] = (
    lines.length >= 3
      ? lines
      : [
          "Foundational Definitions",
          "Core Mechanisms & Invariants",
          "Edge Cases & Boundary Conditions",
          "Applied Problem Solving",
        ]
  ).map((heading, idx) => ({
    id: `custom-${suffix}-0${idx + 1}`,
    title: heading.slice(0, 42),
    description: `Master key mechanisms and deceptive edge cases for ${heading.slice(0, 60)}.`,
    category: idx === 0 ? "Foundations" : "Core Topic",
    prerequisites: idx === 0 ? [] : [`custom-${suffix}-0${idx}`],
    activeTraps: ["Boundary Condition Oversight"],
    keyConcepts: [heading.slice(0, 28)],
  }));

  return {
    graph: buildPositionedGraph(fallbackTitle, fallbackRaw),
    summary: `Built a ${fallbackRaw.length}-node learning path for ${fallbackTitle}.`,
  };
}
