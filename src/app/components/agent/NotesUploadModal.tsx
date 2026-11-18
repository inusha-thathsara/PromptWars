"use client";

import React, { useRef, useState } from "react";
import {
  X,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Upload,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import ImageUpload, { ImageEntry } from "../ImageUpload";
import { KnowledgeGraph } from "@/types/agent";

interface NotesUploadModalProps {
  onClose: () => void;
  onGraphCreated: (graph: KnowledgeGraph, summary?: string) => void;
}

export default function NotesUploadModal({
  onClose,
  onGraphCreated,
}: NotesUploadModalProps) {
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"text" | "image">("text");
  const [notesText, setNotesText] = useState("");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!title.trim()) {
      const baseName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]+/g, " ");
      setTitle(baseName);
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      if (content.trim()) {
        setNotesText((prev) =>
          prev.trim() ? `${prev.trim()}\n\n${content.trim()}` : content.trim(),
        );
        setError(null);
      }
    };
    reader.onerror = () => {
      setError("Could not read the selected file.");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSubmit = async () => {
    const hasText = notesText.trim().length > 0;
    const hasImages = images.length > 0;

    if (!hasText && !hasImages) {
      setError(
        "Please paste lecture notes, import a text/markdown file, or upload note photos.",
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/agent/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          notesText: hasText ? notesText.trim() : undefined,
          images: hasImages ? images.map((i) => i.base64) : undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.graph) {
        throw new Error(data?.error || "Failed to synthesize Knowledge DAG.");
      }

      onGraphCreated(data.graph, data.summary);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while building your Knowledge DAG.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      onClick={() => !isLoading && onClose()}
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
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-bright)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 680,
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
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 999,
                background: "rgba(56,189,248,0.12)",
                border: "1px solid rgba(56,189,248,0.28)",
                color: "#38bdf8",
                fontSize: 10.5,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                marginBottom: 8,
              }}
            >
              <Sparkles size={12} />
              Curriculum Synthesizer Agent
            </div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "var(--text-1)",
                letterSpacing: -0.3,
              }}
            >
              Upload Study Notes ➔ Build Custom Knowledge DAG
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 4 }}>
              Import lecture notes, Markdown files, or photos of handwritten
              slides. Gemmate extracts prerequisite concepts and hidden exam
              traps into an interactive skill graph.
            </p>
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            aria-label="Close upload modal"
            style={{
              padding: 8,
              borderRadius: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
              cursor: isLoading ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Custom Subject Title Input */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor="custom-module-title"
            style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-1)" }}
          >
            Module / Subject Title{" "}
            <span style={{ fontWeight: 400, color: "var(--text-3)" }}>
              (optional — inferred automatically if blank)
            </span>
          </label>
          <input
            id="custom-module-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isLoading}
            placeholder="e.g., Database Indexing & B-Trees"
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: 12,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-1)",
              fontSize: 13.5,
              outline: "none",
            }}
          />
        </div>

        {/* Mode Toggle */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: 4,
            borderRadius: 12,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            disabled={isLoading}
            onClick={() => setMode("text")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              padding: "9px 14px",
              borderRadius: 9,
              border: "none",
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: 700,
              background:
                mode === "text" ? "rgba(56,189,248,0.16)" : "transparent",
              color: mode === "text" ? "#38bdf8" : "var(--text-3)",
            }}
          >
            <FileText size={14} />
            <span>Paste Notes or Load File (.md / .txt)</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => setMode("image")}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              padding: "9px 14px",
              borderRadius: 9,
              border: "none",
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: 700,
              background:
                mode === "image" ? "rgba(129,140,248,0.18)" : "transparent",
              color: mode === "image" ? "#818cf8" : "var(--text-3)",
            }}
          >
            <ImageIcon size={14} />
            <span>Upload Photos of Notes / Slides</span>
          </button>
        </div>

        {/* Mode Body */}
        {mode === "text" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                Paste markdown, lecture summaries, or syllabus bullet points:
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt,.csv,.json"
                onChange={handleFileImport}
                style={{ display: "none" }}
              />
              <button
                type="button"
                disabled={isLoading}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 9,
                  background: "var(--surface-3)",
                  border: "1px solid var(--border-bright)",
                  color: "#38bdf8",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Upload size={13} />
                <span>Import .md / .txt File</span>
              </button>
            </div>

            <textarea
              rows={7}
              value={notesText}
              onChange={(e) => {
                setNotesText(e.target.value);
                if (error) setError(null);
              }}
              disabled={isLoading}
              placeholder="Paste your lecture notes, definitions, formulas, or exam topics here..."
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 14,
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                color: "var(--text-1)",
                fontSize: 13.5,
                lineHeight: 1.6,
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
        ) : (
          <div>
            <ImageUpload
              images={images}
              onImagesChange={(next) => {
                setImages(next);
                if (error) setError(null);
              }}
              disabled={isLoading}
            />
          </div>
        )}

        {/* Inline Error */}
        {error && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "#f87171",
              fontSize: 12.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions */}
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
            disabled={isLoading}
            onClick={onClose}
            style={{
              padding: "10px 18px",
              borderRadius: 11,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
              fontSize: 13,
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={handleSubmit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 20px",
              borderRadius: 11,
              background: "linear-gradient(135deg,#38bdf8,#818cf8)",
              border: "none",
              color: "#ffffff",
              fontSize: 13,
              fontWeight: 700,
              cursor: isLoading ? "wait" : "pointer",
              opacity: isLoading ? 0.75 : 1,
              boxShadow: "0 4px 18px rgba(56,189,248,0.3)",
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="spin" />
                <span>Synthesizing Knowledge DAG...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Synthesize Knowledge DAG</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
