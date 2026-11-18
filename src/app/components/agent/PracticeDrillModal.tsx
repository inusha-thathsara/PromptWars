"use client";

import React, { useState } from "react";
import {
  DrillProblem,
  KnowledgeNode,
  DiagnosticEvaluation,
  DiagnosticContext,
  AnalogyBackground,
} from "@/types/agent";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  X,
  Sparkles,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
} from "lucide-react";

interface PracticeDrillModalProps {
  drill: DrillProblem;
  node: KnowledgeNode;
  analogyBackground: AnalogyBackground;
  onClose: () => void;
  onEvaluationCompleted: (
    evalResult: DiagnosticEvaluation,
    context: DiagnosticContext,
  ) => void;
}

export default function PracticeDrillModal({
  drill,
  node,
  analogyBackground,
  onClose,
  onEvaluationCompleted,
}: PracticeDrillModalProps) {
  const [studentAnswer, setStudentAnswer] = useState("");
  const [activeHintLevel, setActiveHintLevel] = useState<0 | 1 | 2 | 3>(0);
  const [showAttackPlan, setShowAttackPlan] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<DiagnosticEvaluation | null>(
    null,
  );

  const handleSubmit = async () => {
    if (!studentAnswer.trim() || isEvaluating) return;

    setIsEvaluating(true);
    try {
      const res = await fetch("/api/agent/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node,
          questionText: drill.questionText,
          studentAnswer,
          analogyBackground,
        }),
      });

      const data = await res.json();
      if (res.ok && data.evaluation) {
        setEvaluation(data.evaluation);
        onEvaluationCompleted(data.evaluation, {
          node,
          questionText: drill.questionText,
          studentAnswer,
        });
      }
    } catch (err) {
      console.error("[PracticeDrillModal] error:", err);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(5,7,15,0.82)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-bright)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 760,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.65)",
          display: "flex",
          flexDirection: "column",
          padding: "24px",
          gap: 18,
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            paddingBottom: 16,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
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
                  fontSize: 10.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "rgba(56,189,248,0.12)",
                  border: "1px solid rgba(56,189,248,0.28)",
                  color: "#38bdf8",
                }}
              >
                Targeted Practice Drill
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#f87171",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ShieldAlert size={14} />
                Target Trap: {drill.targetTraps.join(", ")}
              </span>
            </div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "var(--text-1)",
                letterSpacing: -0.3,
              }}
            >
              {drill.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drill modal"
            style={{
              padding: 8,
              borderRadius: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Question Prompt */}
        <div
          className="practice-md"
          style={{
            padding: "18px 20px",
            borderRadius: 14,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {drill.questionText}
          </ReactMarkdown>
        </div>

        {/* Progressive Hints Accordion */}
        <div
          style={{
            padding: "16px 18px",
            borderRadius: 14,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--text-1)",
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Sparkles size={14} style={{ color: "#38bdf8" }} />
              Socratic Scaffolding Hints:
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {[
                { lvl: 1 as const, label: "L1 Nudge", color: "#38bdf8" },
                { lvl: 2 as const, label: "L2 Constraint", color: "#60a5fa" },
                { lvl: 3 as const, label: "L3 Attack Step", color: "#a78bfa" },
              ].map((h) => {
                const active = activeHintLevel === h.lvl;
                return (
                  <button
                    key={h.lvl}
                    type="button"
                    onClick={() => setActiveHintLevel(active ? 0 : h.lvl)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: active
                        ? `1px solid ${h.color}`
                        : "1px solid var(--border)",
                      background: active ? "var(--surface-3)" : "var(--bg-2)",
                      color: active ? h.color : "var(--text-2)",
                    }}
                  >
                    {h.label}
                  </button>
                );
              })}
            </div>
          </div>

          {activeHintLevel === 1 && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(56,189,248,0.1)",
                border: "1px solid rgba(56,189,248,0.28)",
                color: "#7dd3fc",
                fontSize: 12.5,
              }}
            >
              💡 <strong>Level 1 Nudge:</strong> {drill.hintL1}
            </div>
          )}
          {activeHintLevel === 2 && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(79,142,255,0.12)",
                border: "1px solid rgba(79,142,255,0.3)",
                color: "#93c5fd",
                fontSize: 12.5,
              }}
            >
              🔍 <strong>Level 2 Constraint Spotlight:</strong> {drill.hintL2}
            </div>
          )}
          {activeHintLevel === 3 && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(167,139,250,0.12)",
                border: "1px solid rgba(167,139,250,0.3)",
                color: "#c4b5fd",
                fontSize: 12.5,
              }}
            >
              ⚔️ <strong>Level 3 Attack Step:</strong> {drill.hintL3}
            </div>
          )}
        </div>

        {/* Collapsible Attack Plan */}
        <div
          style={{
            borderRadius: 14,
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setShowAttackPlan(!showAttackPlan)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "var(--surface-2)",
              border: "none",
              color: "var(--text-1)",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <span>View Deconstructed Attack Strategy &amp; Trap Analysis</span>
            {showAttackPlan ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>

          {showAttackPlan && (
            <div
              style={{
                padding: "16px 18px",
                background: "var(--bg-2)",
                borderTop: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                fontSize: 12.5,
              }}
            >
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: "rgba(248,113,113,0.1)",
                  border: "1px solid rgba(248,113,113,0.25)",
                  color: "#f87171",
                }}
              >
                ⚠️ <strong>The Trap:</strong> {drill.theTrap}
              </div>

              <div>
                <h4
                  style={{
                    fontWeight: 700,
                    color: "var(--text-1)",
                    marginBottom: 8,
                  }}
                >
                  Sequential Attack Plan:
                </h4>
                <ol
                  style={{
                    paddingLeft: 18,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    color: "var(--text-2)",
                  }}
                >
                  {drill.attackPlan.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Student Answer & Reasoning */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <label
              style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}
            >
              Your Answer &amp; Reasoning:
            </label>
            <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
              Explain your working to receive a cognitive diagnostic
            </span>
          </div>

          <textarea
            rows={4}
            value={studentAnswer}
            onChange={(e) => setStudentAnswer(e.target.value)}
            placeholder="State your answer and how you addressed the boundary edge cases..."
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-1)",
              fontSize: 13.5,
              lineHeight: 1.55,
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Diagnostic Result */}
        {evaluation && (
          <div
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: "var(--surface-2)",
              border: "1px solid rgba(56,189,248,0.4)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: evaluation.isCorrectOrSubstantial
                      ? "rgba(52,211,153,0.16)"
                      : "rgba(251,191,36,0.16)",
                    color: evaluation.isCorrectOrSubstantial
                      ? "#34d399"
                      : "#fbbf24",
                  }}
                >
                  {evaluation.isCorrectOrSubstantial
                    ? "Mastery Reinforced"
                    : "Misconception Detected"}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>
                  Category:{" "}
                  <strong style={{ color: "var(--text-1)" }}>
                    {evaluation.rootCauseCategory}
                  </strong>
                </span>
              </div>

              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 14,
                  fontWeight: 800,
                  color: evaluation.masteryDelta >= 0 ? "#34d399" : "#fbbf24",
                }}
              >
                {evaluation.masteryDelta >= 0
                  ? `+${evaluation.masteryDelta}`
                  : evaluation.masteryDelta}
                %
              </span>
            </div>

            <p
              style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}
            >
              {evaluation.diagnosticNotes}
            </p>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                color: "#7dd3fc",
                fontSize: 12.5,
              }}
            >
              💡 <strong>Socratic Reflection:</strong>{" "}
              {evaluation.socraticFollowUpQuestion}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div
          style={{
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 18px",
              borderRadius: 11,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!studentAnswer.trim() || isEvaluating}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 11,
              background: "linear-gradient(135deg,#38bdf8,#818cf8)",
              border: "none",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor:
                !studentAnswer.trim() || isEvaluating
                  ? "not-allowed"
                  : "pointer",
              opacity: !studentAnswer.trim() || isEvaluating ? 0.5 : 1,
              boxShadow: "0 4px 16px rgba(56,189,248,0.28)",
            }}
          >
            {isEvaluating ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Send size={15} />
            )}
            <span>Evaluate &amp; Update Knowledge DAG</span>
          </button>
        </div>
      </div>
    </div>
  );
}
