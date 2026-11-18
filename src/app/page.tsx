"use client";

import NextImage from "next/image";
import dynamic from "next/dynamic";
import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Plus,
  AlertTriangle,
  ArrowRight,
  X,
  Volume2,
  Cpu,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  HelpCircle,
  Compass,
  Mic,
  ShieldAlert,
  Zap,
  Flame,
  Layers,
  ChevronDown,
  Loader2,
  Upload,
} from "lucide-react";
import ImageUpload, { ImageEntry } from "./components/ImageUpload";
import SkeletonLoader from "./components/SkeletonLoader";
import type { TriageData } from "./components/ResultCards";
import { getIdToken } from "../../lib/firebaseClient";
import KnowledgeGraphView from "./components/agent/KnowledgeGraphView";
import SocraticStudio from "./components/agent/SocraticStudio";
import TrapRadarView from "./components/agent/TrapRadarView";
import PracticeDrillModal from "./components/agent/PracticeDrillModal";
import NotesUploadModal from "./components/agent/NotesUploadModal";
import {
  DomainType,
  AnalogyBackground,
  KnowledgeGraph,
  KnowledgeNode,
  LearnerProfile,
  DrillProblem,
  DiagnosticEvaluation,
  DiagnosticContext,
} from "@/types/agent";
import {
  applySpacedRepetitionDecay,
  computeOverallDomainMastery,
  countRetentionAlerts,
  updateGraphAfterEvaluation,
  weaveTriageIntoKnowledgeGraph,
} from "../../lib/agents/graphPlannerAgent";

const ResultCards = dynamic(() => import("./components/ResultCards"), {
  ssr: false,
});

const PracticeCard = dynamic(() => import("./components/PracticeCard"), {
  ssr: false,
});

type Phase = "idle" | "loading" | "result";
type InputTab = "image" | "text";
type MainNavTab = "triage" | "graph" | "socratic" | "traps";

const STORAGE_KEYS = {
  graphs: "gemmate_graphs_v3",
  profile: "gemmate_profile_v3",
  domain: "gemmate_active_domain_v3",
};

const EMPTY_GRAPH: KnowledgeGraph = {
  domain: "",
  nodes: [],
  edges: [],
};

function sanitizeText(val: unknown, fallback = ""): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text.trim();
    if (typeof obj.step === "string") return obj.step.trim();
    const entries = Object.entries(obj).map(([k, v]) => {
      const ck = k.replace(/\*+$/g, "").trim();
      const cv = typeof v === "string" ? v.trim() : v ? JSON.stringify(v) : "";
      return cv ? `${ck}: ${cv}` : ck;
    });
    return entries.join(" ").trim() || fallback;
  }
  return fallback;
}

const INITIAL_PROFILE: LearnerProfile = {
  id: "learner-user-1",
  name: "Learner",
  analogyBackground: "Fullstack Web Developer",
  activeDomain: "",
  overallMastery: 0,
  learningStreakDays: 1,
  totalDrillsCompleted: 0,
  trapTendencies: {},
  recentMisconceptions: [],
  retentionAlertCount: 0,
};

const ANALOGY_BACKGROUNDS: { label: AnalogyBackground; icon: string }[] = [
  { label: "Fullstack Web Developer", icon: "🌐" },
  { label: "Game Developer & Graphics", icon: "🎮" },
  { label: "Finance & Quant Economics", icon: "📈" },
  { label: "Music & Audio Technologist", icon: "🎵" },
  { label: "General Engineering Student", icon: "⚙️" },
];

const SAMPLE_QUESTIONS = [
  {
    title: "OS Deadlock Trap",
    text: "A system has 3 processes (P1, P2, P3) competing for 3 resources (R1, R2, R3). R1 has 2 instances, R2 has 1 instance, and R3 has 2 instances. P1 holds R1 and requests R2. P2 holds R2 and requests R3. P3 holds R3 and requests R1. Is the system in a deadlock? Prove why a cycle does not guarantee deadlock here.",
  },
  {
    title: "Calculus L'Hôpital Trap",
    text: "Evaluate the limit as x approaches infinity of (x + sin(x)) / (x - cos(x)). If you apply L'Hôpital's Rule directly, what happens to the oscillating derivative terms, and what is the correct algebraic attack plan?",
  },
  {
    title: "DSA Array Trap",
    text: "Given an array of integers where every element appears twice except for two distinct numbers that appear only once, find those two elements in O(n) time and O(1) space. Why does naive XORing fail to distinguish between the two individual unique numbers?",
  },
];

