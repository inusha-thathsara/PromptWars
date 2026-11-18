import {
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeEdge,
  TriageDagNodeBlueprint,
} from "@/types/agent";

export function updateGraphAfterEvaluation(
  graph: KnowledgeGraph,
  updatedNodeId: string,
  newMasteryScore: number,
  bridgeNode?: KnowledgeNode,
): { updatedGraph: KnowledgeGraph; newlyUnlocked: string[] } {
  const nodes = [...graph.nodes];
  const edges = [...graph.edges];
  const newlyUnlocked: string[] = [];

  // 1. Update the evaluated node
  const targetIndex = nodes.findIndex((n) => n.id === updatedNodeId);
  if (targetIndex !== -1) {
    const currentNode = nodes[targetIndex];
    let newStatus = currentNode.status;

    if (newMasteryScore >= 80) {
      newStatus = "mastered";
    } else if (newMasteryScore >= 50) {
      newStatus = "in_progress";
    } else {
      newStatus = "needs_review";
    }

    const masteryImproved = newMasteryScore >= currentNode.masteryScore;
    const nextStability = masteryImproved
      ? Math.min(168, Math.round((currentNode.stabilityHours || 24) * 1.5))
      : 12;

    nodes[targetIndex] = {
      ...currentNode,
      masteryScore: newMasteryScore,
      status: newStatus,
      lastPracticed: "Just now",
      lastPracticedIso: new Date().toISOString(),
      stabilityHours: nextStability,
      retentionDecay: 1.0,
    };
  }

  // 2. Check if any successor nodes can be unlocked
  const masteredIds = new Set(
    nodes
      .filter((n) => n.status === "mastered" || n.masteryScore >= 70)
      .map((n) => n.id),
  );

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.status === "locked") {
      // Check if all prerequisites are fulfilled
      const allPrereqsMet = node.prerequisites.every((prereqId) =>
        masteredIds.has(prereqId),
      );
      if (allPrereqsMet && node.prerequisites.length > 0) {
        nodes[i] = { ...node, status: "unlocked" };
        newlyUnlocked.push(node.id);
      }
    }
  }

  // 3. Inject Bridge Node if present
  if (bridgeNode) {
    const existingIndex = nodes.findIndex((n) => n.title === bridgeNode.title);
    if (existingIndex === -1) {
      nodes.push(bridgeNode);

      // Create edge from bridgeNode to the target node
      const newEdge: KnowledgeEdge = {
        id: `edge-bridge-${Date.now()}`,
        source: bridgeNode.id,
        target: updatedNodeId,
      };
      edges.push(newEdge);
    }
  }

  return {
    updatedGraph: {
      ...graph,
      nodes,
      edges,
    },
    newlyUnlocked,
  };
}

export function computeOverallDomainMastery(graph: KnowledgeGraph): number {
  if (!graph.nodes.length) return 0;
  const total = graph.nodes.reduce((acc, n) => acc + n.masteryScore, 0);
  return Math.round(total / graph.nodes.length);
}

/**
 * Applies Ebbinghaus forgetting-curve decay: R = exp(-dt / S).
 * Transitions mastered nodes below 0.65 retention to "needs_review".
 */
export function applySpacedRepetitionDecay(
  graph: KnowledgeGraph,
): KnowledgeGraph {
  const now = Date.now();
  const decayedNodes = graph.nodes.map((node) => {
    if (!node.lastPracticedIso || node.masteryScore <= 0) {
      return node;
    }

    const parsedTime = Date.parse(node.lastPracticedIso);
    if (Number.isNaN(parsedTime)) {
      return node;
    }

    const deltaHours = Math.max(0, (now - parsedTime) / 3600000);
    const stability =
      node.stabilityHours || Math.max(12, (node.masteryScore / 100) * 72);
    const rawR = Math.exp(-deltaHours / stability);
    const retention = Number(Math.max(0.1, Math.min(1.0, rawR)).toFixed(2));

    let nextStatus = node.status;
    if (retention < 0.65 && node.status === "mastered") {
      nextStatus = "needs_review";
    }

    return {
      ...node,
      retentionDecay: retention,
      status: nextStatus,
    };
  });

  return {
    ...graph,
    nodes: decayedNodes,
  };
}

export function countRetentionAlerts(graph: KnowledgeGraph): number {
  return graph.nodes.filter(
    (n) =>
      n.status === "needs_review" ||
      (typeof n.retentionDecay === "number" &&
        n.retentionDecay < 0.65 &&
        n.masteryScore > 0),
  ).length;
}

/**
 * Computes topological layer depth (0..3) and non-overlapping (x, y) coordinates,
 * and rebuilds edges from node prerequisites while preserving any bridge edges.
 */
