"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { signOut, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  extractArtifacts,
  downloadUrl,
  iconForKind,
  type ChatArtifact,
} from "@/lib/chat-artifacts";

/* ─── Types ───────────────────────────────────────────────────── */
interface Attachment {
  name: string;
  path: string;
  mime?: string;
  size?: number;
  is_image?: boolean;
}

interface ChatMessage {
  id?: string | number;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: Attachment[];
  timestamp?: number;
  isStreaming?: boolean;
  toolCall?: {
    name: string;
    status: "running" | "completed" | "error";
  };
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

/* ─── Topbar (UNCHANGED nav) ─────────────────────────────────── */
function Topbar({ userName }: { userName?: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <>
      {isOpen && (
        <div onClick={() => setIsOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.4)" }} />
      )}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 64,
        background: "rgba(7,11,20,0.92)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)", padding: "0.75rem 2rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: "9px", background: "linear-gradient(135deg, #6C3AE8, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>K</div>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>KStudy</span>
        </Link>
        <div className="nav-right" style={{ gap: "1.25rem", display: "flex", alignItems: "center" }}>
          <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 500 }}>Home</Link>
          <Link href="/dashboard" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 500 }}>Profile</Link>
          <Link href="/chat" style={{ color: "var(--cyan)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>AI Assistant</Link>
          <Link href="/setup" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 500 }}>Setup Guide</Link>
          {userName && (
            <span style={{ fontSize: "0.83rem", color: "var(--text-muted)", borderLeft: "1px solid var(--border)", paddingLeft: "0.85rem" }}>
              👋 <strong style={{ color: "var(--text-primary)" }}>{userName.split(" ")[0]}</strong>
            </span>
          )}
          <button onClick={handleSignOut} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "0.6rem", padding: "0.4rem 0.85rem", color: "var(--text-muted)", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit" }}>Sign Out</button>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} style={{ display: "none", background: "none", border: "none", color: "var(--text-primary)", cursor: "pointer", padding: "0.25rem" }} className="hamburger-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {isOpen ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>}
          </svg>
        </button>
      </header>
      {isOpen && (
        <div style={{ position: "fixed", top: 64, left: 0, right: 0, zIndex: 95, background: "rgba(7,11,20,0.98)", borderBottom: "1px solid var(--border)", padding: "1rem 2rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <Link href="/" onClick={() => setIsOpen(false)} style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.9rem" }}>Home</Link>
          <Link href="/dashboard" onClick={() => setIsOpen(false)} style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.9rem" }}>Profile</Link>
          <Link href="/chat" onClick={() => setIsOpen(false)} style={{ color: "var(--cyan)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>AI Assistant</Link>
          <Link href="/setup" onClick={() => setIsOpen(false)} style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.9rem" }}>Setup Guide</Link>
          <button onClick={handleSignOut} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "0.6rem", padding: "0.5rem 0.85rem", color: "var(--text-muted)", fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>Sign Out</button>
        </div>
      )}
    </>
  );
}

