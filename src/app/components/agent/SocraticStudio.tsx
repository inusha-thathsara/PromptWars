"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  KnowledgeNode,
  SocraticMessage,
  AnalogyBackground,
  DiagnosticEvaluation,
  DiagnosticContext,
} from "@/types/agent";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import VoiceButton from "../VoiceButton";
import {
  Send,
  Sparkles,
  Lightbulb,
  Search,
  Swords,
  Bot,
  User,
  Loader2,
} from "lucide-react";

interface SocraticStudioProps {
  node: KnowledgeNode | null;
  analogyBackground: AnalogyBackground;
  onDiagnosticResult?: (
    evalResult: DiagnosticEvaluation,
    context: DiagnosticContext,
  ) => void;
  initialQuestion?: string;
  onGoToTriage?: () => void;
  onOpenNotesUpload?: () => void;
}

export default function SocraticStudio({
  node,
  analogyBackground,
  onDiagnosticResult,
  initialQuestion,
  onGoToTriage,
  onOpenNotesUpload,
}: SocraticStudioProps) {
  const [messages, setMessages] = useState<SocraticMessage[]>(() =>
    node
      ? [
          {
            id: "welcome",
            role: "assistant",
            content: `Hello! I'm your Socratic Coach for **${node.title}**.

I'm here to help you deconstruct exam traps and build deep structural intuition. I will **never give away the answer**—instead, I'll guide your thinking through analogies from **${analogyBackground}**.

${
  initialQuestion
    ? `Here is the challenge we are exploring:\n\n> ${initialQuestion}\n\nWhere would you begin your attack plan?`
    : `What aspect of **${node.title}** or its known traps (${node.activeTraps.join(", ")}) would you like to explore?`
}`,
            timestamp: "Just now",
            hintLevel: 1,
          },
        ]
      : [],
  );

  const [inputText, setInputText] = useState("");
  const [hintLevel, setHintLevel] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticCard, setDiagnosticCard] =
    useState<DiagnosticEvaluation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const nodeId = node?.id;
  const nodeTitle = node?.title;
  const nodeTrapsJoined = node?.activeTraps.join(", ") || "";

  // Reset welcome prompt if user switches nodes from the DAG
  useEffect(() => {
    if (!nodeId || !nodeTitle) {
      setMessages([]);
      setDiagnosticCard(null);
      return;
    }
    setMessages([
      {
        id: `welcome-${nodeId}`,
        role: "assistant",
        content: `Hello! I'm your Socratic Coach for **${nodeTitle}**.

I'm here to help you deconstruct exam traps and build deep structural intuition. I will **never give away the answer**—instead, I'll guide your thinking through analogies from **${analogyBackground}**.

${
  initialQuestion
    ? `Here is the challenge we are exploring:\n\n> ${initialQuestion}\n\nWhere would you begin your attack plan?`
    : `What aspect of **${nodeTitle}** or its known traps (${nodeTrapsJoined}) would you like to explore?`
}`,
        timestamp: "Just now",
        hintLevel: 1,
      },
    ]);
    setDiagnosticCard(null);
  }, [nodeId, nodeTitle, nodeTrapsJoined, analogyBackground, initialQuestion]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, diagnosticCard]);

  if (!node) {
    return (
      <div
        className="noise"
        style={{
          width: "100%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: "56px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 14,
          boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 16,
            background: "linear-gradient(135deg,#38bdf8,#818cf8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            boxShadow: "0 0 22px rgba(56,189,248,0.35)",
          }}
        >
          <Bot size={26} />
        </div>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "var(--text-1)",
            letterSpacing: -0.3,
          }}
        >
          Your Socratic Studio Starts With Your Study Material
        </h3>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--text-2)",
            lineHeight: 1.6,
            maxWidth: 520,
          }}
        >
          No seeded modules are loaded. Triage an exam question or upload your
          study notes/slides first so Gemmate can coach you step by step around
          your own concepts and traps.
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
              <span>📄 Upload Study Notes</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const handleSendMessage = async (overrideText?: string) => {
    const outgoing = (overrideText ?? inputText).trim();
    if (!outgoing || isLoading) return;

    const userMsg: SocraticMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: outgoing,
      timestamp: "Just now",
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    if (!overrideText) {
      setInputText("");
    }
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent/socratic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node,
          questionContext: initialQuestion || node.description,
          conversationHistory: newHistory,
          learnerMessage: userMsg.content,
          hintLevel,
          analogyBackground,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const coachMsg: SocraticMessage = {
          id: `coach-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          timestamp: "Just now",
          hintLevel,
          domainAnalogy: data.domainAnalogyUsed,
        };
        setMessages((prev) => [...prev, coachMsg]);
      } else {
        throw new Error(data.error || "Failed to reach Socratic coach");
      }
    } catch {
      const errMsg: SocraticMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Let's focus on the invariants in **${node.title}**. What assumption might break down under boundary conditions?`,
        timestamp: "Just now",
        hintLevel,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestReasoning = async () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const candidateText = inputText.trim() || lastUserMsg?.content;

    if (!candidateText || isDiagnosing) return;

    const questionContextText = initialQuestion || node.description;
    setIsDiagnosing(true);
    try {
      const res = await fetch("/api/agent/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node,
          questionText: questionContextText,
          studentAnswer: candidateText,
          analogyBackground,
        }),
      });

      const data = await res.json();
      if (res.ok && data.evaluation) {
        setDiagnosticCard(data.evaluation);
        if (onDiagnosticResult) {
          onDiagnosticResult(data.evaluation, {
            node,
            questionText: questionContextText,
            studentAnswer: candidateText,
          });
        }
      }
    } catch (err) {
      console.error("[handleTestReasoning] error:", err);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const scaffoldingButtons: Array<{
    level: 1 | 2 | 3;
    label: string;
    title: string;
    activeColor: string;
    activeBg: string;
    activeBorder: string;
    Icon: typeof Lightbulb;
  }> = [
    {
      level: 1,
      label: "L1 Nudge",
      title: "Level 1: High-level intuition nudge",
      activeColor: "#38bdf8",
      activeBg: "rgba(56,189,248,0.16)",
      activeBorder: "rgba(56,189,248,0.4)",
      Icon: Lightbulb,
    },
    {
      level: 2,
      label: "L2 Constraint",
      title: "Level 2: Spotlight the exact boundary trap constraint",
      activeColor: "#60a5fa",
      activeBg: "rgba(96,165,250,0.16)",
      activeBorder: "rgba(96,165,250,0.4)",
      Icon: Search,
    },
    {
      level: 3,
      label: "L3 Attack",
      title: "Level 3: Structural equation/algorithm attack step",
      activeColor: "#a78bfa",
      activeBg: "rgba(167,139,250,0.16)",
      activeBorder: "rgba(167,139,250,0.4)",
      Icon: Swords,
    },
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
        minHeight: 620,
        maxHeight: 720,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          paddingBottom: 16,
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: "linear-gradient(135deg,#38bdf8,#818cf8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 0 18px rgba(56,189,248,0.35)",
              flexShrink: 0,
            }}
          >
            <Bot size={20} />
          </div>
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "var(--text-1)",
                  letterSpacing: -0.3,
                }}
              >
                {node.title}
              </h3>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(56,189,248,0.12)",
                  border: "1px solid rgba(56,189,248,0.28)",
                  color: "#38bdf8",
                }}
              >
                Analogy Lens: {analogyBackground}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>
              Multi-turn Socratic coaching without spoiling the solution
            </p>
          </div>
        </div>

        {/* 3-Stage Scaffolding Selector */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: 4,
            borderRadius: 12,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          {scaffoldingButtons.map((btn) => {
            const Icon = btn.Icon;
            const active = hintLevel === btn.level;
            return (
              <button
                key={btn.level}
                type="button"
                title={btn.title}
                onClick={() => setHintLevel(btn.level)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: active
                    ? `1px solid ${btn.activeBorder}`
                    : "1px solid transparent",
                  background: active ? btn.activeBg : "transparent",
                  color: active ? btn.activeColor : "var(--text-3)",
                  transition: "all 0.18s ease",
                }}
              >
                <Icon size={13} />
                <span>{btn.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 4px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {messages.map((m) => {
          const isCoach = m.role === "assistant";

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                justifyContent: isCoach ? "flex-start" : "flex-end",
              }}
            >
              {isCoach && (
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: "rgba(56,189,248,0.14)",
                    border: "1px solid rgba(56,189,248,0.3)",
                    color: "#38bdf8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <Bot size={16} />
                </div>
              )}

              <div
                style={{
                  maxWidth: "82%",
                  padding: "14px 18px",
                  borderRadius: 16,
                  background: isCoach
                    ? "var(--surface-2)"
                    : "linear-gradient(135deg,#2563eb,#0891b2)",
                  border: isCoach
                    ? "1px solid var(--border)"
                    : "1px solid rgba(56,189,248,0.4)",
                  color: isCoach ? "var(--text-1)" : "#ffffff",
                  boxShadow: isCoach
                    ? "0 4px 14px rgba(0,0,0,0.22)"
                    : "0 4px 18px rgba(37,99,235,0.25)",
                }}
              >
                {m.domainAnalogy && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: "rgba(56,189,248,0.12)",
                      border: "1px solid rgba(56,189,248,0.25)",
                      color: "#38bdf8",
                      fontSize: 11,
                      fontWeight: 700,
                      marginBottom: 10,
                    }}
                  >
                    <Sparkles size={12} />
                    <span>Analogy: {m.domainAnalogy}</span>
                  </div>
                )}

                <div
                  className={isCoach ? "practice-md" : ""}
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    color: isCoach ? "var(--text-2)" : "#ffffff",
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>

                {isCoach && (
                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      fontSize: 11,
                      color: "var(--text-3)",
                    }}
                  >
                    <span>Hint L{m.hintLevel || 1} Scaffolding</span>
                    <VoiceButton
                      text={m.content}
                      label="Listen"
                      accentColor="#38bdf8"
                    />
                  </div>
                )}
              </div>

              {!isCoach && (
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: "var(--accent-dim)",
                    border: "1px solid var(--border-bright)",
                    color: "#60a5fa",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <User size={16} />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: "rgba(56,189,248,0.14)",
                border: "1px solid rgba(56,189,248,0.3)",
                color: "#38bdf8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bot size={16} />
            </div>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 14,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                color: "var(--text-2)",
              }}
            >
              <Loader2
                size={14}
                className="spin"
                style={{ color: "#38bdf8" }}
              />
              <span>Socratic Coach is analyzing reasoning & analogies...</span>
            </div>
          </div>
        )}

        {/* Diagnostic Report Card */}
        {diagnosticCard && (
          <div
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: "var(--surface-2)",
              border: "1px solid rgba(56,189,248,0.35)",
              boxShadow: "0 8px 24px rgba(56,189,248,0.1)",
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
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
                    background: "rgba(56,189,248,0.16)",
                    color: "#38bdf8",
                  }}
                >
                  Cognitive Diagnostic Report
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "3px 10px",
                    borderRadius: 999,
                    background:
                      diagnosticCard.rootCauseCategory === "ExecutionSlip"
                        ? "rgba(52,211,153,0.16)"
                        : "rgba(251,191,36,0.16)",
                    color:
                      diagnosticCard.rootCauseCategory === "ExecutionSlip"
                        ? "#34d399"
                        : "#fbbf24",
                  }}
                >
                  Root Cause: {diagnosticCard.rootCauseCategory}
                </span>
              </div>

              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: 800,
                  color:
                    diagnosticCard.masteryDelta >= 0 ? "#34d399" : "#fbbf24",
                }}
              >
                {diagnosticCard.masteryDelta >= 0
                  ? `+${diagnosticCard.masteryDelta}`
                  : diagnosticCard.masteryDelta}
                % Mastery
              </span>
            </div>

            <p
              style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.55 }}
            >
              {diagnosticCard.diagnosticNotes}
            </p>

            {diagnosticCard.identifiedTrap &&
              diagnosticCard.identifiedTrap !== "None" && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "rgba(248,113,113,0.1)",
                    border: "1px solid rgba(248,113,113,0.25)",
                    color: "#f87171",
                    fontSize: 12,
                  }}
                >
                  ⚠️ <strong>Deceptive Trap Identified:</strong>{" "}
                  {diagnosticCard.identifiedTrap}
                </div>
              )}

            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                color: "#7dd3fc",
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              💡 <strong>Next Socratic Step:</strong>{" "}
              {diagnosticCard.socraticFollowUpQuestion}
            </div>

            {diagnosticCard.bridgeNodeCreated && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "rgba(56,189,248,0.12)",
                  border: "1px solid rgba(56,189,248,0.32)",
                  color: "#38bdf8",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  🌱 <strong>Remedial Bridge Generated:</strong>{" "}
                  {diagnosticCard.bridgeNodeCreated.title}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>
                  Added to DAG
                </span>
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Chips */}
      <div
        style={{
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          flexShrink: 0,
        }}
      >
        {[
          "Give me an analogy from my background",
          "What trap should I watch out for here?",
          "Test my understanding with a question",
        ].map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={isLoading}
            onClick={() => handleSendMessage(chip)}
            style={{
              padding: "5px 11px",
              borderRadius: 999,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Bottom Input Bar */}
      <div
        style={{
          paddingTop: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder={`Ask a question or explain your reasoning for ${node.title}...`}
          style={{
            flex: "1 1 260px",
            padding: "12px 16px",
            borderRadius: 12,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-1)",
            fontSize: 13.5,
            outline: "none",
          }}
        />

        <button
          type="button"
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim() || isLoading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "12px 18px",
            borderRadius: 12,
            background: "linear-gradient(135deg,#38bdf8,#4f8eff)",
            border: "none",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: !inputText.trim() || isLoading ? "not-allowed" : "pointer",
            opacity: !inputText.trim() || isLoading ? 0.5 : 1,
            boxShadow: "0 4px 16px rgba(56,189,248,0.25)",
          }}
        >
          <Send size={14} />
          <span>Send</span>
        </button>

        <button
          type="button"
          onClick={handleTestReasoning}
          disabled={isDiagnosing}
          title="Triggers the Cognitive Profiler Agent to diagnose your latest answer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "12px 18px",
            borderRadius: 12,
            background: "rgba(251,191,36,0.12)",
            border: "1px solid rgba(251,191,36,0.3)",
            color: "#fbbf24",
            fontSize: 13,
            fontWeight: 700,
            cursor: isDiagnosing ? "not-allowed" : "pointer",
          }}
        >
          {isDiagnosing ? (
            <Loader2 size={14} className="spin" />
          ) : (
            <Sparkles size={14} />
          )}
          <span>Diagnose Reasoning</span>
        </button>
      </div>
    </div>
  );
}
