export type NodeStatus =
  | "locked"
  | "unlocked"
  | "in_progress"
  | "mastered"
  | "needs_review";

export type DomainType = string;

export interface TriageDagNodeBlueprint {
  id: string;
  title: string;
  description: string;
  category: string;
  prerequisites: string[];
  activeTraps: string[];
  keyConcepts: string[];
}

export type AnalogyBackground =
  | "Fullstack Web Developer"
  | "Game Developer & Graphics"
  | "Finance & Quant Economics"
  | "Music & Audio Technologist"
  | "General Engineering Student";

export interface KnowledgeNode {
  id: string;
  title: string;
  description: string;
  domain: DomainType;
  category: string;
  status: NodeStatus;
  masteryScore: number; // 0 - 100
  prerequisites: string[]; // Node IDs
  activeTraps: string[];
  keyConcepts: string[];
  position: { x: number; y: number };
  isBridgeNode?: boolean;
  lastPracticed?: string;
  lastPracticedIso?: string;
  stabilityHours?: number;
  retentionDecay?: number; // 0 - 1.0 (1.0 = freshly reinforced)
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
}

export interface KnowledgeGraph {
  domain: DomainType;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export type RootCauseCategory =
  | "PrerequisiteGap"
  | "Misconception"
  | "DeceptiveTrap"
  | "ExecutionSlip";

export interface CognitiveMisconception {
  id: string;
  timestamp: string;
  nodeId: string;
  nodeTitle: string;
  questionExcerpt: string;
  studentAttempt: string;
  rootCauseCategory: RootCauseCategory;
  diagnosticAnalysis: string;
  remedialAction: string;
  targetedTrap: string;
}

export interface TrapVulnerability {
  id: string;
  name: string;
  category:
    | "Boundary/Edge Case"
    | "Algorithmic Complexity"
    | "State/Resource Deadlock"
    | "Mathematical Oscillation"
    | "Precision & Overflow";
  frequency: number; // How many times tripped
  severity: "low" | "medium" | "high" | "critical";
  lastEncountered?: string;
  mitigationAdvice: string;
}

export interface LearnerProfile {
  id: string;
  name: string;
  analogyBackground: AnalogyBackground;
  activeDomain: DomainType;
  overallMastery: number; // 0 - 100
  learningStreakDays: number;
  totalDrillsCompleted: number;
  trapTendencies: Record<string, number>; // trap name -> count
  recentMisconceptions: CognitiveMisconception[];
  retentionAlertCount: number;
}

export interface SocraticMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  hintLevel?: 1 | 2 | 3;
  domainAnalogy?: string;
  misconceptionAddressed?: string;
  attackPlanStep?: string;
}

export interface DiagnosticEvaluation {
  isCorrectOrSubstantial: boolean;
  masteryDelta: number; // e.g. +15 or -10
  newMasteryScore: number;
  rootCauseCategory: RootCauseCategory;
  diagnosticNotes: string;
  identifiedTrap?: string;
  socraticFollowUpQuestion: string;
  unlockedNodeIds: string[];
  bridgeNodeCreated?: KnowledgeNode;
}

export interface DrillProblem {
  id: string;
  nodeId: string;
  nodeTitle: string;
  title: string;
  questionText: string;
  targetTraps: string[];
  coreConcepts: string[];
  theTrap: string;
  attackPlan: string[];
  hintL1: string; // High-level intuition nudge
  hintL2: string; // Specific boundary/constraint spotlight
  hintL3: string; // Concrete structural attack step
  gradingRubric: string[];
}

export interface DiagnosticContext {
  node: KnowledgeNode;
  questionText: string;
  studentAnswer: string;
}
