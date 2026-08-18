"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { signOut, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  extractArtifacts,
  downloadUrl,
  iconForKind,
  kindForExt,
  type ChatArtifact,
} from "@/lib/chat-artifacts";
import { extractSources, type WebSource, type ToolEventLike } from "@/lib/chat-sources";
import { progressForTool } from "@/lib/tool-progress";

/* ─── Types ───────────────────────────────────────────────────── */
interface Attachment {
  name: string;
  path: string;
  mime?: string;
  size?: number;
  is_image?: boolean;
}

/** A tool invocation captured during a turn (for progress + sources). */
interface ToolEvent {
  name: string;
  args?: Record<string, unknown> | null;
  preview?: string | null;
  done?: boolean;
  is_error?: boolean;
}

interface ChatMessage {
  id?: string | number;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Attachment[];
  timestamp?: number;
  isStreaming?: boolean;
  /** Legacy single tool indicator (kept for backward compatibility). */
  toolCall?: {
    name: string;
    status: "running" | "completed" | "error";
  };
  /** Accumulated reasoning/thinking text for this assistant turn. */
  reasoning?: string;
  /** Whether reasoning is still actively streaming (vs finished). */
  reasoningActive?: boolean;
  /** All tool events observed during this turn (for progress + sources). */
  toolEvents?: ToolEvent[];
  /** Live progress label while the turn is doing background work. */
  progressLabel?: string;
}

interface SessionItem {
  session_id: string;
  title?: string;
  created_at?: number;
  updated_at?: number;
  message_count?: number;
}

/* ─── Text Sanitization Helpers ────────────────────────────────── */
function sanitizeText(raw: string): string {
  if (!raw) return "";

  let cleaned = raw;

  // 1. Strip <untrusted_tool_result> wrappers
  cleaned = cleaned.replace(/<untrusted_tool_result[\s\S]*?<\/untrusted_tool_result>/g, "");

  // 2. Strip system prompt injections or raw JSON tool results
  const trimmed = cleaned.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}") && (
      trimmed.includes('"success":') ||
      trimmed.includes('"processes":') ||
      trimmed.includes('"results":') ||
      trimmed.includes('"choices_offered":') ||
      trimmed.includes('"link":')
    ))
  ) {
    return ""; // Filter raw system tool output JSON objects
  }

  return cleaned;
}

/* ─── Split Thinking Steps from Response ──────────────────────── */
function splitThinkingAndResponse(content: string): { thinking: string; response: string } {
  if (!content) return { thinking: "", response: "" };

  const paragraphs = content.split(/\n\n+/);
  const thinkingParagraphs: string[] = [];
  let responseIndex = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (!p) continue;

    // A paragraph is a thinking header if it starts with one of the standard progress action verbs and is short (<= 5 words).
    const isThinkingHeader = /^(Exploring|Searching|Checking|Inspecting|Investigating|Gathering|Extracting|Conducting|Listing|Synthesizing|Analyzing|Refining|Verifying)\b/i.test(p) && p.split(/\s+/).length <= 5;
    
    // A paragraph is a thinking action if it starts with a standard active progress phrasing.
    const isThinkingAction = /^(I'm currently|I am currently|I'm now focusing|I'm now about to|I am about to|I am checking|I'm checking|My next step|My focus is|My analysis indicates|I've compiled|I am now reading|I am reading|I am verifying|I'm verifying)\b/i.test(p);

    if (isThinkingHeader || isThinkingAction) {
      thinkingParagraphs.push(p);
      responseIndex = i + 1;
    } else {
      break;
    }
  }

  const thinkingText = thinkingParagraphs.join("\n\n");
  const responseText = paragraphs.slice(responseIndex).join("\n\n");

  return {
    thinking: thinkingText,
    response: responseText
  };
}

/* ─── Nav icons for sidebar ──────────────────────────────────── */
function NavIcon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home": return <svg {...common}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" /><polyline points="9 21 9 12 15 12 15 21" /></svg>;
    case "profile": return <svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    case "chat": return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    case "setup": return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
    case "signout": return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
    default: return null;
  }
}

/* ─── Format Bytes ────────────────────────────────────────────── */
function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── Custom Markdown Parser & Renderer ────────────────────────── */
type MarkdownBlock =
  | { type: "header"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; alignments: string[]; rows: string[][] }
  | { type: "rule" }
  | { type: "file"; path: string; name: string }
  | { type: "paragraph"; text: string };

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!line && trimmed === "") {
      i++;
      continue;
    }

    // Check for MEDIA file path (attachment card)
    if (line.includes("MEDIA:/")) {
      const match = line.match(/MEDIA:(\/[^\s]+)/);
      if (match) {
        const absolutePath = match[1];
        const fileName = absolutePath.split("/").pop() || "Document.pdf";
        blocks.push({ type: "file", path: absolutePath, name: fileName });
        i++;
        continue;
      }
    }

    // Headers
    if (trimmed.startsWith("#")) {
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        blocks.push({
          type: "header",
          level: match[1].length,
          text: match[2],
        });
        i++;
        continue;
      }
    }

    // Horizontal Rules
    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    // Unordered lists
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const currentTrimmed = lines[i].trim();
        const listMatch = currentTrimmed.match(/^[-*•]\s+(.*)$/);
        if (listMatch) {
          items.push(listMatch[1]);
          i++;
        } else if (currentTrimmed === "") {
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    // Ordered lists
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length) {
        const currentTrimmed = lines[i].trim();
        const listMatch = currentTrimmed.match(/^\d+\.\s+(.*)$/);
        if (listMatch) {
          items.push(listMatch[1]);
          i++;
        } else if (currentTrimmed === "") {
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // Tables
    if (trimmed.startsWith("|")) {
      const rawHeader = line;
      const headers = rawHeader.split("|").map(s => s.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith("|") && lines[i + 1].includes("-")) {
        const separatorLine = lines[i + 1].trim();
        const columnsCount = headers.length;
        
        const alignments = separatorLine.split("|")
          .map(s => s.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
          .map(s => {
            if (s.startsWith(":") && s.endsWith(":")) return "center";
            if (s.endsWith(":")) return "right";
            return "left";
          });

        const rows: string[][] = [];
        i += 2; // skip header and separator lines

        while (i < lines.length && lines[i].trim().startsWith("|")) {
          const rowLine = lines[i].trim();
          if (rowLine.includes("-") && rowLine.includes(":")) {
            i++;
            continue;
          }
          const cells = rowLine.split("|")
            .map(s => s.trim())
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          
          while (cells.length < columnsCount) {
            cells.push("");
          }
          rows.push(cells.slice(0, columnsCount));
          i++;
        }

        blocks.push({ type: "table", headers, alignments, rows });
        continue;
      }
    }

    // Normal Paragraph
    let paragraphText = line;
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("- ") &&
      !lines[i].trim().startsWith("* ") &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("|") &&
      lines[i].trim() !== "---" &&
      lines[i].trim() !== "***" &&
      !lines[i].includes("MEDIA:/")
    ) {
      paragraphText += "\n" + lines[i];
      i++;
    }
    blocks.push({ type: "paragraph", text: paragraphText });
  }

  return blocks;
}