export default function Home() {
  // Adaptive Agent & Navigation State
  const [activeNavTab, setActiveNavTab] = useState<MainNavTab>("triage");
  const [activeDomain, setActiveDomain] = useState<DomainType>("");
  const [analogyBackground, setAnalogyBackground] = useState<AnalogyBackground>(
    "Fullstack Web Developer",
  );
  const [graphsByDomain, setGraphsByDomain] = useState<
    Record<string, KnowledgeGraph>
  >({});
  const [profile, setProfile] = useState<LearnerProfile>(INITIAL_PROFILE);

  const availableDomains = Object.keys(graphsByDomain);
  const graph =
    (activeDomain && graphsByDomain[activeDomain]) ||
    Object.values(graphsByDomain)[0] ||
    EMPTY_GRAPH;
  const liveMastery = computeOverallDomainMastery(graph);
  const liveRetentionAlerts = countRetentionAlerts(graph);

  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [socraticInitialQuestion, setSocraticInitialQuestion] = useState<
    string | undefined
  >(undefined);
  const [activeDrill, setActiveDrill] = useState<DrillProblem | null>(null);
  const [drillTargetNode, setDrillTargetNode] = useState<KnowledgeNode | null>(
    null,
  );
  const [isLoadingDrill, setIsLoadingDrill] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const hasHydratedRef = useRef(false);

  // Classic Triage State
  const [phase, setPhase] = useState<Phase>("idle");
  const [inputTab, setInputTab] = useState<InputTab>("image");
  const [imageEntries, setImageEntries] = useState<ImageEntry[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [result, setResult] = useState<TriageData | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showMasteryTooltip, setShowMasteryTooltip] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load persisted state from localStorage on mount
  useEffect(() => {
    try {
      // Remove legacy seeded v2 localStorage keys
      localStorage.removeItem("gemmate_graphs_v2");
      localStorage.removeItem("gemmate_profile_v2");
      localStorage.removeItem("gemmate_active_domain_v2");

      const savedGraphsRaw = localStorage.getItem(STORAGE_KEYS.graphs);
      const savedProfileRaw = localStorage.getItem(STORAGE_KEYS.profile);
      const savedDomain = localStorage.getItem(STORAGE_KEYS.domain);

      let loadedGraphs: Record<string, KnowledgeGraph> | null = null;
      if (savedGraphsRaw) {
        const parsed = JSON.parse(savedGraphsRaw) as Record<
          string,
          KnowledgeGraph
        >;
        loadedGraphs = {};
        for (const [dom, g] of Object.entries(parsed)) {
          loadedGraphs[dom] = applySpacedRepetitionDecay(g);
        }
        setGraphsByDomain(loadedGraphs);
      }

      if (savedProfileRaw) {
        const parsedProfile = JSON.parse(savedProfileRaw) as LearnerProfile;
        const cleanedMisconceptions = Array.isArray(
          parsedProfile.recentMisconceptions,
        )
          ? parsedProfile.recentMisconceptions.map((m) => ({
              ...m,
              questionExcerpt: sanitizeText(m.questionExcerpt),
              studentAttempt: sanitizeText(m.studentAttempt),
              diagnosticAnalysis: sanitizeText(m.diagnosticAnalysis),
              remedialAction: sanitizeText(
                m.remedialAction,
                "Practice structural breakdown in Socratic Studio.",
              ),
              targetedTrap: sanitizeText(m.targetedTrap, "Exam Trap"),
              nodeTitle: sanitizeText(m.nodeTitle, "Concept Node"),
            }))
          : [];
        setProfile({
          ...parsedProfile,
          recentMisconceptions: cleanedMisconceptions,
        });
        if (parsedProfile.analogyBackground) {
          setAnalogyBackground(parsedProfile.analogyBackground);
        }
      }

      if (savedDomain && loadedGraphs?.[savedDomain]) {
        setActiveDomain(savedDomain);
        const targetGraph = loadedGraphs[savedDomain];
        if (targetGraph?.nodes?.length) {
          setSelectedNode(targetGraph.nodes[0]);
        }
        setActiveNavTab("graph");
      } else if (loadedGraphs && Object.keys(loadedGraphs).length > 0) {
        const firstDomain = Object.keys(loadedGraphs)[0];
        setActiveDomain(firstDomain);
        if (loadedGraphs[firstDomain]?.nodes?.length) {
          setSelectedNode(loadedGraphs[firstDomain].nodes[0]);
        }
        setActiveNavTab("graph");
      }
    } catch (err) {
      console.warn("[Home] Failed to load persisted state:", err);
    } finally {
      hasHydratedRef.current = true;
    }
  }, []);

  // Save state to localStorage on change
  useEffect(() => {
    if (!hasHydratedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEYS.graphs, JSON.stringify(graphsByDomain));
      localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
      localStorage.setItem(STORAGE_KEYS.domain, activeDomain);
    } catch (err) {
      console.warn("[Home] Failed to persist state:", err);
    }
  }, [graphsByDomain, profile, activeDomain]);

  // Clear error if input is provided
  useEffect(() => {
    if (
      (imageEntries.length > 0 || questionText.trim().length > 0) &&
      apiError === "Please provide either a question photo or question text."
    ) {
      setApiError(null);
    }
  }, [imageEntries.length, questionText, apiError]);

  const handleDomainChange = (newDomain: DomainType) => {
    setActiveDomain(newDomain);
    setSocraticInitialQuestion(undefined);
    const domainGraph = graphsByDomain[newDomain];
    setSelectedNode(domainGraph?.nodes[0] || null);
    setProfile((prev) => ({ ...prev, activeDomain: newDomain }));
  };

  const handleBackgroundChange = (newBg: AnalogyBackground) => {
    setAnalogyBackground(newBg);
    setProfile((prev) => ({ ...prev, analogyBackground: newBg }));
  };

  const handleStartSocraticFromNode = (node: KnowledgeNode) => {
    setSelectedNode(node);
    setSocraticInitialQuestion(undefined);
    setActiveNavTab("socratic");
  };

  const handleStartDrillFromNode = async (
    node: KnowledgeNode,
    targetedTrap?: string,
  ) => {
    setDrillTargetNode(node);
    setIsLoadingDrill(true);
    try {
      const res = await fetch("/api/agent/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node,
          targetedTrap: targetedTrap || node.activeTraps[0],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveDrill(data);
      }
    } catch (err) {
      console.error("Failed to load drill:", err);
    } finally {
      setIsLoadingDrill(false);
    }
  };

  const handleEvaluationCompleted = (
    evalResult: DiagnosticEvaluation,
    context: DiagnosticContext,
  ) => {
    const targetNode = context.node;
    const targetDomain = targetNode.domain || activeDomain;
    const baseGraph = graphsByDomain[targetDomain] || graph;

    const { updatedGraph } = updateGraphAfterEvaluation(
      baseGraph,
      targetNode.id,
      evalResult.newMasteryScore,
      evalResult.bridgeNodeCreated,
    );

    setGraphsByDomain((prev) => ({
      ...prev,
      [targetDomain]: updatedGraph,
    }));

    const refreshedNode = updatedGraph.nodes.find(
      (n) => n.id === targetNode.id,
    );
    if (refreshedNode && selectedNode?.id === targetNode.id) {
      setSelectedNode(refreshedNode);
    }

    const updatedMastery = computeOverallDomainMastery(updatedGraph);
    const updatedAlerts = countRetentionAlerts(updatedGraph);

    setProfile((prev) => {
      const updatedTendencies = { ...prev.trapTendencies };
      if (evalResult.identifiedTrap && evalResult.identifiedTrap !== "None") {
        updatedTendencies[evalResult.identifiedTrap] =
          (updatedTendencies[evalResult.identifiedTrap] || 0) +
          (evalResult.isCorrectOrSubstantial ? 0 : 1);
      }

      const shouldLogMisconception =
        !evalResult.isCorrectOrSubstantial ||
        evalResult.rootCauseCategory !== "ExecutionSlip";

      const nextMisconceptions = shouldLogMisconception
        ? [
            {
              id: `misc-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              nodeId: targetNode.id,
              nodeTitle: targetNode.title,
              questionExcerpt: context.questionText.slice(0, 120),
              studentAttempt: context.studentAnswer.slice(0, 220),
              rootCauseCategory: evalResult.rootCauseCategory,
              diagnosticAnalysis: evalResult.diagnosticNotes,
              remedialAction: evalResult.socraticFollowUpQuestion,
              targetedTrap:
                evalResult.identifiedTrap &&
                evalResult.identifiedTrap !== "None"
                  ? evalResult.identifiedTrap
                  : targetNode.activeTraps[0] || "Conceptual Gap",
            },
            ...prev.recentMisconceptions,
          ].slice(0, 15)
        : prev.recentMisconceptions;

      return {
        ...prev,
        overallMastery: updatedMastery,
        retentionAlertCount: updatedAlerts,
        totalDrillsCompleted: prev.totalDrillsCompleted + 1,
        trapTendencies: updatedTendencies,
        recentMisconceptions: nextMisconceptions,
      };
    });
  };

  const handleResetGraph = () => {
    if (!activeDomain || !graphsByDomain[activeDomain]) return;
    const resetGraph: KnowledgeGraph = {
      ...graph,
      nodes: graph.nodes
        .filter((n) => !n.isBridgeNode)
        .map((n) => ({
          ...n,
          masteryScore: 0,
          status:
            n.prerequisites.length === 0
              ? ("unlocked" as const)
              : ("locked" as const),
          retentionDecay: 1.0,
        })),
    };
    setGraphsByDomain((prev) => ({
      ...prev,
      [activeDomain]: resetGraph,
    }));
    setSelectedNode(resetGraph.nodes[0] || null);
  };

  const handleDeleteDomain = () => {
    if (!activeDomain || !graphsByDomain[activeDomain]) return;
    const nextGraphs = { ...graphsByDomain };
    delete nextGraphs[activeDomain];
    const remainingKeys = Object.keys(nextGraphs);
    const nextDomain = remainingKeys[0] || "";
    setGraphsByDomain(nextGraphs);
    setActiveDomain(nextDomain);
    setSelectedNode(
      nextDomain ? nextGraphs[nextDomain]?.nodes[0] || null : null,
    );
    setProfile((prev) => ({
      ...prev,
      activeDomain: nextDomain,
      overallMastery: nextDomain
        ? computeOverallDomainMastery(nextGraphs[nextDomain])
        : 0,
      retentionAlertCount: nextDomain
        ? countRetentionAlerts(nextGraphs[nextDomain])
        : 0,
    }));
  };

  const handleCoachTriageInSocratic = () => {
    if (!result) return;
    setSocraticInitialQuestion(
      result.extractedQuestion || questionText.trim() || undefined,
    );
    setActiveNavTab("socratic");
  };

  const handleImagesChange = (entries: ImageEntry[]) => {
    setImageEntries(entries);
  };

  const handleTriage = async () => {
    if (phase === "loading") return;

    const hasImages = imageEntries.length > 0;
    const hasText = questionText.trim().length > 0;

    if (!hasImages && !hasText) {
      setApiError("Please provide either a question photo or question text.");
      return;
    }

    setPhase("loading");
    setResult(null);
    setApiError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const base64Images = imageEntries.map((e) => e.base64);
      const idToken = await getIdToken();

      const res = await fetch("/api/triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          images: base64Images.length > 0 ? base64Images : undefined,
          questionText: hasText ? questionText.trim() : undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res
          .json()
          .catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawTraps: unknown[] = Array.isArray(data.the_trap)
        ? data.the_trap
        : data.the_trap
          ? [data.the_trap]
          : [];
      const extractedTraps = rawTraps
        .map((t) => sanitizeText(t))
        .filter((t) => t.length > 0);
      const extractedConcepts = Array.isArray(data.core_concepts)
        ? data.core_concepts
            .map((c: unknown) => sanitizeText(c))
            .filter((c: string) => c.length > 0)
        : [];
      const extractedAttackPlan = Array.isArray(data.attack_plan)
        ? data.attack_plan
            .map((s: unknown) => sanitizeText(s))
            .filter((s: string) => s.length > 0)
        : [];

      const extractedQuestionText =
        sanitizeText(data.extracted_question) ||
        questionText.trim() ||
        "Triaged Exam Question";

      const woven = weaveTriageIntoKnowledgeGraph({
        existingGraphs: graphsByDomain,
        domainTitle: sanitizeText(data.domain_title),
        dagNodes: data.dag_nodes || [],
        coreConcepts: extractedConcepts,
        traps: extractedTraps,
        extractedQuestion: extractedQuestionText,
      });

      setGraphsByDomain(woven.updatedGraphs);
      setActiveDomain(woven.domainKey);
      setSelectedNode(woven.targetNode);

      const wovenDomainGraph = woven.updatedGraphs[woven.domainKey];
      const updatedMastery = computeOverallDomainMastery(wovenDomainGraph);
      const updatedAlerts = countRetentionAlerts(wovenDomainGraph);

      setResult({
        domainTitle: woven.domainKey,
        coreConcepts: extractedConcepts,
        theTrap: extractedTraps,
        attackPlan: extractedAttackPlan,
        extractedQuestion: extractedQuestionText,
        modelUsed: sanitizeText(data.model_used),
        inferenceMode: sanitizeText(data.inference_mode),
        latencyMs: data.latency_ms,
        wovenNodesCount: woven.addedNodesCount || wovenDomainGraph.nodes.length,
      });

      setProfile((prev) => {
        const updatedTendencies = { ...prev.trapTendencies };
        extractedTraps.forEach((trap) => {
          const trapLabel = trap.length > 56 ? `${trap.slice(0, 53)}...` : trap;
          updatedTendencies[trapLabel] =
            (updatedTendencies[trapLabel] || 0) + 1;
        });

        const primaryTrap = extractedTraps[0] || "Deceptive Exam Trap";
        const newMisc = {
          id: `triage-misc-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          nodeId: woven.targetNode.id,
          nodeTitle: woven.targetNode.title,
          questionExcerpt: extractedQuestionText.slice(0, 120),
          studentAttempt: "Analyzed via Exam Trap Triage",
          rootCauseCategory: "DeceptiveTrap" as const,
          diagnosticAnalysis: primaryTrap,
          remedialAction:
            extractedAttackPlan[0] ||
            "Practice structural breakdown in Socratic Studio.",
          targetedTrap:
            primaryTrap.length > 56
              ? `${primaryTrap.slice(0, 53)}...`
              : primaryTrap,
        };

        return {
          ...prev,
          activeDomain: woven.domainKey,
          overallMastery: updatedMastery,
          retentionAlertCount: updatedAlerts,
          trapTendencies: updatedTendencies,
          recentMisconceptions: [newMisc, ...prev.recentMisconceptions].slice(
            0,
            15,
          ),
        };
      });

      setPhase("result");
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") {
        setPhase("idle");
        return;
      }
      setApiError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("idle");
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const handleReset = () => {
    setPhase("idle");
    setImageEntries([]);
    setQuestionText("");
    setResult(null);
    setApiError(null);
  };

  const containerMaxWidth =
    activeNavTab === "graph"
      ? 1020
      : activeNavTab === "socratic" || activeNavTab === "traps"
        ? 860
        : 580;

  return (
    <>
      <div className="ambient-bg" />
      <main
        aria-labelledby="triage-heading"
        style={{
          background: "transparent",
          minHeight: "100dvh",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Top Navigation Bar ──────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            borderBottom: "1px solid var(--border)",
            background: "rgba(5,7,15,0.85)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {/* Logo & Identity */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                overflow: "hidden",
                boxShadow: "0 0 18px rgba(56,189,248,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#080c16",
                border: "1px solid rgba(56,189,248,0.35)",
              }}
            >
              <NextImage
                src="/icon.png"
                alt="Gemmate Logo"
                width={36}
                height={36}
                style={{ objectFit: "cover" }}
                unoptimized
                priority
              />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    color: "var(--text-1)",
                    fontWeight: 900,
                    fontSize: 19,
                    letterSpacing: -0.6,
                  }}
                >
                  Gemmate
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    letterSpacing: 0.8,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: "rgba(56,189,248,0.12)",
                    border: "1px solid rgba(56,189,248,0.3)",
                    color: "#38bdf8",
                    textTransform: "uppercase",
                  }}
                >
                  2.0
                </span>
              </div>
            </div>

            {/* Domain Selector (shown only in Knowledge DAG & Socratic Studio when modules exist) */}
            {availableDomains.length > 0 &&
              (activeNavTab === "graph" || activeNavTab === "socratic") && (
                <div style={{ position: "relative", marginLeft: 4 }}>
                  <select
                    value={activeDomain}
                    onChange={(e) =>
                      handleDomainChange(e.target.value as DomainType)
                    }
                    aria-label="Select Curriculum Domain"
                    style={{
                      appearance: "none",
                      background: "var(--surface)",
                      color: "var(--text-1)",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 28px 6px 12px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {availableDomains.map((d) => (
                      <option
                        key={d}
                        value={d}
                        style={{ background: "#0d1323", color: "#eef2ff" }}
                      >
                        {d}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={13}
                    style={{
                      color: "var(--text-3)",
                      position: "absolute",
                      right: 9,
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              )}

            {(activeNavTab === "graph" || activeNavTab === "socratic") && (
              <button
                type="button"
                onClick={() => setShowNotesModal(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 10,
                  background: "rgba(56,189,248,0.12)",
                  border: "1px solid rgba(56,189,248,0.3)",
                  color: "#38bdf8",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Upload size={13} />
                <span>Upload Notes</span>
              </button>
            )}
          </div>

          {/* Action & Learner Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {/* Analogy Lens Selector */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 10,
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <Sparkles size={13} style={{ color: "#fbbf24" }} />
              <select
                value={analogyBackground}
                onChange={(e) =>
                  handleBackgroundChange(e.target.value as AnalogyBackground)
                }
                aria-label="Select Analogy Background"
                title="Concepts will be adapted into analogies from this background"
                style={{
                  appearance: "none",
                  background: "transparent",
                  color: "#38bdf8",
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                  paddingRight: 4,
                }}
              >
                {ANALOGY_BACKGROUNDS.map((b) => (
                  <option
                    key={b.label}
                    value={b.label}
                    style={{ background: "#0d1323", color: "#eef2ff" }}
                  >
                    {b.icon} {b.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Mastery & Streak Pill */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-2)",
              }}
            >
              <Layers size={13} style={{ color: "#38bdf8" }} />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>Mastery:</span>
                <strong style={{ color: "var(--text-1)" }}>
                  {liveMastery}%
                </strong>

                {/* Question mark with hover tooltip */}
                <span
                  style={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                  onMouseEnter={() => setShowMasteryTooltip(true)}
                  onMouseLeave={() => setShowMasteryTooltip(false)}
                >
                  <button
                    type="button"
                    aria-label="What is Mastery?"
                    onClick={() => setShowMasteryTooltip((prev) => !prev)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "1px 2px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: showMasteryTooltip ? "#38bdf8" : "var(--text-3)",
                      transition: "color 0.15s ease",
                    }}
                  >
                    <HelpCircle size={12} />
                  </button>

                  <AnimatePresence>
                    {showMasteryTooltip && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        style={{
                          position: "absolute",
                          top: "calc(100% + 10px)",
                          right: -24,
                          width: 280,
                          maxWidth: "calc(100vw - 32px)",
                          padding: "12px 14px",
                          borderRadius: 12,
                          background: "#0c1322",
                          border: "1px solid rgba(56, 189, 248, 0.28)",
                          boxShadow:
                            "0 14px 34px rgba(0, 0, 0, 0.65), 0 0 16px rgba(56, 189, 248, 0.12)",
                          color: "var(--text-1)",
                          zIndex: 100,
                          textAlign: "left",
                          pointerEvents: "auto",
                        }}
                      >
                        {/* Caret pointing up */}
                        <div
                          style={{
                            position: "absolute",
                            top: -5,
                            right: 28,
                            transform: "rotate(45deg)",
                            width: 8,
                            height: 8,
                            background: "#0c1322",
                            borderLeft: "1px solid rgba(56, 189, 248, 0.28)",
                            borderTop: "1px solid rgba(56, 189, 248, 0.28)",
                          }}
                        />

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            marginBottom: 6,
                          }}
                        >
                          <Layers size={13} style={{ color: "#38bdf8" }} />
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: "#f8fafc",
                            }}
                          >
                            Domain Mastery ({liveMastery}%)
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--text-2)",
                            lineHeight: 1.5,
                            marginBottom: 8,
                          }}
                        >
                          The average mastery across all concept nodes in your
                          current knowledge DAG.
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 5,
                            fontSize: 10.5,
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                            paddingTop: 8,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 6,
                            }}
                          >
                            <span style={{ color: "#34d399", fontWeight: 700 }}>
                              ▲
                            </span>
                            <span style={{ color: "var(--text-2)" }}>
                              <strong style={{ color: "#34d399" }}>
                                Increases:
                              </strong>{" "}
                              Solving practice drills correctly and disarming
                              exam traps.
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 6,
                            }}
                          >
                            <span style={{ color: "#f87171", fontWeight: 700 }}>
                              ▼
                            </span>
                            <span style={{ color: "var(--text-2)" }}>
                              <strong style={{ color: "#f87171" }}>
                                Decreases:
                              </strong>{" "}
                              Misconceptions in drills, forgetting decay over
                              time, or adding new unpracticed topics.
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </span>
              </span>
              {liveRetentionAlerts > 0 && (
                <>
                  <span
                    style={{
                      width: 1,
                      height: 12,
                      background: "var(--border)",
                    }}
                  />
                  <span style={{ color: "#fbbf24", fontWeight: 700 }}>
                    {liveRetentionAlerts} review
                  </span>
                </>
              )}
              <span
                style={{
                  width: 1,
                  height: 12,
                  background: "var(--border)",
                }}
              />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: "#fbbf24",
                  fontWeight: 700,
                }}
              >
                <Flame size={13} style={{ fill: "#fbbf24" }} />
                {profile.learningStreakDays}d
              </span>
            </div>

            {activeNavTab === "triage" && phase === "result" && (
              <motion.button
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReset}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 10,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-2)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Plus size={14} /> New Triage
              </motion.button>
            )}
          </div>
        </motion.header>

        {/* ── 4-Mode Navigation Bar ──────────────────────── */}
        <div
          style={{
            margin: "20px auto 0",
            padding: 5,
            borderRadius: 14,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            display: "inline-flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            maxWidth: "calc(100% - 32px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          {[
            { id: "graph" as const, label: "Knowledge DAG", icon: Compass },
            { id: "socratic" as const, label: "Socratic Studio", icon: Mic },
            {
              id: "traps" as const,
              label: "Trap Vulnerability Matrix",
              icon: ShieldAlert,
            },
            { id: "triage" as const, label: "Exam Trap Triage", icon: Zap },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeNavTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveNavTab(tab.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 15px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 700,
                  background: active
                    ? "linear-gradient(135deg,#38bdf8,#818cf8)"
                    : "transparent",
                  color: active ? "#ffffff" : "var(--text-2)",
                  boxShadow: active
                    ? "0 4px 14px rgba(56,189,248,0.28)"
                    : "none",
                  transition: "all 0.2s ease",
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Main Container ───────────────────────────────── */}
        <div
          style={{
            flex: 1,
            maxWidth: containerMaxWidth,
            width: "100%",
            margin: "0 auto",
            padding: "24px 20px 140px",
            transition: "max-width 0.25s ease",
          }}
        >
          {/* ── VIEW 1: KNOWLEDGE DAG ──────────────────────── */}
          {activeNavTab === "graph" && (
            <motion.div
              key="view-graph"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <KnowledgeGraphView
                graph={graph}
                selectedNode={selectedNode}
                onSelectNode={(node) => setSelectedNode(node)}
                onStartSocratic={handleStartSocraticFromNode}
                onStartDrill={(node) => handleStartDrillFromNode(node)}
                onOpenNotesUpload={() => setShowNotesModal(true)}
                onResetGraph={handleResetGraph}
                onGoToTriage={() => setActiveNavTab("triage")}
                onDeleteDomain={handleDeleteDomain}
              />
            </motion.div>
          )}

          {/* ── VIEW 2: SOCRATIC STUDIO ────────────────────── */}
          {activeNavTab === "socratic" && (
            <motion.div
              key="view-socratic"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <SocraticStudio
                node={selectedNode || graph.nodes[0] || null}
                analogyBackground={analogyBackground}
                initialQuestion={socraticInitialQuestion}
                onDiagnosticResult={handleEvaluationCompleted}
                onGoToTriage={() => setActiveNavTab("triage")}
                onOpenNotesUpload={() => setShowNotesModal(true)}
              />
            </motion.div>
          )}

          {/* ── VIEW 3: TRAP VULNERABILITY MATRIX ──────────── */}
          {activeNavTab === "traps" && (
            <motion.div
              key="view-traps"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <TrapRadarView
                profile={profile}
                activeGraph={graph}
                onSelectNodeForReview={(node) => handleStartDrillFromNode(node)}
                onSynthesizeDrillForTrap={(trapName) => {
                  const targetNode =
                    graph.nodes.find((n) => n.activeTraps.includes(trapName)) ||
                    graph.nodes[0];
                  if (targetNode) {
                    handleStartDrillFromNode(targetNode, trapName);
                  } else {
                    setActiveNavTab("triage");
                  }
                }}
                onGoToTriage={() => setActiveNavTab("triage")}
                onOpenNotesUpload={() => setShowNotesModal(true)}
              />
            </motion.div>
          )}

          {/* ── VIEW 4: CLASSIC EXAM TRAP TRIAGE ───────────── */}
          {activeNavTab === "triage" && (
            <div>
              {/* Hero Header */}
              <AnimatePresence mode="wait">
                {phase === "idle" && (
                  <motion.div
                    key="hero"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -14 }}
                    transition={{ duration: 0.45 }}
                    style={{ marginBottom: 28 }}
                  >
                    {/* Companion Badge */}
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 12px",
                        borderRadius: 20,
                        background: "rgba(129,140,248,0.1)",
                        border: "1px solid rgba(129,140,248,0.25)",
                        marginBottom: 14,
                      }}
                    >
                      <Sparkles size={14} style={{ color: "#818cf8" }} />
                      <span
                        style={{
                          color: "#818cf8",
                          fontSize: 11.5,
                          fontWeight: 700,
                        }}
                      >
                        Autonomous AI Learning Companion
                      </span>
                    </div>

                    <h1
                      id="triage-heading"
                      style={{
                        fontSize: "clamp(26px,7vw,38px)",
                        fontWeight: 900,
                        letterSpacing: -1.2,
                        lineHeight: 1.15,
                        marginBottom: 12,
                        color: "var(--text-1)",
                      }}
                    >
                      Crack exam traps with your{" "}
                      <span
                        style={{
                          background:
                            "linear-gradient(135deg,#38bdf8,#818cf8,#f43f5e)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                        }}
                      >
                        open-AI voice companion.
                      </span>
                    </h1>

                    <p
                      style={{
                        color: "var(--text-2)",
                        fontSize: 14,
                        lineHeight: 1.65,
                        maxWidth: 480,
                      }}
                    >
                      Upload past papers or paste difficult problems. Powered by
                      Google&apos;s open-weight <strong>Gemma</strong> to unmask
                      deceptive traps, with comforting Socratic voice hints by{" "}
                      <strong>ElevenLabs</strong>.
                    </p>

                    {/* Tech Pills */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 7,
                        marginTop: 18,
                      }}
                    >
                      {[
                        {
                          label: "Gemma Open Weights",
                          icon: Cpu,
                          color: "#38bdf8",
                        },
                        {
                          label: "ElevenLabs Voice Coach",
                          icon: Volume2,
                          color: "#34d399",
                        },
                        {
                          label: "100% Private & Local",
                          icon: ShieldCheck,
                          color: "#a78bfa",
                        },
                      ].map((pill) => {
                        const Icon = pill.icon;
                        return (
                          <span
                            key={pill.label}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 10px",
                              borderRadius: 20,
                              fontSize: 11.5,
                              fontWeight: 600,
                              background: "var(--surface)",
                              border: "1px solid var(--border)",
                              color: pill.color,
                            }}
                          >
                            <Icon size={12} />
                            {pill.label}
                          </span>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {phase === "result" && (
                  <motion.div
                    key="result-header"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 20,
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#34d399",
                          boxShadow: "0 0 10px #34d399",
                        }}
                      />
                      <span
                        style={{
                          color: "var(--text-3)",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                        }}
                      >
                        Triage Complete
                      </span>
                    </div>

                    {result?.modelUsed && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--text-3)",
                          background: "rgba(255,255,255,0.04)",
                          padding: "3px 8px",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                        }}
                      >
                        Model: {result.modelUsed} ({result.inferenceMode})
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Error Notification ───────────────────────── */}
              <AnimatePresence>
                {apiError && phase === "idle" && (
                  <motion.div
                    key="alert"
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: "hidden", marginBottom: 16 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "13px 16px",
                        borderRadius: 14,
                        background: "rgba(251,191,36,0.07)",
                        border: "1px solid rgba(251,191,36,0.25)",
                      }}
                    >
                      <AlertTriangle
                        size={16}
                        style={{
                          color: "#fbbf24",
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      />
                      <p
                        style={{
                          color: "var(--text-2)",
                          fontSize: 13.5,
                          flex: 1,
                          lineHeight: 1.5,
                        }}
                      >
                        {apiError}
                      </p>
                      <button
                        onClick={() => setApiError(null)}
                        type="button"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-3)",
                          padding: 2,
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Input Section (Idle Phase) ───────────────── */}
              <AnimatePresence>
                {phase === "idle" && (
                  <motion.div
                    key="input-section"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                    transition={{ duration: 0.35 }}
                    style={{ marginBottom: 24 }}
                  >
                    {/* Input Mode Tabs */}
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        padding: 4,
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--border)",
                        marginBottom: 16,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setInputTab("image")}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 7,
                          padding: "8px 14px",
                          borderRadius: 9,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          border: "none",
                          background:
                            inputTab === "image"
                              ? "rgba(56,189,248,0.15)"
                              : "transparent",
                          color:
                            inputTab === "image" ? "#38bdf8" : "var(--text-3)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <ImageIcon size={14} />
                        <span>Upload Question Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputTab("text")}
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 7,
                          padding: "8px 14px",
                          borderRadius: 9,
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          border: "none",
                          background:
                            inputTab === "text"
                              ? "rgba(129,140,248,0.15)"
                              : "transparent",
                          color:
                            inputTab === "text" ? "#818cf8" : "var(--text-3)",
                          transition: "all 0.2s ease",
                        }}
                      >
                        <FileText size={14} />
                        <span>Type or Paste Question</span>
                      </button>
                    </div>

                    {inputTab === "image" ? (
                      <div>
                        <ImageUpload
                          images={imageEntries}
                          onImagesChange={handleImagesChange}
                          disabled={false}
                        />
                      </div>
                    ) : (
                      <div>
                        <textarea
                          value={questionText}
                          onChange={(e) => setQuestionText(e.target.value)}
                          placeholder="Paste your exam question, equations, or code problem here..."
                          rows={5}
                          style={{
                            width: "100%",
                            padding: "14px 16px",
                            borderRadius: 14,
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            color: "var(--text-1)",
                            fontSize: 13.5,
                            lineHeight: 1.6,
                            resize: "vertical",
                            outline: "none",
                            fontFamily: "inherit",
                            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)",
                          }}
                        />

                        {/* Quick Sample Selector */}
                        <div style={{ marginTop: 12 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "var(--text-3)",
                              textTransform: "uppercase",
                              letterSpacing: 0.8,
                              marginBottom: 8,
                            }}
                          >
                            Try a tricky sample problem:
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 6,
                            }}
                          >
                            {SAMPLE_QUESTIONS.map((sample) => (
                              <button
                                key={sample.title}
                                type="button"
                                onClick={() => setQuestionText(sample.text)}
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  padding: "4px 10px",
                                  borderRadius: 8,
                                  background: "rgba(255,255,255,0.04)",
                                  border: "1px solid var(--border)",
                                  color: "var(--text-2)",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {sample.title}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Triage Trigger Button */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      style={{ marginTop: 24 }}
                    >
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleTriage}
                        type="button"
                        style={{
                          width: "100%",
                          padding: "16px 24px",
                          borderRadius: 16,
                          background:
                            "linear-gradient(135deg,#38bdf8,#818cf8,#ec4899)",
                          border: "none",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: 15,
                          letterSpacing: -0.3,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 10,
                          cursor: "pointer",
                          boxShadow: "0 4px 25px rgba(129,140,248,0.35)",
                        }}
                      >
                        <Sparkles size={18} />
                        <span>Triage with Gemma</span>
                        <ArrowRight size={17} />
                      </motion.button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Loading Skeleton Phase ───────────────────── */}
              <AnimatePresence>
                {phase === "loading" && (
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div style={{ marginBottom: 20 }}>
                      <SkeletonLoader onCancel={handleCancel} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Results Phase ────────────────────────────── */}
              <AnimatePresence>
                {phase === "result" && result && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 24,
                    }}
                  >
                    {/* Connect Triage Results to Learning Agent Graph & Studio */}
                    <div
                      style={{
                        padding: "16px 18px",
                        borderRadius: 14,
                        background: "var(--surface)",
                        border: "1px solid rgba(56,189,248,0.35)",
                        boxShadow: "0 6px 20px rgba(56,189,248,0.1)",
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 3,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: "#34d399",
                              boxShadow: "0 0 8px #34d399",
                            }}
                          />
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: "var(--text-1)",
                            }}
                          >
                            Automatically Woven Into Your Knowledge DAG
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--text-2)",
                          }}
                        >
                          Module:{" "}
                          <strong style={{ color: "#38bdf8" }}>
                            {result.domainTitle || activeDomain}
                          </strong>{" "}
                          &bull; {result.wovenNodesCount ?? graph.nodes.length}{" "}
                          prerequisite nodes linked &amp; traps logged
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveNavTab("graph")}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 13px",
                            borderRadius: 10,
                            background: "rgba(56,189,248,0.14)",
                            border: "1px solid rgba(56,189,248,0.35)",
                            color: "#38bdf8",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <Compass size={14} />
                          <span>Explore in Knowledge DAG &rarr;</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCoachTriageInSocratic}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 13px",
                            borderRadius: 10,
                            background:
                              "linear-gradient(135deg,#38bdf8,#818cf8)",
                            border: "none",
                            color: "#ffffff",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <Mic size={14} />
                          <span>Coach Me in Socratic Studio &rarr;</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveNavTab("traps")}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 13px",
                            borderRadius: 10,
                            background: "rgba(251,191,36,0.12)",
                            border: "1px solid rgba(251,191,36,0.3)",
                            color: "#fbbf24",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <ShieldAlert size={14} />
                          <span>View Trap Matrix &rarr;</span>
                        </button>
                      </div>
                    </div>

                    <ResultCards data={result} />
                    <PracticeCard
                      coreConcepts={result.coreConcepts}
                      theTrap={result.theTrap}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Loading Drill Overlay ───────────────────────── */}
        {isLoadingDrill && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(5,7,15,0.75)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                padding: "20px 28px",
                borderRadius: 16,
                background: "var(--surface)",
                border: "1px solid var(--border-bright)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: "var(--text-1)",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <Loader2
                size={18}
                className="spin"
                style={{ color: "#38bdf8" }}
              />
              <span>Synthesizing targeted exam-trap drill...</span>
            </div>
          </div>
        )}

        {/* ── Practice Drill Modal ────────────────────────── */}
        {activeDrill && drillTargetNode && (
          <PracticeDrillModal
            drill={activeDrill}
            node={drillTargetNode}
            analogyBackground={analogyBackground}
            onClose={() => setActiveDrill(null)}
            onEvaluationCompleted={handleEvaluationCompleted}
          />
        )}

        {/* ── Upload Study Notes -> Knowledge DAG Modal ───── */}
        {showNotesModal && (
          <NotesUploadModal
            onClose={() => setShowNotesModal(false)}
            onGraphCreated={(newGraph) => {
              setGraphsByDomain((prev) => ({
                ...prev,
                [newGraph.domain]: newGraph,
              }));
              setActiveDomain(newGraph.domain);
              setSelectedNode(newGraph.nodes[0] || null);
              setSocraticInitialQuestion(undefined);
              setProfile((prev) => ({
                ...prev,
                activeDomain: newGraph.domain,
                overallMastery: computeOverallDomainMastery(newGraph),
                retentionAlertCount: countRetentionAlerts(newGraph),
              }));
              setShowNotesModal(false);
              setActiveNavTab("graph");
            }}
          />
        )}
      </main>
    </>
  );
}
