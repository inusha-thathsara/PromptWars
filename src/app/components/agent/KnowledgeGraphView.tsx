"use client";

import React, { useState } from "react";
import { KnowledgeGraph, KnowledgeNode } from "@/types/agent";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Lock,
  Unlock,
  Sparkles,
  GitBranch,
  Target,
  X,
  Play,
  Upload,
  RotateCcw,
  Plus,
} from "lucide-react";

interface KnowledgeGraphViewProps {
  graph: KnowledgeGraph;
  selectedNode: KnowledgeNode | null;
  onSelectNode: (node: KnowledgeNode | null) => void;
  onStartSocratic: (node: KnowledgeNode) => void;
  onStartDrill: (node: KnowledgeNode) => void;
  onOpenNotesUpload?: () => void;
  onResetGraph?: () => void;
  onGoToTriage?: () => void;
  onDeleteDomain?: () => void;
}

const STATUS_STYLE_MAP: Record<
  KnowledgeNode["status"],
  { border: string; badgeColor: string; barColor: string; label: string }
> = {
  mastered: {
    border: "#34d399",
    badgeColor: "#34d399",
    barColor: "#34d399",
    label: "Mastered",
  },
  in_progress: {
    border: "#4f8eff",
    badgeColor: "#60a5fa",
    barColor: "#4f8eff",
    label: "In Progress",
  },
  needs_review: {
    border: "#fbbf24",
    badgeColor: "#fbbf24",
    barColor: "#fbbf24",
    label: "Needs Review",
  },
  unlocked: {
    border: "#a78bfa",
    badgeColor: "#a78bfa",
    barColor: "#a78bfa",
    label: "Unlocked",
  },
  locked: {
    border: "#1c2b47",
    badgeColor: "#6b83ab",
    barColor: "#6b83ab",
    label: "Locked",
  },
};

