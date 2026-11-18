"use client";

import React from "react";
import { LearnerProfile, KnowledgeGraph, KnowledgeNode } from "@/types/agent";
import { ShieldAlert, Target, Brain, History, Zap } from "lucide-react";

interface TrapRadarViewProps {
  profile: LearnerProfile;
  activeGraph: KnowledgeGraph;
  onSynthesizeDrillForTrap: (trapName: string) => void;
  onSelectNodeForReview?: (node: KnowledgeNode) => void;
  onGoToTriage?: () => void;
  onOpenNotesUpload?: () => void;
}

export default function TrapRadarView({
  profile,
  activeGraph,
  onSynthesizeDrillForTrap,
  onSelectNodeForReview,
  onGoToTriage,
  onOpenNotesUpload,
}: TrapRadarViewProps) {
  const traps = Object.entries(profile.trapTendencies).sort(
    ([, a], [, b]) => b - a,
  );
  const maxCount = Math.max(...traps.map(([, count]) => count), 1);

  const nodesNeedingReview = activeGraph.nodes.filter(
    (n) =>
      n.status === "needs_review" ||
      (typeof n.retentionDecay === "number" &&
        n.retentionDecay < 0.65 &&
        n.masteryScore > 0),
  );

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "20px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#f87171",
              marginBottom: 8,
            }}
          >
            <ShieldAlert size={16} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.7,
              }}
            >
              Top Vulnerability
            </span>
          </div>
          <div
            style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)" }}
          >
            {traps[0]?.[0] || "None Detected"}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6 }}>
            {traps[0]
              ? `Tripped ${traps[0][1]} ${traps[0][1] === 1 ? "time" : "times"} during boundary tests`
              : "No recurring trap slips recorded yet"}
          </p>
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "20px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#38bdf8",
              marginBottom: 8,
            }}
          >
            <Brain size={16} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.7,
              }}
            >
              Diagnostic Root Cause
            </span>
          </div>
          <div
            style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)" }}
          >
            {profile.recentMisconceptions[0]?.rootCauseCategory ||
              "No Errors Logged"}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6 }}>
            Primary error archetype in recent evaluations
          </p>
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "20px 24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#fbbf24",
              marginBottom: 8,
            }}
          >
            <Zap size={16} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.7,
              }}
            >
              Retention Health
            </span>
          </div>
          <div
            style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)" }}
          >
            {nodesNeedingReview.length}{" "}
            {nodesNeedingReview.length === 1
              ? "Node Needs Review"
              : "Nodes Need Review"}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 6 }}>
            {activeGraph.domain
              ? `Live Ebbinghaus decay across ${activeGraph.domain}`
              : "Live Ebbinghaus decay across your uploaded study inputs"}
          </p>

          {nodesNeedingReview.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 10,
              }}
            >
              {nodesNeedingReview.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => onSelectNodeForReview?.(node)}
                  style={{
                    padding: "4px 9px",
                    borderRadius: 8,
                    background: "rgba(251,191,36,0.12)",
                    border: "1px solid rgba(251,191,36,0.3)",
                    color: "#fbbf24",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: onSelectNodeForReview ? "pointer" : "default",
                  }}
                >
                  ↻ {node.title}
                  {typeof node.retentionDecay === "number"
                    ? ` (${Math.round(node.retentionDecay * 100)}%)`
                    : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trap Vulnerability Matrix */}
      <div
        className="noise"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: "20px 24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            paddingBottom: 14,
            marginBottom: 16,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h3
            style={{
              fontSize: 16.5,
              fontWeight: 800,
              color: "var(--text-1)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ShieldAlert size={17} style={{ color: "#f87171" }} />
            <span>Cognitive Trap Vulnerability Matrix</span>
          </h3>
          <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
            Tracks recurring cognitive blind spots to generate targeted
            counter-drills.
          </p>
        </div>

        {traps.length === 0 ? (
          <div
            style={{
              padding: "28px 24px",
              borderRadius: 14,
              background: "var(--surface-2)",
              border: "1px dashed var(--border)",
              textAlign: "center",
              fontSize: 13,
              color: "var(--text-2)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            <p style={{ maxWidth: 520, lineHeight: 1.6 }}>
              No cognitive traps recorded yet. Triage an exam question, upload
              your study notes, or diagnose your reasoning in Socratic Studio to
              populate your matrix.
            </p>
            {(onGoToTriage || onOpenNotesUpload) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                {onGoToTriage && (
                  <button
                    type="button"
                    onClick={onGoToTriage}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "9px 16px",
                      borderRadius: 11,
                      background: "linear-gradient(135deg,#38bdf8,#818cf8)",
                      border: "none",
                      color: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <span>⚡ Triage an Exam Question</span>
                  </button>
                )}
                {onOpenNotesUpload && (
                  <button
                    type="button"
                    onClick={onOpenNotesUpload}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "9px 16px",
                      borderRadius: 11,
                      background: "rgba(56,189,248,0.12)",
                      border: "1px solid rgba(56,189,248,0.3)",
                      color: "#38bdf8",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <span>📄 Upload Study Notes</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {traps.map(([trapName, count]) => {
              const percentage = Math.round((count / maxCount) * 100);

              return (
                <div
                  key={trapName}
                  style={{
                    padding: "16px 18px",
                    borderRadius: 14,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div style={{ flex: "1 1 280px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: "var(--text-1)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#f87171",
                          }}
                        />
                        {trapName}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: "monospace",
                          fontWeight: 700,
                          color: "#f87171",
                        }}
                      >
                        {count} {count === 1 ? "slip" : "slips"}
                      </span>
                    </div>

                    <div
                      style={{
                        width: "100%",
                        height: 8,
                        borderRadius: 999,
                        background: "var(--surface-3)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: "linear-gradient(90deg,#f87171,#fbbf24)",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSynthesizeDrillForTrap(trapName)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: "rgba(56,189,248,0.12)",
                      border: "1px solid rgba(56,189,248,0.3)",
                      color: "#38bdf8",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <Target size={14} />
                    <span>Fix Trap With Drill</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Misconception Diagnostic Log */}
      <div
        className="noise"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: "20px 24px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingBottom: 14,
            marginBottom: 16,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <History size={17} style={{ color: "#38bdf8" }} />
          <h3
            style={{ fontSize: 16.5, fontWeight: 800, color: "var(--text-1)" }}
          >
            Cognitive Misconception Diagnostic Log
          </h3>
        </div>

        {profile.recentMisconceptions.length === 0 ? (
          <div
            style={{
              padding: "24px",
              borderRadius: 14,
              background: "var(--surface-2)",
              border: "1px dashed var(--border)",
              textAlign: "center",
              fontSize: 13,
              color: "var(--text-3)",
            }}
          >
            No diagnostic evaluations logged yet. Submit an answer in a Practice
            Drill or click &ldquo;Diagnose Reasoning&rdquo; in Socratic Studio
            to record cognitive insights here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {profile.recentMisconceptions.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        fontWeight: 800,
                        color: "var(--text-1)",
                        fontSize: 14,
                      }}
                    >
                      {item.nodeTitle}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {item.timestamp}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "rgba(251,191,36,0.14)",
                      border: "1px solid rgba(251,191,36,0.3)",
                      color: "#fbbf24",
                    }}
                  >
                    {item.rootCauseCategory}
                  </span>
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "var(--bg-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text-2)",
                    lineHeight: 1.5,
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      color: "var(--text-3)",
                      marginBottom: 4,
                    }}
                  >
                    Student&apos;s Submission:
                  </span>
                  &ldquo;{item.studentAttempt}&rdquo;
                </div>

                <div style={{ color: "var(--text-2)", lineHeight: 1.55 }}>
                  <strong style={{ color: "#38bdf8" }}>
                    Diagnostic Analysis:
                  </strong>{" "}
                  {item.diagnosticAnalysis}
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "rgba(56,189,248,0.1)",
                    border: "1px solid rgba(56,189,248,0.25)",
                    color: "#7dd3fc",
                    lineHeight: 1.5,
                  }}
                >
                  🌱{" "}
                  <strong style={{ color: "var(--text-1)" }}>
                    Remedial Action:
                  </strong>{" "}
                  {item.remedialAction}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