export function recomputeTopologicalLayout(
  graph: KnowledgeGraph,
): KnowledgeGraph {
  const validIds = new Set(graph.nodes.map((n) => n.id));
  const nodeById = new Map<string, KnowledgeNode>(
    graph.nodes.map((n) => [n.id, n]),
  );
  const depthMap = new Map<string, number>();

  const computeDepth = (id: string, visiting = new Set<string>()): number => {
    if (depthMap.has(id)) return depthMap.get(id)!;
    if (visiting.has(id)) return 0;

    visiting.add(id);
    const node = nodeById.get(id);
    if (!node) {
      depthMap.set(id, 0);
      return 0;
    }

    const validPrereqs = (node.prerequisites || []).filter(
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

  graph.nodes.forEach((n) => computeDepth(n.id));

  const layers = new Map<number, KnowledgeNode[]>();
  graph.nodes.forEach((n) => {
    const d = depthMap.get(n.id) ?? 0;
    const list = layers.get(d) || [];
    list.push(n);
    layers.set(d, list);
  });

  const positionedNodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  const edgePairKeys = new Set<string>();

  for (const [depth, layerNodes] of layers.entries()) {
    const count = layerNodes.length;
    layerNodes.forEach((node, idx) => {
      const x = 100 + depth * 230;
      const y =
        count === 1
          ? 210
          : 95 + idx * Math.min(150, Math.floor(270 / Math.max(1, count - 1)));

      const cleanPrereqs = Array.from(
        new Set(
          (node.prerequisites || []).filter(
            (p) => validIds.has(p) && p !== node.id,
          ),
        ),
      );

      positionedNodes.push({
        ...node,
        prerequisites: cleanPrereqs,
        position: { x, y },
      });

      cleanPrereqs.forEach((prereqId, pIdx) => {
        const pairKey = `${prereqId}->${node.id}`;
        if (!edgePairKeys.has(pairKey)) {
          edgePairKeys.add(pairKey);
          edges.push({
            id: `edge-${prereqId}-${node.id}-${pIdx}`,
            source: prereqId,
            target: node.id,
          });
        }
      });
    });
  }

  // Preserve bridge edges not encoded directly in node.prerequisites
  for (const edge of graph.edges) {
    if (
      edge.id.includes("bridge") &&
      validIds.has(edge.source) &&
      validIds.has(edge.target)
    ) {
      const pairKey = `${edge.source}->${edge.target}`;
      if (!edgePairKeys.has(pairKey)) {
        edgePairKeys.add(pairKey);
        edges.push(edge);
      }
    }
  }

  return {
    ...graph,
    nodes: positionedNodes,
    edges,
  };
}

/**
 * Automatically weaves a triaged exam question's prerequisite DAG nodes into the user's
 * Knowledge Graph workspace, merging overlapping concept titles cleanly.
 */
export function weaveTriageIntoKnowledgeGraph(params: {
  existingGraphs: Record<string, KnowledgeGraph>;
  domainTitle: string;
  dagNodes: TriageDagNodeBlueprint[];
  coreConcepts: string[];
  traps: string[];
  extractedQuestion: string;
}): {
  updatedGraphs: Record<string, KnowledgeGraph>;
  domainKey: string;
  targetNode: KnowledgeNode;
  addedNodesCount: number;
} {
  const requestedDomain =
    params.domainTitle?.trim() || "Triaged Study Workspace";
  const matchedDomainKey = Object.keys(params.existingGraphs).find(
    (k) => k.trim().toLowerCase() === requestedDomain.toLowerCase(),
  );
  const domainKey = matchedDomainKey || requestedDomain;

  const existingGraph = params.existingGraphs[domainKey];
  const nodes: KnowledgeNode[] = existingGraph
    ? existingGraph.nodes.map((n) => ({
        ...n,
        prerequisites: [...n.prerequisites],
        activeTraps: [...n.activeTraps],
        keyConcepts: [...n.keyConcepts],
      }))
    : [];
  const existingEdges: KnowledgeEdge[] = existingGraph
    ? [...existingGraph.edges]
    : [];

  const blueprints: TriageDagNodeBlueprint[] =
    params.dagNodes && params.dagNodes.length > 0
      ? params.dagNodes
      : [
          {
            id: "node-1",
            title: (params.coreConcepts[0] || "Triaged Concept").slice(0, 48),
            description:
              params.extractedQuestion
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 180) || "Exam question analyzed via Trap Triage",
            category: "Exam Challenge",
            prerequisites: [],
            activeTraps:
              params.traps.length > 0 ? params.traps : ["Deceptive Exam Trap"],
            keyConcepts:
              params.coreConcepts.length > 0
                ? params.coreConcepts
                : ["Problem Analysis"],
          },
        ];

  const timestamp = Date.now();
  const nowIso = new Date().toISOString();
  const blueprintIdToActualId = new Map<string, string>();
  const resolvedIdsInOrder: string[] = [];
  let addedNodesCount = 0;

  // Pass 1: Match existing concepts by normalized title or create new KnowledgeNodes
  blueprints.forEach((raw, idx) => {
    const cleanTitle = raw.title.trim() || `Concept ${idx + 1}`;
    const normalizedTitle = cleanTitle.toLowerCase();
    const existingIdx = nodes.findIndex(
      (n) => n.title.trim().toLowerCase() === normalizedTitle,
    );

    if (existingIdx !== -1) {
      const existing = nodes[existingIdx];
      nodes[existingIdx] = {
        ...existing,
        activeTraps: Array.from(
          new Set([
            ...existing.activeTraps,
            ...(raw.activeTraps || []).map((t) => t.slice(0, 80)),
          ]),
        ),
        keyConcepts: Array.from(
          new Set([...existing.keyConcepts, ...(raw.keyConcepts || [])]),
        ),
        lastPracticed: "Just now",
        lastPracticedIso: nowIso,
      };
      blueprintIdToActualId.set(raw.id, existing.id);
      resolvedIdsInOrder.push(existing.id);
    } else {
      const isLastNode = idx === blueprints.length - 1;
      const newId = `triage-${timestamp}-${idx}`;
      const newNode: KnowledgeNode = {
        id: newId,
        title: cleanTitle.slice(0, 64),
        description:
          raw.description?.trim() ||
          params.extractedQuestion.replace(/\s+/g, " ").trim().slice(0, 180) ||
          "Concept extracted from exam trap triage.",
        domain: domainKey,
        category:
          raw.category?.trim() ||
          (isLastNode ? "Exam Challenge" : "Core Concept"),
        status: isLastNode ? "in_progress" : "unlocked",
        masteryScore: isLastNode ? 25 : 0,
        prerequisites: [],
        activeTraps:
          raw.activeTraps && raw.activeTraps.length > 0
            ? raw.activeTraps.map((t) => t.slice(0, 80))
            : params.traps.length > 0
              ? params.traps.slice(0, 2).map((t) => t.slice(0, 80))
              : ["Deceptive Exam Trap"],
        keyConcepts:
          raw.keyConcepts && raw.keyConcepts.length > 0
            ? raw.keyConcepts
            : params.coreConcepts.length > 0
              ? params.coreConcepts.slice(0, 3)
              : [cleanTitle],
        position: { x: 100 + idx * 230, y: 210 },
        lastPracticed: "Just now",
        lastPracticedIso: nowIso,
        stabilityHours: 24,
        retentionDecay: 1.0,
      };
      nodes.push(newNode);
      addedNodesCount += 1;
      blueprintIdToActualId.set(raw.id, newId);
      resolvedIdsInOrder.push(newId);
    }
  });

  // Pass 2: Wire prerequisite edges cleanly using resolved node IDs
  const hasPath = (
    fromId: string,
    toId: string,
    visited = new Set<string>(),
  ): boolean => {
    if (fromId === toId) return true;
    if (visited.has(fromId)) return false;
    visited.add(fromId);
    const node = nodes.find((n) => n.id === fromId);
    if (!node) return false;
    return node.prerequisites.some((p) => hasPath(p, toId, visited));
  };

  blueprints.forEach((raw, idx) => {
    const actualId = resolvedIdsInOrder[idx];
    const nodeIdx = nodes.findIndex((n) => n.id === actualId);
    if (nodeIdx === -1) return;

    const mappedPrereqs = (raw.prerequisites || [])
      .map((pid) => blueprintIdToActualId.get(pid))
      .filter((pid): pid is string => Boolean(pid) && pid !== actualId);

    const node = nodes[nodeIdx];
    const safePrereqs = [...node.prerequisites];
    for (const prereqId of mappedPrereqs) {
      // Avoid cycles: only add prereqId -> actualId if prereqId doesn't already depend on actualId
      if (!safePrereqs.includes(prereqId) && !hasPath(prereqId, actualId)) {
        safePrereqs.push(prereqId);
      }
    }

    nodes[nodeIdx] = {
      ...node,
      prerequisites: safePrereqs,
    };
  });

  const laidOutGraph = recomputeTopologicalLayout({
    domain: domainKey,
    nodes,
    edges: existingEdges,
  });

  const lastActualId = resolvedIdsInOrder[resolvedIdsInOrder.length - 1];
  const targetNode =
    laidOutGraph.nodes.find((n) => n.id === lastActualId) ||
    laidOutGraph.nodes[laidOutGraph.nodes.length - 1];

  return {
    updatedGraphs: {
      ...params.existingGraphs,
      [domainKey]: laidOutGraph,
    },
    domainKey,
    targetNode,
    addedNodesCount,
  };
}