export default function KnowledgeGraphView({
  graph,
  selectedNode,
  onSelectNode,
  onStartSocratic,
  onStartDrill,
  onOpenNotesUpload,
  onResetGraph,
  onGoToTriage,
  onDeleteDomain,
}: KnowledgeGraphViewProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const nodeMap = new Map<string, KnowledgeNode>();
  graph.nodes.forEach((n) => nodeMap.set(n.id, n));

  const renderStatusIcon = (node: KnowledgeNode) => {
    if (node.isBridgeNode) {
      return (
        <GitBranch size={14} style={{ color: "#38bdf8", flexShrink: 0 }} />
      );
    }
    switch (node.status) {
      case "mastered":
        return (
          <CheckCircle2 size={14} style={{ color: "#34d399", flexShrink: 0 }} />
        );
      case "in_progress":
        return <Clock size={14} style={{ color: "#4f8eff", flexShrink: 0 }} />;
      case "needs_review":
        return (
          <AlertTriangle
            size={14}
            style={{ color: "#fbbf24", flexShrink: 0 }}
          />
        );
      case "unlocked":
        return <Unlock size={14} style={{ color: "#a78bfa", flexShrink: 0 }} />;
      case "locked":
      default:
        return (
          <Lock size={14} style={{ color: "var(--text-3)", flexShrink: 0 }} />
        );
    }
  };

  const legendItems = [
    { label: "Mastered (≥80%)", color: "#34d399" },
    { label: "In Progress", color: "#4f8eff" },
    { label: "Needs Review", color: "#fbbf24" },
    { label: "Unlocked", color: "#a78bfa" },
    { label: "Remedial Bridge", color: "#38bdf8" },
  ];

  return (
    <div
      className="noise"
      style={{
        width: "100%",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 20,
        padding: "24px",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
      }}
    >
      {/* Header Section */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          paddingBottom: 18,
          marginBottom: 18,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Sparkles size={17} style={{ color: "#38bdf8" }} />
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "var(--text-1)",
                letterSpacing: -0.4,
              }}
            >
              Dynamic Knowledge DAG
            </h2>
            {graph.domain && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "rgba(56,189,248,0.12)",
                  border: "1px solid rgba(56,189,248,0.28)",
                  color: "#38bdf8",
                }}
              >
                {graph.domain}
              </span>
            )}

            {graph.nodes.length > 0 && onGoToTriage && (
              <button
                type="button"
                onClick={onGoToTriage}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 12px",
                  borderRadius: 10,
                  background: "rgba(129,140,248,0.14)",
                  border: "1px solid rgba(129,140,248,0.35)",
                  color: "#a5b4fc",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Plus size={13} />
                <span>Triage Question</span>
              </button>
            )}

            {graph.nodes.length > 0 && onOpenNotesUpload && (
              <button
                type="button"
                onClick={onOpenNotesUpload}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 10,
                  background: "rgba(56,189,248,0.14)",
                  border: "1px solid rgba(56,189,248,0.35)",
                  color: "#38bdf8",
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Upload size={13} />
                <span>Upload Study Notes ➔ Build DAG</span>
              </button>
            )}

            {graph.nodes.length > 0 && onResetGraph && (
              <button
                type="button"
                onClick={onResetGraph}
                title="Reset current domain progress"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 10px",
                  borderRadius: 10,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-3)",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={12} />
                <span>Reset Graph</span>
              </button>
            )}

            {graph.nodes.length > 0 && onDeleteDomain && (
              <button
                type="button"
                onClick={onDeleteDomain}
                title="Remove this module from workspace"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 10px",
                  borderRadius: 10,
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.22)",
                  color: "#f87171",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <X size={12} />
                <span>Remove Module</span>
              </button>
            )}
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-2)",
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            Living prerequisite skill graph. Nodes unlock automatically as
            foundational mastery is proven.
          </p>
        </div>

        {/* Legend Pills */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          {legendItems.map((item) => (
            <span
              key={item.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 999,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 600,
                color: item.color,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: item.color,
                  display: "inline-block",
                }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Interactive SVG Canvas or Empty-State Onboarding */}
      {graph.nodes.length === 0 ? (
        <div
          style={{
            width: "100%",
            background: "var(--bg-2)",
            border: "1px dashed var(--border-bright)",
            borderRadius: 16,
            padding: "48px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "rgba(56,189,248,0.12)",
              border: "1px solid rgba(56,189,248,0.3)",
              color: "#38bdf8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GitBranch size={24} />
          </div>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "var(--text-1)",
              letterSpacing: -0.3,
              maxWidth: 520,
            }}
          >
            No Seeded Modules — Your DAG Builds From Your Inputs
          </h3>
          <p
            style={{
              fontSize: 13.5,
              color: "var(--text-2)",
              lineHeight: 1.6,
              maxWidth: 580,
            }}
          >
            Upload an exam question photo or paste a problem in Exam Trap
            Triage, or import your lecture notes/slides. Gemmate will extract
            the prerequisite chain, hidden traps, and build your interactive
            Knowledge DAG automatically.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginTop: 8,
            }}
          >
            {onGoToTriage && (
              <button
                type="button"
                onClick={onGoToTriage}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "11px 18px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg,#38bdf8,#818cf8)",
                  border: "none",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 18px rgba(56,189,248,0.28)",
                }}
              >
                <span>⚡ Triage Exam Question ➔ Auto-Build DAG</span>
              </button>
            )}
            {onOpenNotesUpload && (
              <button
                type="button"
                onClick={onOpenNotesUpload}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "11px 18px",
                  borderRadius: 12,
                  background: "rgba(56,189,248,0.12)",
                  border: "1px solid rgba(56,189,248,0.32)",
                  color: "#38bdf8",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <span>📄 Upload Study Notes / Slides ➔ Synthesize DAG</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            overflowX: "auto",
            background: "var(--bg-2)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "16px 12px",
          }}
        >
          <svg
            viewBox="0 0 960 460"
            style={{
              width: "100%",
              minWidth: 740,
              maxWidth: 960,
              height: "auto",
              display: "block",
              margin: "0 auto",
              overflow: "visible",
            }}
          >
            <defs>
              <marker
                id="edge-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#475569" />
              </marker>
              <marker
                id="edge-arrow-active"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
              </marker>
            </defs>

            <g transform="translate(-35, 0)">
              {/* Curved Prerequisite Edges */}
              {graph.edges.map((edge) => {
                const src = nodeMap.get(edge.source);
                const tgt = nodeMap.get(edge.target);
                if (!src || !tgt) return null;

                const isBridge = edge.id.includes("bridge");
                const isSourceMastered = src.status === "mastered";

                const x1 = src.position.x + 180;
                const y1 = src.position.y + 42;
                const x2 = tgt.position.x - 4;
                const y2 = tgt.position.y + 42;
                const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);

                const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                return (
                  <path
                    key={edge.id}
                    d={d}
                    fill="none"
                    stroke={
                      isBridge
                        ? "#38bdf8"
                        : isSourceMastered
                          ? "#4f8eff"
                          : "#253d6b"
                    }
                    strokeWidth={isBridge ? 2.2 : 1.8}
                    strokeDasharray={isBridge ? "5 4" : undefined}
                    markerEnd={
                      isBridge || isSourceMastered
                        ? "url(#edge-arrow-active)"
                        : "url(#edge-arrow)"
                    }
                  />
                );
              })}

              {/* Knowledge Nodes */}
              {graph.nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isLocked = node.status === "locked";
                const st = STATUS_STYLE_MAP[node.status];
                const borderColor = node.isBridgeNode ? "#38bdf8" : st.border;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.position.x}, ${node.position.y})`}
                    onClick={() => onSelectNode(node)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    style={{ cursor: isLocked ? "pointer" : "pointer" }}
                  >
                    <foreignObject
                      width="180"
                      height="84"
                      style={{ overflow: "visible" }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          padding: "12px 14px",
                          borderRadius: 14,
                          background: "var(--surface-2)",
                          border: isSelected
                            ? `2px solid ${node.isBridgeNode ? "#38bdf8" : "#38bdf8"}`
                            : node.isBridgeNode
                              ? "1.5px dashed #38bdf8"
                              : `1.5px solid ${borderColor}`,
                          boxShadow: isSelected
                            ? "0 0 22px rgba(56,189,248,0.28)"
                            : isHovered
                              ? "0 6px 18px rgba(0,0,0,0.45)"
                              : "0 2px 10px rgba(0,0,0,0.25)",
                          opacity: isLocked && !isSelected ? 0.65 : 1,
                          transform:
                            isSelected || isHovered
                              ? "translateY(-1px)"
                              : "none",
                          transition: "all 0.18s ease",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          boxSizing: "border-box",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "var(--text-3)",
                              textTransform: "uppercase",
                              letterSpacing: 0.6,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 120,
                            }}
                          >
                            {node.isBridgeNode ? "Bridge" : node.category}
                          </span>
                          {renderStatusIcon(node)}
                        </div>

                        <div
                          style={{
                            fontSize: 12.5,
                            fontWeight: 700,
                            color:
                              isHovered || isSelected
                                ? "#38bdf8"
                                : "var(--text-1)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            lineHeight: 1.25,
                          }}
                        >
                          {node.title}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 999,
                              background: "var(--border)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${node.masteryScore}%`,
                                height: "100%",
                                borderRadius: 999,
                                background: st.barColor,
                                transition: "width 0.3s ease",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: "var(--text-2)",
                              fontFamily: "monospace",
                            }}
                          >
                            {node.masteryScore}%
                          </span>
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div
          style={{
            marginTop: 20,
            padding: "18px 20px",
            borderRadius: 16,
            background: "var(--surface-2)",
            border: "1px solid var(--border-bright)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
          }}
        >
          <div style={{ flex: "1 1 380px", minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "rgba(56,189,248,0.12)",
                  border: "1px solid rgba(56,189,248,0.28)",
                  color: "#38bdf8",
                }}
              >
                {selectedNode.category}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                Status:{" "}
                <strong
                  style={{
                    color: "var(--text-1)",
                    textTransform: "capitalize",
                  }}
                >
                  {selectedNode.status.replace("_", " ")}
                </strong>
              </span>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                Mastery:{" "}
                <strong style={{ color: "#38bdf8", fontFamily: "monospace" }}>
                  {selectedNode.masteryScore}%
                </strong>
              </span>
              {typeof selectedNode.retentionDecay === "number" &&
                selectedNode.masteryScore > 0 && (
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                    Retention:{" "}
                    <strong
                      style={{
                        color:
                          selectedNode.retentionDecay < 0.65
                            ? "#fbbf24"
                            : "#34d399",
                        fontFamily: "monospace",
                      }}
                    >
                      {Math.round(selectedNode.retentionDecay * 100)}%
                    </strong>
                  </span>
                )}
            </div>

            <h3
              style={{
                fontSize: 16.5,
                fontWeight: 800,
                color: "var(--text-1)",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {selectedNode.title}
              {selectedNode.isBridgeNode && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background: "rgba(56,189,248,0.14)",
                    border: "1px solid rgba(56,189,248,0.3)",
                    color: "#38bdf8",
                  }}
                >
                  Adaptive Remedial Bridge
                </span>
              )}
            </h3>

            <p
              style={{
                fontSize: 13,
                color: "var(--text-2)",
                marginTop: 6,
                lineHeight: 1.55,
              }}
            >
              {selectedNode.description}
            </p>

            {/* Known Traps */}
            {selectedNode.activeTraps.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--text-3)",
                  }}
                >
                  Known Traps:
                </span>
                {selectedNode.activeTraps.map((trap, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: "rgba(248,113,113,0.1)",
                      border: "1px solid rgba(248,113,113,0.25)",
                      color: "#f87171",
                    }}
                  >
                    ⚠️ {trap}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => onStartSocratic(selectedNode)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 16px",
                borderRadius: 11,
                background: "linear-gradient(135deg,#38bdf8,#818cf8)",
                border: "none",
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(56,189,248,0.28)",
              }}
            >
              <Play size={14} style={{ fill: "#fff" }} />
              <span>Socratic Coach</span>
            </button>

            <button
              type="button"
              onClick={() => onStartDrill(selectedNode)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "10px 16px",
                borderRadius: 11,
                background: "var(--surface-3)",
                border: "1px solid var(--border-bright)",
                color: "var(--text-1)",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Target size={14} style={{ color: "#fbbf24" }} />
              <span>Practice Drill</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectNode(null)}
              aria-label="Close node details"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
                borderRadius: 10,
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-3)",
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