/* ─── Format Bytes ────────────────────────────────────────────── */
function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── Simple Markdown Renderer (UNCHANGED bubble styling) ──────── */
function FormattedMessage({ text }: { text: string }) {
  const clean = sanitizeText(text);
  if (!clean) return null;

  const blocks = clean.split(/(```[\s\S]*?```)/g);

  return (
    <div style={{ lineHeight: 1.6, fontSize: "0.92rem", wordBreak: "break-word" }}>
      {blocks.map((block, idx) => {
        if (block.startsWith("```")) {
          const firstLineEnd = block.indexOf("\n");
          const language = block.slice(3, firstLineEnd > -1 ? firstLineEnd : 3).trim();
          const code = firstLineEnd > -1 ? block.slice(firstLineEnd + 1, -3) : block.slice(3, -3);

          return (
            <div key={idx} style={{ margin: "0.75rem 0", borderRadius: "0.6rem", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.4)" }}>
              {language && (
                <div style={{ background: "rgba(255,255,255,0.05)", padding: "0.35rem 0.85rem", fontSize: "0.75rem", color: "var(--text-muted)", borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 600 }}>
                  {language.toUpperCase()}
                </div>
              )}
              <pre style={{ margin: 0, padding: "0.85rem", overflowX: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: "0.85rem", color: "#e2e8f0" }}>
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        const lines = block.split("\n");
        return (
          <span key={idx}>
            {lines.map((line, lIdx) => {
              // ── Check if line contains a MEDIA:/ absolute path attachment ──
              if (line.includes("MEDIA:/")) {
                const match = line.match(/MEDIA:(\/[^\s]+)/);
                if (match) {
                  const absolutePath = match[1];
                  const fileName = absolutePath.split("/").pop() || "Document.pdf";

                  return (
                    <div
                      key={lIdx}
                      style={{
                        margin: "1rem 0",
                        padding: "0.85rem 1.1rem",
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: "0.65rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "1rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                        <span style={{ fontSize: "1.5rem" }}>📄</span>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.85rem" }}>
                            {fileName}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                            Generated Assistant Document
                          </div>
                        </div>
                      </div>
                      <a
                        href={`/api/hermes/download?path=${encodeURIComponent(absolutePath)}`}
                        download={fileName}
                        style={{
                          background: "var(--cyan)",
                          color: "#0f172a",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          padding: "0.35rem 0.85rem",
                          borderRadius: "0.45rem",
                          textDecoration: "none",
                          display: "inline-block",
                          transition: "opacity 0.2s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1.0")}
                      >
                        Download PDF
                      </a>
                    </div>
                  );
                }
              }

              const parts = line.split(/(\*\*.*?\*\*|`[^`]+`)/g);

              return (
                <p key={lIdx} style={{ margin: lIdx === lines.length - 1 ? 0 : "0 0 0.5rem 0" }}>
                  {parts.map((part, pIdx) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                      return <strong key={pIdx} style={{ color: "var(--text-primary)", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
                    }
                    if (part.startsWith("`") && part.endsWith("`")) {
                      return <code key={pIdx} style={{ background: "rgba(255,255,255,0.1)", padding: "0.15rem 0.35rem", borderRadius: "0.3rem", fontSize: "0.83rem", fontFamily: "monospace", color: "var(--cyan)" }}>{part.slice(1, -1)}</code>;
                    }
                    return part;
                  })}
                </p>
              );
            })}
          </span>
        );
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
    default: return null;
  }
}

/* ─── Chat Sidebar ────────────────────────────────────────────── */
function ChatSidebar({
  collapsed, onToggle, sessions, activeSid, loading,
  onNewChat, onSwitch, busy,
}: {
  collapsed: boolean;
  onToggle: () => void;
  sessions: SessionItem[];
  activeSid: string | null;
  loading: boolean;
  onNewChat: () => void;
  onSwitch: (sid: string) => void;
  busy: boolean;
}) {
  return (
    <aside className={`chat-sidebar${collapsed ? " collapsed" : ""}`}>
      {/* Header: toggle + (expanded) label */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", padding: collapsed ? "0.85rem 0" : "0.85rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        {!collapsed && <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.03em", textTransform: "uppercase" }}>Chats</span>}
        <button
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", padding: "0.25rem" }}
        >
          <Icon name="sidebar" size={20} />
        </button>
      </div>

      {/* New Chat */}
      <div style={{ padding: collapsed ? "0.6rem 0" : "0.75rem", display: "flex", justifyContent: "center" }}>
        <button
          onClick={onNewChat}
          disabled={busy}
          title="New chat"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            width: collapsed ? 38 : "100%", height: 38,
            background: "linear-gradient(135deg, #6C3AE8, #00D4FF)", border: "none",
            borderRadius: "0.65rem", color: "#fff", fontWeight: 600, fontSize: "0.85rem",
            cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, transition: "opacity 0.2s",
          }}
        >
          <Icon name="plus" size={18} />
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* History list (hidden when collapsed) */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: "auto", padding: "0.25rem 0.6rem 0.75rem" }}>
          {loading ? (
            <div style={{ padding: "1.5rem 0.5rem", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>Loading…</div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: "1.5rem 0.5rem", textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>No conversations yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              {sessions.map((item) => {
                const isActive = item.session_id === activeSid;
                return (
                  <button
                    key={item.session_id}
                    onClick={() => onSwitch(item.session_id)}
                    title={item.title || "Untitled Conversation"}
                    style={{
                      textAlign: "left", padding: "0.6rem 0.7rem", borderRadius: "0.6rem",
                      background: isActive ? "rgba(99, 102, 241, 0.18)" : "transparent",
                      border: isActive ? "1px solid rgba(99, 102, 241, 0.45)" : "1px solid transparent",
                      cursor: isActive ? "default" : "pointer", transition: "all 0.15s", width: "100%",
                    }}
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ fontWeight: 500, fontSize: "0.84rem", color: isActive ? "#a5b4fc" : "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.title || "Untitled Conversation"}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.15rem" }}>
                      {item.message_count ? `${item.message_count} messages` : "New"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
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
function FilesPanel({ artifacts, onClose }: {
  artifacts: ChatArtifact[];
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<ChatArtifact | null>(null);

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasInitializedRef = useRef(false);
  const autoTitledRef = useRef(false);

  const user = session?.user;

  // Derived artifacts for the Files panel
  const artifacts = extractArtifacts(messages);

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

  // Auto-scroll to bottom of message list
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
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

      es.addEventListener("tool", (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                toolCall: {
                  name: data.name || "Executing tool...",
                  status: "running",
                },
              };
            }
            return updated;
          });
        } catch (e) {
          console.error("Tool parse error:", e);
        }
      });

      es.addEventListener("tool_complete", () => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant" && last.toolCall) {
            updated[updated.length - 1] = {
              ...last,
              toolCall: { ...last.toolCall, status: "completed" },
            };
          }
          return updated;
        });
      });

      const finishStream = () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg))
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

  return (
    <div style={{ background: "#070b14", color: "var(--text-primary)", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <Topbar userName={user?.name} />

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
        />

        {/* ── Main Chat Column ── */}
        <main className="chat-main">
          {/* Chat header: title (left) · status/user + files (right) */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
            padding: "0.75rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(12px)",
          }}>
            {/* Left: hamburger (mobile) + editable title */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0, flex: 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: "9px", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "1rem", flexShrink: 0 }}>
                🤖
              </div>
              <ChatTitle
                title={chatTitle}
                saving={titleSaving}
                onRename={(next) => { if (sessionId) renameSession(sessionId, next, false); }}
              />
            </div>

            {/* Right: connected badge + user + Files toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
              <div className="chat-header-meta" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "20px", padding: "0.15rem 0.55rem", fontSize: "0.72rem", fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} /> Connected
                </span>
                <span style={{ fontSize: "0.78rem", color: "#94a3b8", whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.name || "Student User"}
                </span>
              </div>
              <button
                onClick={() => setFilesOpen((v) => !v)}
                title="Files in this conversation"
                style={{
                  display: "flex", alignItems: "center", gap: "0.4rem",
                  background: filesOpen ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
                  border: filesOpen ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.12)",
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
          <div style={{
            flex: 1, overflowY: "auto", padding: "1.25rem",
            display: "flex", flexDirection: "column", gap: "1.25rem",
          }}>
            <div style={{ width: "100%", maxWidth: 820, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1 }}>
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

                  if (!cleanContent && !msg.attachments?.length && !msg.toolCall && !msg.isStreaming) {
                    return null; // Skip empty system/tool frames
                  }

                  return (
                    <div
                      key={index}
                      style={{
                        display: "flex", flexDirection: "column",
                        alignItems: isUser ? "flex-end" : "flex-start",
                        maxWidth: "85%", alignSelf: isUser ? "flex-end" : "flex-start",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem", paddingLeft: "0.2rem", paddingRight: "0.2rem" }}>
                        {isUser ? user?.name || "You" : "Hermes AI Assistant"}
                      </div>

                      <div
                        style={{
                          background: isUser
                            ? "linear-gradient(135deg, #4f46e5, #3b82f6)"
                            : "rgba(15, 23, 42, 0.9)",
                          border: isUser ? "none" : "1px solid rgba(255,255,255,0.1)",
                          borderRadius: isUser ? "1.2rem 1.2rem 0.2rem 1.2rem" : "1.2rem 1.2rem 1.2rem 0.2rem",
                          padding: "0.85rem 1.15rem", color: "#f8fafc", boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
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

                        {/* Tool execution indicator */}
                        {msg.toolCall && (
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "0.5rem", padding: "0.3rem 0.6rem", marginBottom: "0.5rem", fontSize: "0.78rem", color: "#fbbf24" }}>
                            <span>🛠️</span>
                            <span>{msg.toolCall.name}</span>
                            {msg.toolCall.status === "running" && (
                              <span style={{ width: 10, height: 10, border: "2px solid #fbbf24", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                            )}
                          </div>
                        )}

                        {/* Message Body */}
                        {cleanContent ? (
                          <FormattedMessage text={cleanContent} />
                        ) : (
                          msg.isStreaming && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#94a3b8", fontSize: "0.85rem" }}>
                              <span style={{ width: 12, height: 12, border: "2px solid #38bdf8", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                              <span>Hermes is thinking...</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Composer Bar */}
          <div style={{ padding: "0 1.25rem 1rem" }}>
            <div style={{
              maxWidth: 820, margin: "0 auto",
              background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "1.25rem", padding: "0.85rem", backdropFilter: "blur(16px)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}>
              {/* Staged File Tray */}
              {stagedFiles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.6rem", paddingBottom: "0.6rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  {stagedFiles.map((f, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "0.6rem", padding: "0.3rem 0.65rem", fontSize: "0.78rem", color: "#93c5fd" }}>
                      <span>📎</span>
                      <span style={{ fontWeight: 600 }}>{f.name}</span>
                      <span style={{ color: "#60a5fa" }}>({formatBytes(f.size)})</span>
                      <button onClick={() => removeStagedFile(idx)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: "0 0.2rem", marginLeft: "0.2rem", fontSize: "0.9rem" }}>×</button>
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

              <div style={{ display: "flex", alignItems: "flex-end", gap: "0.6rem" }}>
                {/* File Upload Trigger Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || isUploading}
                  title="Upload file or document"
                  style={{
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "0.75rem", width: 42, height: 42, display: "flex",
                    alignItems: "center", justifyContent: "center", color: "#94a3b8",
                    cursor: isStreaming ? "not-allowed" : "pointer", fontSize: "1.2rem",
                    transition: "all 0.2s", flexShrink: 0
                  }}
                >
                  📎
                </button>

                {/* Input Textarea */}
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type your message to Hermes... (Shift+Enter for new line)"
                  rows={1}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    color: "#f8fafc", fontSize: "0.92rem", fontFamily: "inherit",
                    resize: "none", maxHeight: "120px", minHeight: "24px", lineHeight: 1.5,
                  }}
                />

                {/* Action Button (Send / Stop) */}
                {isStreaming ? (
                  <button
                    onClick={handleStopStream}
                    title="Stop response"
                    style={{
                      background: "#ef4444", border: "none", borderRadius: "0.75rem",
                      padding: "0.55rem 1rem", color: "#fff", fontWeight: 600,
                      fontSize: "0.85rem", cursor: "pointer", flexShrink: 0,
                      display: "flex", alignItems: "center", gap: "0.35rem"
                    }}
                  >
                    ⏹️ Stop
                  </button>
                ) : (
                  <button
                    onClick={handleSendMessage}
                    disabled={(!inputText.trim() && stagedFiles.length === 0) || isUploading}
                    style={{
                      background: (!inputText.trim() && stagedFiles.length === 0) || isUploading
                        ? "rgba(255,255,255,0.08)"
                        : "linear-gradient(135deg, #6C3AE8, #00D4FF)",
                      border: "none", borderRadius: "0.75rem", padding: "0.55rem 1.15rem",
                      color: "#fff", fontWeight: 600, fontSize: "0.88rem",
                      cursor: (!inputText.trim() && stagedFiles.length === 0) || isUploading ? "not-allowed" : "pointer",
                      transition: "all 0.2s", flexShrink: 0,
                    }}
                  >
                    {isUploading ? "Uploading..." : "Send"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* ── Right Files Panel ── */}
        {filesOpen && (
          <>
            {/* Overlay backdrop on tablet/mobile */}
            <div className="chat-overlay-backdrop chat-files-backdrop" onClick={() => setFilesOpen(false)} />
            <FilesPanel artifacts={artifacts} onClose={() => setFilesOpen(false)} />
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
      `}</style>
    </div>
  );
}