function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const regex = /(\[.*?\]\(.*?\)\*?|\*\*.*?\*\*|`[^`]+`)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} style={{ color: "var(--text-primary)", fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            padding: "0.15rem 0.35rem",
            borderRadius: "0.35rem",
            fontSize: "0.82rem",
            fontFamily: "ui-monospace, monospace",
            color: "var(--cyan)",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("[") && part.includes("](")) {
      const match = part.match(/\[(.*?)\]\((.*?)\)/);
      if (match) {
        const linkText = match[1];
        const linkUrl = match[2];
        return (
          <a
            key={idx}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--cyan)",
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            {linkText}
          </a>
        );
      }
    }
    return part;
  });
}

function FormattedMessage({ text, onOpenFile }: { text: string; onOpenFile?: (path: string, name: string) => void }) {
  const clean = sanitizeText(text);
  if (!clean) return null;

  const blocks = clean.split(/(```[\s\S]*?```)/g);

  return (
    <div style={{ lineHeight: 1.6, fontSize: "0.92rem", wordBreak: "break-word", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
      {blocks.map((block, idx) => {
        if (block.startsWith("```")) {
          const firstLineEnd = block.indexOf("\n");
          const language = block.slice(3, firstLineEnd > -1 ? firstLineEnd : 3).trim();
          const code = firstLineEnd > -1 ? block.slice(firstLineEnd + 1, -3) : block.slice(3, -3);

          return (
            <div key={idx} style={{ margin: "0.5rem 0", borderRadius: "0.6rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.4)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.05)", padding: "0.3rem 0.5rem 0.3rem 0.85rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.03em" }}>
                  {language ? language.toUpperCase() : "CODE"}
                </span>
                <CopyButton text={code} label="Copy" subtle />
              </div>
              <pre style={{ margin: 0, padding: "0.85rem", overflowX: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: "0.85rem", color: "#e2e8f0" }}>
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        const parsedBlocks = parseMarkdownBlocks(block);
        return parsedBlocks.map((b, bIdx) => {
          if (b.type === "header") {
            const levelStyle =
              b.level === 1
                ? { fontSize: "1.45rem", fontWeight: 800, margin: "1rem 0 0.5rem", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.25rem", color: "var(--text-primary)" }
                : b.level === 2
                ? { fontSize: "1.25rem", fontWeight: 700, margin: "0.9rem 0 0.4rem", color: "var(--text-primary)" }
                : b.level === 3
                ? { fontSize: "1.08rem", fontWeight: 700, margin: "0.8rem 0 0.35rem", color: "var(--text-primary)" }
                : { fontSize: "0.95rem", fontWeight: 700, margin: "0.7rem 0 0.3rem", color: "var(--text-primary)" };

            const Tag = `h${Math.min(b.level, 6)}` as any;
            return (
              <Tag key={bIdx} style={levelStyle}>
                {renderInlineMarkdown(b.text)}
              </Tag>
            );
          }

          if (b.type === "list") {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={bIdx} style={{ paddingLeft: "1.3rem", margin: "0.4rem 0", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {b.items.map((item, itemIdx) => (
                  <li key={itemIdx} style={{ listStyleType: b.ordered ? "decimal" : "disc", color: "var(--text-secondary)" }}>
                    {renderInlineMarkdown(item)}
                  </li>
                ))}
              </Tag>
            );
          }

          if (b.type === "table") {
            return (
              <div key={bIdx} style={{ overflowX: "auto", margin: "0.85rem 0", borderRadius: "0.5rem", border: "1px solid rgba(255,255,255,0.08)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {b.headers.map((h, hIdx) => (
                        <th key={hIdx} style={{ padding: "0.55rem 0.8rem", fontWeight: 700, textAlign: b.alignments[hIdx] as any || "left", color: "var(--text-primary)", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
                          {renderInlineMarkdown(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, rIdx) => (
                      <tr key={rIdx} style={{ borderBottom: rIdx === b.rows.length - 1 ? "none" : "1px solid rgba(255,255,255,0.04)", background: rIdx % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} style={{ padding: "0.5rem 0.8rem", textAlign: b.alignments[cIdx] as any || "left", color: "var(--text-secondary)", borderRight: "1px solid rgba(255,255,255,0.04)" }}>
                            {renderInlineMarkdown(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }

          if (b.type === "rule") {
            return <div key={bIdx} style={{ margin: "0.85rem 0", borderTop: "1px solid rgba(255,255,255,0.08)" }} />;
          }

          if (b.type === "file") {
            return (
              <div
                key={bIdx}
                role={onOpenFile ? "button" : undefined}
                tabIndex={onOpenFile ? 0 : undefined}
                onClick={onOpenFile ? () => onOpenFile(b.path, b.name) : undefined}
                onKeyDown={onOpenFile ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenFile(b.path, b.name); } } : undefined}
                style={{
                  margin: "0.85rem 0",
                  padding: "0.85rem 1.1rem",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "0.65rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  cursor: onOpenFile ? "pointer" : "default",
                  transition: "border-color 0.2s, background 0.2s",
                }}
                onMouseEnter={onOpenFile ? (e) => { e.currentTarget.style.borderColor = "rgba(0,212,255,0.5)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; } : undefined}
                onMouseLeave={onOpenFile ? (e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; } : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0 }}>
                  <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>📄</span>
                  <div style={{ textAlign: "left", minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {b.name}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                      {onOpenFile ? "Click to preview · Generated document" : "Generated Assistant Document"}
                    </div>
                  </div>
                </div>
                <a
                  href={`/api/hermes/download?path=${encodeURIComponent(b.path)}`}
                  download={b.name}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: "var(--cyan)",
                    color: "#0f172a",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    padding: "0.35rem 0.85rem",
                    borderRadius: "0.45rem",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    flexShrink: 0,
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1.0")}
                >
                  <Icon name="download" size={14} /> Download
                </a>
              </div>
            );
          }

          return (
            <p key={bIdx} style={{ margin: "0 0 0.4rem 0", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {renderInlineMarkdown(b.text)}
            </p>
          );
        });
      })}
    </div>
  );
}

/* ─── Icons (inline SVG, currentColor) ────────────────────────── */
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "sidebar": return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></svg>;
    case "plus": return <svg {...common}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
    case "edit": return <svg {...common}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
    case "files": return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
    case "close": return <svg {...common}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
    case "download": return <svg {...common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
    case "back": return <svg {...common}><polyline points="15 18 9 12 15 6" /></svg>;
    case "check": return <svg {...common}><polyline points="20 6 9 17 4 12" /></svg>;
    case "chevron": return <svg {...common}><polyline points="6 9 12 15 18 9" /></svg>;
    case "copy": return <svg {...common}><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
    case "globe": return <svg {...common}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
    case "external": return <svg {...common}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
    case "spark": return <svg {...common}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>;
    default: return null;
  }
}

/* ─── Copy hook + button (per-block and per-message) ──────────── */
function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = useCallback((text: string) => {
    const done = () => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => {
        // Fallback for non-secure contexts / older browsers.
        try {
          const ta = document.createElement("textarea");
          ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.focus(); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta);
          done();
        } catch { /* give up silently */ }
      });
    } else {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
        done();
      } catch { /* give up silently */ }
    }
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return [copied, copy];
}

function CopyButton({ text, label, subtle }: { text: string; label?: string; subtle?: boolean }) {
  const [copied, copy] = useCopy();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); copy(text); }}
      title={copied ? "Copied!" : "Copy"}
      aria-label={copied ? "Copied" : "Copy"}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.3rem",
        background: subtle ? "transparent" : "rgba(255,255,255,0.08)",
        border: subtle ? "none" : "1px solid rgba(255,255,255,0.14)",
        borderRadius: "0.4rem", padding: subtle ? "0.2rem" : "0.25rem 0.5rem",
        color: copied ? "#34d399" : "#94a3b8", fontSize: "0.72rem", fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit", transition: "color 0.15s, background 0.15s",
        lineHeight: 1,
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={14} />
      {label && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
}

/* ─── Reasoning / "thinking" collapsible block (per message) ──── */
function ReasoningBlock({ text, active, thoughtSeconds }: {
  text: string;
  active: boolean;
  thoughtSeconds?: number;
}) {
  // Expanded live while thinking; auto-collapses once the answer starts.
  const [open, setOpen] = useState(active);
  const wasActive = useRef(active);
  useEffect(() => {
    // Auto-collapse on the active -> done transition (not on manual toggles).
    // Syncing local disclosure state to the streaming `active` prop is exactly
    // the external-sync case an effect is for.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (wasActive.current && !active) setOpen(false);
    if (active) setOpen(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    wasActive.current = active;
  }, [active]);

  if (!text?.trim()) return null;

  const summary = active
    ? "Thinking…"
    : thoughtSeconds && thoughtSeconds > 0
      ? `Thought for ${thoughtSeconds}s`
      : "Show thinking";

  return (
    <div style={{ margin: "0 0 0.6rem 0", border: "1px dashed rgba(148,163,184,0.3)", borderRadius: "0.6rem", background: "rgba(148,163,184,0.06)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: "0.45rem", width: "100%",
          background: "none", border: "none", cursor: "pointer", padding: "0.45rem 0.7rem",
          color: "#94a3b8", fontSize: "0.78rem", fontWeight: 600, fontFamily: "inherit", textAlign: "left",
        }}
      >
        {active
          ? <span style={{ width: 12, height: 12, border: "2px solid #94a3b8", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
          : <span style={{ display: "flex", flexShrink: 0, transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }}><Icon name="chevron" size={14} /></span>}
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Icon name="spark" size={13} /> {summary}
        </span>
      </button>
      {open && (
        <div style={{ padding: "0.1rem 0.8rem 0.7rem 0.8rem", borderTop: "1px solid rgba(148,163,184,0.15)" }}>
          <div style={{ fontSize: "0.8rem", lineHeight: 1.55, color: "#94a3b8", whiteSpace: "pre-wrap", wordBreak: "break-word", fontStyle: "italic" }}>
            {text}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Web sources pill + expandable list (per message) ────────── */
function SourcesPanel({ sources }: { sources: WebSource[] }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  const n = sources.length;
  return (
    <div style={{ margin: "0 0 0.6rem 0" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.28)",
          borderRadius: "20px", padding: "0.25rem 0.7rem", color: "#93c5fd",
          fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <Icon name="globe" size={13} />
        <span>{`${n} source${n === 1 ? "" : "s"}`}</span>
        <span style={{ display: "flex", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}><Icon name="chevron" size={13} /></span>
      </button>
      {open && (
        <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem", borderLeft: "2px solid rgba(59,130,246,0.3)", paddingLeft: "0.7rem" }}>
          {sources.map((s, i) => (
            <a
              key={s.url + i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              title={s.url}
              style={{ display: "flex", alignItems: "center", gap: "0.45rem", textDecoration: "none", color: "#cbd5e1", fontSize: "0.78rem", padding: "0.15rem 0" }}
            >
              <span style={{ display: "flex", flexShrink: 0, color: "#64748b" }}><Icon name="external" size={13} /></span>
              <span style={{ fontWeight: 600, color: "#93c5fd", flexShrink: 0 }}>{s.domain}</span>
              <span style={{ color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label.replace(s.domain, "").replace(/^\s*—\s*/, "") || ""}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── In-thread progress indicator for background work ────────── */
function MessageProgress({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#94a3b8", fontSize: "0.85rem" }}>
      <span style={{ width: 12, height: 12, border: "2px solid #38bdf8", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
      <span>{label}</span>
    </div>
  );
}

/* ─── Chat Sidebar ────────────────────────────────────────────── */
const NAV_ITEMS = [
  { href: "/",          label: "Home",         icon: "home"    },
  { href: "/dashboard", label: "Profile",      icon: "profile" },
  { href: "/chat",      label: "AI Assistant", icon: "chat"    },
  { href: "/setup",     label: "Setup Guide",  icon: "setup"   },
];

function ChatSidebar({
  collapsed, onToggle, sessions, activeSid, loading,
  onNewChat, onSwitch, busy, user, onSignOut,
}: {
  collapsed: boolean;
  onToggle: () => void;
  sessions: SessionItem[];
  activeSid: string | null;
  loading: boolean;
  onNewChat: () => void;
  onSwitch: (sid: string) => void;
  busy: boolean;
  user?: { name?: string | null; email?: string | null } | null;
  onSignOut: () => void;
}) {
  return (
    <aside className={`chat-sidebar${collapsed ? " collapsed" : ""}`}>

      {/* ── Logo + Collapse Toggle ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", padding: collapsed ? "1rem 0" : "1rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {!collapsed && (
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.55rem", textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, borderRadius: "8px", background: "linear-gradient(135deg, #6C3AE8, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: "0.85rem", flexShrink: 0 }}>K</div>
            <span style={{ fontWeight: 700, fontSize: "1rem", color: "#f8fafc" }}>KStudy</span>
          </Link>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", padding: "0.2rem", borderRadius: "0.4rem", transition: "color 0.15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#e2e8f0")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
        >
          <Icon name="sidebar" size={20} />
        </button>
      </div>

      {/* ── New Chat Button ── */}
      <div style={{ padding: collapsed ? "0.75rem 0" : "0.75rem", display: "flex", justifyContent: "center" }}>
        <button
          onClick={onNewChat}
          disabled={busy}
          title="New chat"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            width: collapsed ? 38 : "100%", height: 38,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "0.65rem", color: "#e2e8f0", fontWeight: 600, fontSize: "0.85rem",
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1, transition: "all 0.2s",
          }}
          onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; } }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
        >
          <Icon name="plus" size={18} />
          {!collapsed && <span>New chat</span>}
        </button>
      </div>

      {/* ── Nav Items ── */}
      <div style={{ padding: collapsed ? "0.25rem 0" : "0.25rem 0.6rem", display: "flex", flexDirection: "column", gap: "0.1rem" }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/chat";
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: collapsed ? "0.6rem 0" : "0.55rem 0.75rem",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: "0.6rem", textDecoration: "none",
                color: isActive ? "#f8fafc" : "#94a3b8",
                background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                fontWeight: isActive ? 600 : 400,
                fontSize: "0.88rem", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "#e2e8f0"; } }}
              onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#94a3b8"; } }}
            >
              <span style={{ display: "flex", flexShrink: 0 }}><NavIcon name={item.icon} /></span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* ── Divider + Recents ── */}
      <div style={{ margin: collapsed ? "0.5rem 0" : "0.5rem 0.6rem", borderTop: "1px solid rgba(255,255,255,0.06)" }} />

      {!collapsed && (
        <div style={{ padding: "0 0.75rem 0.35rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#475569", letterSpacing: "0.05em", textTransform: "uppercase" }}>Recents</span>
        </div>
      )}

      {/* ── History list ── */}
      {!collapsed ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "0 0.6rem 0.75rem" }}>
          {loading ? (
            <div style={{ padding: "1.5rem 0.5rem", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>Loading…</div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: "1.5rem 0.5rem", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>No conversations yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
              {sessions.map((item) => {
                const isActive = item.session_id === activeSid;
                return (
                  <button
                    key={item.session_id}
                    onClick={() => onSwitch(item.session_id)}
                    title={item.title || "Untitled Conversation"}
                    style={{
                      textAlign: "left", padding: "0.5rem 0.75rem", borderRadius: "0.5rem",
                      background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                      border: "none",
                      cursor: isActive ? "default" : "pointer", transition: "all 0.15s", width: "100%",
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ fontWeight: isActive ? 600 : 400, fontSize: "0.84rem", color: isActive ? "#f8fafc" : "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.title || "Untitled Conversation"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      {/* ── User Avatar at Bottom ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: collapsed ? "0.75rem 0" : "0.75rem 0.85rem", display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: collapsed ? "center" : "flex-start" }}>
        {/* Avatar circle */}
        <div
          title={user?.name || user?.email || "User"}
          style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #6C3AE8, #00D4FF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: "0.85rem", color: "#fff", cursor: "default",
          }}
        >
          {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.83rem", fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.name || user?.email || "Student User"}
            </div>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onSignOut}
            title="Sign out"
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", display: "flex", padding: "0.2rem", borderRadius: "0.35rem", transition: "color 0.15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
          >
            <NavIcon name="signout" />
          </button>
        )}
      </div>
    </aside>
  );
}

/* ─── Editable Chat Title ─────────────────────────────────────── */
function ChatTitle({ title, onRename, saving }: {
  title: string;
  onRename: (next: string) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const startEditing = () => { setDraft(title); setEditing(true); };

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== title) onRename(next);
    else setDraft(title);
  };

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: 1, minWidth: 0 }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { setDraft(title); setEditing(false); }
          }}
          onBlur={commit}
          maxLength={200}
          style={{
            flex: 1, minWidth: 0, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(99,102,241,0.5)",
            borderRadius: "0.5rem", padding: "0.3rem 0.6rem", color: "#f8fafc", fontSize: "1rem",
            fontWeight: 700, fontFamily: "inherit", outline: "none",
          }}
        />
        <button onClick={commit} title="Save title" style={{ background: "none", border: "none", color: "#34d399", cursor: "pointer", display: "flex", padding: "0.2rem" }}>
          <Icon name="check" size={18} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startEditing}
      title="Rename conversation"
      style={{
        display: "flex", alignItems: "center", gap: "0.45rem", background: "none", border: "none",
        cursor: "pointer", padding: 0, minWidth: 0, maxWidth: "100%", color: "inherit", fontFamily: "inherit",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "42vw" }}>
        {title || "New Conversation"}
      </h1>
      <span style={{ color: saving ? "#64748b" : "#64748b", display: "flex", flexShrink: 0 }}>
        {saving
          ? <span style={{ width: 12, height: 12, border: "2px solid #64748b", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
          : <Icon name="edit" size={15} />}
      </span>
    </button>
  );
}

/* ─── Files / Artifacts Panel ─────────────────────────────────── */
function FilesPanel({ artifacts, onClose, initialPreview }: {
  artifacts: ChatArtifact[];
  onClose: () => void;
  initialPreview?: ChatArtifact | null;
}) {
  const [preview, setPreview] = useState<ChatArtifact | null>(initialPreview ?? null);

  // When opened targeting a specific file (from an inline card), jump to it.
  useEffect(() => {
    // Sync the preview target to the controlling prop from the parent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialPreview) setPreview(initialPreview);
  }, [initialPreview]);

  return (
    <div className="chat-files-panel">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {preview && (
            <button onClick={() => setPreview(null)} title="Back to files" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", padding: "0.15rem" }}>
              <Icon name="back" size={18} />
            </button>
          )}
          <span style={{ color: "#cbd5e1", display: "flex" }}><Icon name="files" size={18} /></span>
          <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>
            {preview ? preview.name : `Files (${artifacts.length})`}
          </span>
        </div>
        <button onClick={onClose} title="Close panel" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", padding: "0.15rem" }}>
          <Icon name="close" size={18} />
        </button>
      </div>

      {/* Body: list OR preview */}
      {!preview ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
          {artifacts.length === 0 ? (
            <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🗂️</div>
              <p style={{ fontSize: "0.85rem", margin: 0, lineHeight: 1.5 }}>
                No files yet. Documents you upload or that Hermes generates in this
                conversation will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {artifacts.map((a) => (
                <div
                  key={a.path}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.7rem 0.8rem",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "0.7rem",
                  }}
                >
                  <span style={{ fontSize: "1.35rem", flexShrink: 0 }}>{iconForKind(a.kind)}</span>
                  <button
                    onClick={() => setPreview(a)}
                    style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.83rem", color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                    <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.15rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      {a.ext || a.kind}{a.source === "assistant" ? " · generated" : " · uploaded"}{a.size ? ` · ${formatBytes(a.size)}` : ""}
                    </div>
                  </button>
                  <a
                    href={downloadUrl(a.path)}
                    download={a.name}
                    title="Download"
                    style={{ color: "#94a3b8", display: "flex", flexShrink: 0, padding: "0.3rem" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#00D4FF")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                  >
                    <Icon name="download" size={17} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: 1, overflow: "auto", background: "rgba(0,0,0,0.25)" }}>
            {preview.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={downloadUrl(preview.path)} alt={preview.name} style={{ width: "100%", height: "auto", display: "block" }} />
            ) : preview.kind === "pdf" ? (
              <iframe src={downloadUrl(preview.path)} title={preview.name} style={{ width: "100%", height: "100%", border: "none", minHeight: 480 }} />
            ) : preview.kind === "text" || preview.kind === "data" ? (
              <iframe src={downloadUrl(preview.path)} title={preview.name} style={{ width: "100%", height: "100%", border: "none", minHeight: 480, background: "#0b1020" }} />
            ) : (
              <div style={{ padding: "2.5rem 1.5rem", textAlign: "center", color: "#94a3b8" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>{iconForKind(preview.kind)}</div>
                <p style={{ fontSize: "0.85rem", margin: "0 0 1rem 0", lineHeight: 1.5 }}>
                  Inline preview isn&apos;t available for <strong style={{ color: "#e2e8f0" }}>{preview.ext.toUpperCase()}</strong> files. Download to view it.
                </p>
              </div>
            )}
          </div>
          {/* Preview footer: download */}
          <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <a
              href={downloadUrl(preview.path)}
              download={preview.name}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                background: "var(--cyan)", color: "#0f172a", fontWeight: 700, fontSize: "0.85rem",
                padding: "0.6rem", borderRadius: "0.6rem", textDecoration: "none",
              }}
            >
              <Icon name="download" size={17} /> Download {preview.name}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Hermes Custom Chat Page ────────────────────────────── */
export default function HermesChatPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Chat history + layout state
  const [sessionList, setSessionList] = useState<SessionItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Title state
  const [chatTitle, setChatTitle] = useState<string>("");
  const [titleSaving, setTitleSaving] = useState(false);

  // File preview target (set when an inline file card is clicked; opens the panel to that file).
  const [filePreview, setFilePreview] = useState<ChatArtifact | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasInitializedRef = useRef(false);
  const autoTitledRef = useRef(false);

  // Auto-resize textarea: grow with content up to 20 lines, then scroll.
  const MAX_TEXTAREA_HEIGHT = 20 * 1.6 * 14.88; // 20 lines × lineHeight 1.6 × 0.93rem≈14.88px ≈ 476px
  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT) + "px";
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, [MAX_TEXTAREA_HEIGHT]);

  const user = session?.user;

  // Derived artifacts for the Files panel
  const artifacts = extractArtifacts(messages);

  // Open the Files panel previewing a specific file (from an inline card click).
  const openFileByPath = useCallback((path: string, name: string) => {
    const found = artifacts.find((a) => a.path === path);
    if (found) {
      setFilePreview(found);
      return;
    }
    // Synthesize an artifact when the file isn't in the derived list yet.
    const ext = (name.split(".").pop() || "").toLowerCase();
    const kind = kindForExt(ext);
    setFilePreview({ path, name, ext, kind, source: "assistant" });
  }, [artifacts]);

  /* ── Persisted sidebar toggle ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("kstudy_sidebar_collapsed");
    // Post-mount localStorage read (can't run during SSR/render without a
    // hydration mismatch), so setState-in-effect is the correct pattern here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "1") setSidebarCollapsed(true);
    // Default-collapse on narrow screens.
    if (saved === null && window.innerWidth <= 768) setSidebarCollapsed(true);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setMobileSidebarOpen((v) => !v);
      return;
    }
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("kstudy_sidebar_collapsed", next ? "1" : "0");
      }
      return next;
    });
  }, []);

  const prevMessagesLengthRef = useRef(messages.length);

  // Auto-scroll to bottom of message list locally in container (keeps mobile header fixed)
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  useEffect(() => {
    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;
    scrollToBottom(isNewMessage ? "smooth" : "instant");
  }, [messages, scrollToBottom]);

  // Fetch session history list
  const fetchSessionList = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/hermes/session/list");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.sessions)) {
          setSessionList(data.sessions);
        }
      }
    } catch (err) {
      console.error("[KStudy Chat] Error fetching session list:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Load the list once on mount (sidebar is persistent now)
  useEffect(() => {
    // Standard fetch-on-mount to populate the sidebar; safe to setState here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session?.user) fetchSessionList();
  }, [session, fetchSessionList]);

  // Keep the title in sync with the active session's entry in the list
  const titleForSid = useCallback((sid: string | null): string => {
    if (!sid) return "";
    const found = sessionList.find((s) => s.session_id === sid);
    return found?.title || "";
  }, [sessionList]);

  useEffect(() => {
    // Adopt the server-side title once it appears in the fetched list (e.g. a
    // switched-to session or a backend-regenerated title). External-data sync.
    const t = titleForSid(sessionId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t) setChatTitle((cur) => (cur === t ? cur : t));
  }, [sessionId, titleForSid]);

  // Switch to a chosen past session
  const handleSwitchSession = async (targetSid: string) => {
    if (isStreaming || isUploading || targetSid === sessionId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      setStatusMessage("Loading conversation...");
      const res = await fetch(`/api/hermes/session?session_id=${encodeURIComponent(targetSid)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setSessionId(data.session.session_id);
          autoTitledRef.current = true; // existing session already has (or doesn't need) a title
          if (typeof window !== "undefined") {
            localStorage.setItem("kstudy_chat_sid", data.session.session_id);
          }
          setMessages(Array.isArray(data.session.messages) ? data.session.messages : []);
          setChatTitle(data.session.title || titleForSid(data.session.session_id) || "");
          setMobileSidebarOpen(false);
          setFilesOpen(false);
        }
      }
    } catch (err) {
      console.error("[KStudy Chat] Error switching session:", err);
    } finally {
      setStatusMessage(null);
    }
  };

  // Load or create a session for the user ONCE
  const initSession = useCallback(async () => {
    try {
      setStatusMessage("Connecting to Hermes AI Assistant...");
      const savedSid = typeof window !== "undefined" ? localStorage.getItem("kstudy_chat_sid") : null;

      if (savedSid) {
        const res = await fetch(`/api/hermes/session?session_id=${encodeURIComponent(savedSid)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            setSessionId(data.session.session_id);
            if (Array.isArray(data.session.messages) && data.session.messages.length > 0) {
              setMessages(data.session.messages);
              autoTitledRef.current = true;
            }
            if (data.session.title) setChatTitle(data.session.title);
            setStatusMessage(null);
            return;
          }
        }
      }

      const newRes = await fetch("/api/hermes/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (newRes.ok) {
        const newData = await newRes.json();
        const newSid = newData.session.session_id;
        setSessionId(newSid);
        if (typeof window !== "undefined") {
          localStorage.setItem("kstudy_chat_sid", newSid);
        }
        setMessages([]);
        autoTitledRef.current = false;
      }
      setStatusMessage(null);
    } catch (err) {
      console.error("[KStudy Chat] Session initialization error:", err);
      setStatusMessage("Failed to connect to Hermes AI Assistant. Please refresh.");
    }
  }, []);

  useEffect(() => {
    if (session?.user && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      initSession();
    }
  }, [session, initSession]);

  // Rename the current session's title (user edit or auto-title)
  const renameSession = useCallback(async (sid: string, nextTitle: string, isAuto: boolean) => {
    if (!sid || !nextTitle.trim()) return;
    if (!isAuto) setTitleSaving(true);
    // Optimistic UI
    setChatTitle(nextTitle);
    setSessionList((prev) => prev.map((s) => s.session_id === sid ? { ...s, title: nextTitle } : s));
    try {
      const res = await fetch("/api/hermes/session/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, title: nextTitle }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const confirmed = data?.session?.title;
        if (confirmed && confirmed !== nextTitle) {
          setChatTitle(confirmed);
          setSessionList((prev) => prev.map((s) => s.session_id === sid ? { ...s, title: confirmed } : s));
        }
      }
    } catch (err) {
      console.error("[KStudy Chat] Rename error:", err);
    } finally {
      if (!isAuto) setTitleSaving(false);
    }
  }, []);

  // Derive a concise title from the first user message
  const deriveTitle = (text: string): string => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return "";
    const words = clean.split(" ").slice(0, 8).join(" ");
    return words.length > 60 ? words.slice(0, 57) + "…" : words;
  };

  // Start new conversation
  const handleNewConversation = async () => {
    if (isStreaming || isUploading) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      setStatusMessage("Creating new conversation...");
      const res = await fetch("/api/hermes/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        const newSid = data.session.session_id;
        setSessionId(newSid);
        if (typeof window !== "undefined") {
          localStorage.setItem("kstudy_chat_sid", newSid);
        }
        setMessages([]);
        setChatTitle("");
        autoTitledRef.current = false;
        setMobileSidebarOpen(false);
        setFilesOpen(false);
        fetchSessionList();
      }
    } catch (err) {
      console.error("[KStudy Chat] New conversation error:", err);
    } finally {
      setStatusMessage(null);
    }
  };

  // Handle File Selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setStagedFiles((prev) => [...prev, ...selected]);
    }
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Stop active stream
  const handleStopStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
    );
  };

  // Helper to append token text to assistant message
  const appendTokenToLastAssistant = (tokenText: string) => {
    const cleanToken = sanitizeText(tokenText);
    if (!cleanToken) return;

    setMessages((prev) => {
      const updated = [...prev];
      if (updated.length === 0) {
        return [{ role: "assistant", content: cleanToken, isStreaming: true }];
      }
      const last = updated[updated.length - 1];
      if (last && last.role === "assistant") {
        updated[updated.length - 1] = {
          ...last,
          content: last.content + cleanToken,
          // Real answer tokens are arriving: the thinking phase is over and any
          // "in progress" status should give way to the streaming response.
          reasoningActive: false,
          progressLabel: undefined,
        };
      } else {
        updated.push({ role: "assistant", content: cleanToken, isStreaming: true });
      }
      return updated;
    });
  };

  // Send Message
  const handleSendMessage = async () => {
    if ((!inputText.trim() && stagedFiles.length === 0) || !sessionId || isStreaming || isUploading) {
      return;
    }

    const currentText = inputText.trim();
    const currentFiles = [...stagedFiles];

    setInputText("");
    setStagedFiles([]);
    // Reset textarea height back to one line
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }

    const uploadedAttachments: Attachment[] = [];

    // Step 1: Upload attached files if any
    if (currentFiles.length > 0) {
      setIsUploading(true);
      setStatusMessage(`Uploading ${currentFiles.length} file(s)...`);

      for (const file of currentFiles) {
        try {
          const formData = new FormData();
          formData.append("session_id", sessionId);
          formData.append("file", file, file.name);

          const uploadRes = await fetch("/api/hermes/upload", {
            method: "POST",
            body: formData,
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            uploadedAttachments.push({
              name: uploadData.filename || file.name,
              path: uploadData.path,
              mime: uploadData.mime,
              size: uploadData.size,
              is_image: !!uploadData.is_image,
            });
          }
        } catch (uploadErr) {
          console.error("[KStudy Chat] File upload error:", uploadErr);
        }
      }

      setIsUploading(false);
      setStatusMessage(null);
    }

    // Step 2: Optimistically append User Message to list
    const userMessage: ChatMessage = {
      role: "user",
      content: currentText,
      attachments: uploadedAttachments,
      timestamp: Date.now(),
    };

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        role: "assistant",
        content: "",
        isStreaming: true,
        timestamp: Date.now(),
      },
    ]);

    // Auto-title a fresh conversation from the first user message.
    const shouldAutoTitle = !autoTitledRef.current && !chatTitle.trim() && !!currentText;
    if (shouldAutoTitle) {
      autoTitledRef.current = true;
      const derived = deriveTitle(currentText);
      if (derived) renameSession(sessionId, derived, true);
    }

    // Step 3: Trigger chat completion request
    try {
      setIsStreaming(true);

      const startRes = await fetch("/api/hermes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: currentText,
          attachments: uploadedAttachments,
        }),
      });

      if (!startRes.ok) {
        // Quota gate (402): render the friendly reason as the assistant reply
        // instead of a generic error, and stop cleanly (no stream to open).
        let quotaReason: string | null = null;
        try {
          const errData = await startRes.json();
          if (startRes.status === 402 || errData?.quota_blocked) {
            quotaReason = errData?.reason || errData?.error || "Credits exhausted.";
          }
        } catch {
          /* non-JSON error body — fall through to generic handling */
        }
        if (quotaReason) {
          setIsStreaming(false);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant" && last.isStreaming) {
              updated[updated.length - 1] = {
                ...last,
                content: quotaReason as string,
                isStreaming: false,
              };
            } else {
              updated.push({
                role: "assistant",
                content: quotaReason as string,
                timestamp: Date.now(),
              });
            }
            return updated;
          });
          return;
        }
        throw new Error(`Chat start error: ${startRes.statusText}`);
      }

      const startData = await startRes.json();
      const streamId = startData.stream_id;

      if (!streamId) {
        throw new Error("No stream_id returned from Hermes.");
      }

      // Step 4: Connect SSE EventSource via Next.js unbuffered stream proxy
      const es = new EventSource(`/api/chat/stream?stream_id=${encodeURIComponent(streamId)}`);
      eventSourceRef.current = es;

      const processDataChunk = (rawData: string) => {
        try {
          const data = JSON.parse(rawData);
          if (data.text) {
            appendTokenToLastAssistant(data.text);
          }
        } catch {
          // If not JSON, append text directly if safe
          appendTokenToLastAssistant(rawData);
        }
      };

      es.onmessage = (event) => {
        processDataChunk(event.data);
      };

      es.addEventListener("token", (event: MessageEvent) => {
        processDataChunk(event.data);
      });

      es.addEventListener("interim_assistant", (event: MessageEvent) => {
        processDataChunk(event.data);
      });

      // Reasoning / "thinking" deltas — accumulate per current assistant message.
      es.addEventListener("reasoning", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const delta = typeof data?.text === "string" ? data.text : "";
          if (!delta) return;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                reasoning: (last.reasoning || "") + delta,
                reasoningActive: true,
                // Keep a live progress hint if no tool has set one yet.
                progressLabel: last.progressLabel || "Thinking…",
              };
            }
            return updated;
          });
        } catch (e) {
          console.error("Reasoning parse error:", e);
        }
      });

      es.addEventListener("tool", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          const toolName = data.name || "tool";
          const prog = progressForTool(toolName);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              const toolEvents = [...(last.toolEvents || [])];
              toolEvents.push({
                name: toolName,
                args: data.args || null,
                preview: null,
                done: false,
              });
              updated[updated.length - 1] = {
                ...last,
                // Once real output/tools begin, reasoning is no longer "active".
                reasoningActive: false,
                toolEvents,
                progressLabel: prog.label,
                // Legacy single indicator kept for continuity.
                toolCall: { name: toolName, status: "running" },
              };
            }
            return updated;
          });
        } catch (e) {
          console.error("Tool parse error:", e);
        }
      });

      es.addEventListener("tool_complete", (event: MessageEvent) => {
        try {
          const data = event.data ? JSON.parse(event.data) : {};
          const toolName = data.name;
          const preview = typeof data.preview === "string" ? data.preview : null;
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              // Attach the completion preview to the most recent matching, not-done tool.
              const toolEvents = [...(last.toolEvents || [])];
              for (let i = toolEvents.length - 1; i >= 0; i--) {
                if (!toolEvents[i].done && (!toolName || toolEvents[i].name === toolName)) {
                  toolEvents[i] = { ...toolEvents[i], done: true, preview, is_error: !!data.is_error };
                  break;
                }
              }
              updated[updated.length - 1] = {
                ...last,
                toolEvents,
                toolCall: last.toolCall ? { ...last.toolCall, status: "completed" } : undefined,
              };
            }
            return updated;
          });
        } catch (e) {
          console.error("Tool complete parse error:", e);
        }
      });

      const finishStream = () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.isStreaming
              ? { ...msg, isStreaming: false, reasoningActive: false, progressLabel: undefined }
              : msg
          )
        );
        // Refresh sidebar (message counts / server-side title) after a turn.
        fetchSessionList();
      };

      es.addEventListener("done", finishStream);
      es.addEventListener("stream_end", finishStream);

      es.onerror = (err) => {
        console.error("[KStudy Chat] EventSource SSE error:", err);
        finishStream();
      };

    } catch (err: unknown) {
      console.error("[KStudy Chat] Send message error:", err);
      setIsStreaming(false);
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Error sending message: ${msg}`,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  if (isPending) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-deep)", color: "var(--text-primary)" }}>
        <span style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--violet-light)", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const mobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const sidebarVisiblyCollapsed = mobile ? !mobileSidebarOpen : sidebarCollapsed;

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <div style={{ background: "#070b14", color: "var(--text-primary)", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

      <div className="chat-shell">
        {/* Mobile backdrop for sidebar */}
        {mobile && mobileSidebarOpen && (
          <div className="chat-overlay-backdrop" onClick={() => setMobileSidebarOpen(false)} />
        )}

        {/* ── Left Sidebar ── */}
        <ChatSidebar
          collapsed={sidebarVisiblyCollapsed}
          onToggle={toggleSidebar}
          sessions={sessionList}
          activeSid={sessionId}
          loading={loadingHistory}
          onNewChat={handleNewConversation}
          onSwitch={handleSwitchSession}
          busy={isStreaming || isUploading}
          user={user}
          onSignOut={handleSignOut}
        />

        {/* ── Main Chat Column ── */}
        <main className="chat-main">
          {/* Chat header: title (left) · files (right) */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
            padding: "0.65rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(7, 11, 20, 0.8)", backdropFilter: "blur(12px)",
          }}>
            {/* Left: mobile sidebar toggle + editable title */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0, flex: 1 }}>
              <button
                className="chat-sidebar-toggle-mobile"
                onClick={() => setMobileSidebarOpen((v) => !v)}
                title="Chat history"
                aria-label="Toggle chat history sidebar"
                style={{
                  display: "none", alignItems: "center", justifyContent: "center",
                  width: 34, height: 34, flexShrink: 0,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0.5rem", color: "#e2e8f0", cursor: "pointer",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <ChatTitle
                title={chatTitle}
                saving={titleSaving}
                onRename={(next) => { if (sessionId) renameSession(sessionId, next, false); }}
              />
            </div>

            {/* Right: Files toggle only */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
              <button
                onClick={() => setFilesOpen((v) => !v)}
                title="Files in this conversation"
                style={{
                  display: "flex", alignItems: "center", gap: "0.4rem",
                  background: filesOpen ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)",
                  border: filesOpen ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "0.6rem", padding: "0.4rem 0.75rem", color: "#f1f5f9",
                  fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
                }}
              >
                <Icon name="files" size={16} />
                <span className="files-btn-label">Files{artifacts.length > 0 ? ` (${artifacts.length})` : ""}</span>
              </button>
            </div>
          </div>

          {/* Status banner */}
          {statusMessage && (
            <div style={{ margin: "0.6rem 1rem 0", padding: "0.6rem 1rem", borderRadius: "0.6rem", background: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)", color: "#93c5fd", fontSize: "0.83rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ width: 14, height: 14, border: "2px solid #93c5fd", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Messages Scroll Area */}
          <div 
            ref={scrollContainerRef}
            style={{
              flex: 1, overflowY: "auto", padding: "1.5rem 1.5rem 0.5rem",
              display: "flex", flexDirection: "column", gap: "1.25rem",
            }}
          >
            <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1 }}>
              {messages.length === 0 ? (
                <div style={{
                  margin: "auto", textAlign: "center", maxWidth: "480px",
                  padding: "2.5rem 1.5rem", background: "rgba(15, 23, 42, 0.5)",
                  border: "1px dashed rgba(255,255,255,0.12)", borderRadius: "1.25rem"
                }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📚</div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#f8fafc" }}>
                    Welcome to KStudy Case Study Assistant
                  </h2>
                  <p style={{ fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.5, margin: 0 }}>
                    Ask questions about your Nursing Case Study, upload clinical documents or guidelines, and collaborate directly with Hermes.
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isUser = msg.role === "user";
                  const cleanContent = sanitizeText(msg.content);
                  
                  let displayContent = cleanContent;
                  let displayReasoning = msg.reasoning || "";

                  if (!isUser && cleanContent) {
                    const split = splitThinkingAndResponse(cleanContent);
                    if (split.thinking) {
                      displayContent = split.response;
                      displayReasoning = displayReasoning
                        ? displayReasoning + "\n\n" + split.thinking
                        : split.thinking;
                    }
                  }

                  const hasReasoning = !!(displayReasoning && displayReasoning.trim());
                  const isReasoningActive = !!msg.reasoningActive || (!!msg.isStreaming && !displayContent);
                  
                  const msgSources = msg.toolEvents && msg.toolEvents.length
                    ? extractSources(msg.toolEvents as ToolEventLike[])
                    : [];
                  const showProgress = !!msg.isStreaming && !displayContent && !!msg.progressLabel;
                  const showThinkingSpinner = !!msg.isStreaming && !displayContent && !msg.progressLabel && !hasReasoning;

                  if (
                    !displayContent && !msg.attachments?.length && !msg.isStreaming &&
                    !hasReasoning && !(msg.toolEvents && msg.toolEvents.length)
                  ) {
                    return null; // Skip empty system/tool frames
                  }

                  return (
                    <div
                      key={index}
                      className="chat-msg-row"
                      style={{
                        display: "flex", flexDirection: "column",
                        alignItems: isUser ? "flex-end" : "flex-start",
                        maxWidth: isUser ? "80%" : "100%",
                        alignSelf: isUser ? "flex-end" : "flex-start",
                        width: isUser ? undefined : "100%",
                      }}
                    >
                      <div style={{ fontSize: "0.72rem", color: "#475569", marginBottom: "0.3rem", paddingLeft: isUser ? 0 : "0.1rem", paddingRight: isUser ? "0.1rem" : 0 }}>
                        {isUser ? user?.name || "You" : "Hermes AI Assistant"}
                      </div>

                      <div
                        style={{
                          background: isUser
                            ? "linear-gradient(135deg, #4f46e5, #3b82f6)"
                            : "transparent",
                          border: "none",
                          borderRadius: isUser ? "1.2rem 1.2rem 0.2rem 1.2rem" : "0",
                          padding: isUser ? "0.85rem 1.15rem" : "0",
                          color: "#f8fafc",
                          boxShadow: isUser ? "0 4px 15px rgba(0,0,0,0.2)" : "none",
                          maxWidth: "100%", minWidth: 0,
                        }}
                      >
                        {/* Attachments Badge */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.6rem" }}>
                            {msg.attachments.map((att, aIdx) => (
                              <div key={aIdx} style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.5rem", padding: "0.25rem 0.55rem", fontSize: "0.75rem", color: "#e2e8f0" }}>
                                <span>📄</span>
                                <span style={{ fontWeight: 600 }}>{att.name}</span>
                                {att.size && <span style={{ color: "#94a3b8" }}>({formatBytes(att.size)})</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reasoning ("thinking") — collapsible, above the answer */}
                        {!isUser && hasReasoning && (
                          <ReasoningBlock text={displayReasoning} active={isReasoningActive} />
                        )}

                        {/* Web sources consulted (separate from reasoning) */}
                        {!isUser && msgSources.length > 0 && (
                          <SourcesPanel sources={msgSources} />
                        )}

                        {/* Message Body */}
                        {displayContent ? (
                          <FormattedMessage text={displayContent} onOpenFile={openFileByPath} />
                        ) : showProgress ? (
                          <MessageProgress label={msg.progressLabel as string} />
                        ) : showThinkingSpinner ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                            <span style={{ width: 12, height: 12, border: "2px solid #38bdf8", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                            <span>Hermes is thinking...</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Per-message copy button (hover on desktop, always on mobile) */}
                      {displayContent && (
                        <div
                          className="chat-msg-actions"
                          style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", paddingTop: "0.3rem", height: 24 }}
                        >
                          <CopyButton text={displayContent} subtle />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Composer Bar */}
          <div style={{ padding: "0.75rem 1.5rem 1.25rem" }}>
            <div
              className="chat-composer"
              style={{
                maxWidth: 900, margin: "0 auto",
                background: "rgba(15, 23, 42, 0.85)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "1.5rem", padding: "0.6rem 0.6rem 0.6rem 1rem",
                backdropFilter: "blur(20px)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            >
              {/* Staged File Tray */}
              {stagedFiles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.5rem", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {stagedFiles.map((f, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "rgba(108,58,232,0.15)", border: "1px solid rgba(108,58,232,0.3)", borderRadius: "0.5rem", padding: "0.25rem 0.55rem", fontSize: "0.76rem", color: "#a5b4fc" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span style={{ fontWeight: 600 }}>{f.name}</span>
                      <span style={{ color: "#7c93d4", fontSize: "0.7rem" }}>({formatBytes(f.size)})</span>
                      <button onClick={() => removeStagedFile(idx)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: "0 0.15rem", marginLeft: "0.1rem", display: "flex", alignItems: "center" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Hidden File Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.csv,.json,.xlsx"
                style={{ display: "none" }}
              />

              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
                {/* File Upload Button — plus icon */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || isUploading}
                  title="Attach file or document"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: "0.85rem", width: 40, height: 40,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: isStreaming || isUploading ? "#334155" : "#64748b",
                    cursor: isStreaming || isUploading ? "not-allowed" : "pointer",
                    transition: "all 0.2s", flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { if (!isStreaming && !isUploading) { e.currentTarget.style.background = "rgba(108,58,232,0.18)"; e.currentTarget.style.borderColor = "rgba(108,58,232,0.4)"; e.currentTarget.style.color = "#a5b4fc"; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = isStreaming || isUploading ? "#334155" : "#64748b"; }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                {/* Input Textarea */}
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    autoResize(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      // On mobile devices (screen width <= 768px), let Enter insert a new line naturally.
                      // On desktop, Enter sends the message.
                      const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
                      if (!isMobile) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }
                  }}
                  onFocus={(e) => {
                    const p = e.currentTarget.closest(".chat-composer") as HTMLElement | null;
                    if (p) { p.style.borderColor = "rgba(108,58,232,0.5)"; p.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4), 0 0 0 3px rgba(108,58,232,0.12)"; }
                  }}
                  onBlur={(e) => {
                    const p = e.currentTarget.closest(".chat-composer") as HTMLElement | null;
                    if (p) { p.style.borderColor = "rgba(255,255,255,0.1)"; p.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)"; }
                  }}
                  placeholder="Message Hermes…"
                  rows={1}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    color: "#f1f5f9", fontSize: "0.93rem", fontFamily: "inherit",
                    resize: "none", overflowY: "hidden",
                    minHeight: "28px",
                    lineHeight: 1.6, padding: "0.3rem 0",
                    caretColor: "#8B5CF6",
                  }}
                />

                {/* Send / Stop Button */}
                {isStreaming ? (
                  <button
                    onClick={handleStopStream}
                    title="Stop response"
                    style={{
                      background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: "0.85rem", width: 40, height: 40,
                      color: "#f87171", cursor: "pointer", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.22)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.55)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                  </button>
                ) : (
                  <button
                    onClick={handleSendMessage}
                    disabled={(!inputText.trim() && stagedFiles.length === 0) || isUploading}
                    title="Send message"
                    style={{
                      background: (!inputText.trim() && stagedFiles.length === 0) || isUploading
                        ? "rgba(255,255,255,0.06)"
                        : "linear-gradient(135deg, #6C3AE8, #3b82f6)",
                      border: "none", borderRadius: "0.85rem",
                      width: 40, height: 40,
                      color: (!inputText.trim() && stagedFiles.length === 0) || isUploading ? "#334155" : "#fff",
                      cursor: (!inputText.trim() && stagedFiles.length === 0) || isUploading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s", flexShrink: 0,
                      boxShadow: (!inputText.trim() && stagedFiles.length === 0) || isUploading ? "none" : "0 4px 14px rgba(108,58,232,0.4)",
                    }}
                    onMouseEnter={(e) => { if (!(!inputText.trim() && stagedFiles.length === 0) && !isUploading) e.currentTarget.style.opacity = "0.85"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                  >
                    {isUploading
                      ? <span style={{ width: 13, height: 13, border: "2px solid #334155", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                      : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                    }
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* ── Right Files Panel ── */}
        {(filesOpen || filePreview) && (
          <>
            {/* Overlay backdrop on tablet/mobile */}
            <div className="chat-overlay-backdrop chat-files-backdrop" onClick={() => { setFilesOpen(false); setFilePreview(null); }} />
            <FilesPanel
              artifacts={artifacts}
              initialPreview={filePreview}
              onClose={() => { setFilesOpen(false); setFilePreview(null); }}
            />
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Files-panel backdrop only shows in overlay (<=900px) mode. */
        .chat-files-backdrop { display: none; }
        @media (max-width: 900px) {
          .chat-files-backdrop { display: block; }
        }
        /* Hide the connected badge + user name on very narrow screens. */
        @media (max-width: 560px) {
          .chat-header-meta { display: none !important; }
          .files-btn-label { display: none !important; }
        }
        /* Per-message copy button: hidden until row hover on desktop. */
        .chat-msg-actions { opacity: 0; transition: opacity 0.15s; }
        .chat-msg-row:hover .chat-msg-actions,
        .chat-msg-row:focus-within .chat-msg-actions { opacity: 1; }
        /* On touch/mobile there's no hover — always show the copy button. */
        @media (hover: none), (max-width: 768px) {
          .chat-msg-actions { opacity: 1 !important; }
        }
        /* Mobile-only chat sidebar toggle in the chat header. */
        @media (max-width: 768px) {
          .chat-sidebar-toggle-mobile { display: inline-flex !important; }
        }
      `}</style>
    </div>
  );
}
