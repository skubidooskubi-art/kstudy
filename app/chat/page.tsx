"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { signOut, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

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

/* ─── Topbar ─────────────────────────────────────────────────── */
function Topbar({ userName }: { userName?: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setVisible(false);
        setIsOpen(false);
      } else {
        setVisible(true);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

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
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(7,11,20,0.92)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)", padding: "0.75rem 2rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        transform: visible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s",
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

/* ─── Simple Markdown Renderer ────────────────────────────────── */
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

  // Chat History Sidebar State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [sessionList, setSessionList] = useState<SessionItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasInitializedRef = useRef(false);

  const user = session?.user;

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
          if (typeof window !== "undefined") {
            localStorage.setItem("kstudy_chat_sid", data.session.session_id);
          }
          if (Array.isArray(data.session.messages)) {
            setMessages(data.session.messages);
          } else {
            setMessages([]);
          }
          setIsHistoryOpen(false);
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
            }
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
        setIsHistoryOpen(false);
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

    let uploadedAttachments: Attachment[] = [];

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
        } catch (e) {
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
      };

      es.addEventListener("done", finishStream);
      es.addEventListener("stream_end", finishStream);

      es.onerror = (err) => {
        console.error("[KStudy Chat] EventSource SSE error:", err);
        finishStream();
      };

    } catch (err: any) {
      console.error("[KStudy Chat] Send message error:", err);
      setIsStreaming(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Error sending message: ${err.message || "Something went wrong."}`,
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

  return (
    <div style={{ minHeight: "100vh", background: "#070b14", color: "var(--text-primary)", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <Topbar userName={user?.name} />

      {/* Chat History Slide-Over Drawer */}
      {isHistoryOpen && (
        <>
          <div
            onClick={() => setIsHistoryOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          />
          <div style={{
            position: "fixed", top: 0, bottom: 0, right: 0, width: "340px", maxWidth: "85vw",
            zIndex: 120, background: "rgba(15, 23, 42, 0.98)", borderLeft: "1px solid rgba(255,255,255,0.12)",
            padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem",
            boxShadow: "-10px 0 35px rgba(0,0,0,0.7)", backdropFilter: "blur(20px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.2rem" }}>📜</span>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#f8fafc" }}>Chat History</h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {loadingHistory ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
                Loading past conversations...
              </div>
            ) : sessionList.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
                No prior conversations found.
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {sessionList.map((item) => {
                  const isActive = item.session_id === sessionId;

                  return (
                    <button
                      key={item.session_id}
                      onClick={() => handleSwitchSession(item.session_id)}
                      style={{
                        textAlign: "left", padding: "0.75rem 0.85rem", borderRadius: "0.75rem",
                        background: isActive ? "rgba(99, 102, 241, 0.2)" : "rgba(255,255,255,0.04)",
                        border: isActive ? "1px solid rgba(99, 102, 241, 0.5)" : "1px solid rgba(255,255,255,0.06)",
                        cursor: isActive ? "default" : "pointer", transition: "all 0.2s",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "0.85rem", color: isActive ? "#a5b4fc" : "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.title || "Untitled Conversation"}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.2rem", display: "flex", justifyContent: "space-between" }}>
                        <span>{item.message_count ? `${item.message_count} msgs` : "Session"}</span>
                        <span>ID: {item.session_id.slice(-6)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Main Container */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: "64px", maxWidth: "1100px", width: "100%", margin: "0 auto", paddingLeft: "1rem", paddingRight: "1rem" }}>

        {/* Chat Sub-header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1rem 1.25rem", margin: "1rem 0 0.5rem 0",
          background: "rgba(15, 23, 42, 0.75)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "1rem", backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div style={{ width: 38, height: 38, borderRadius: "10px", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "1.1rem" }}>
              🤖
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h1 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc" }}>Hermes Case Study Assistant</h1>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "20px", padding: "0.15rem 0.55rem", fontSize: "0.72rem", fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} /> Connected
                </span>
              </div>
              <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
                User Profile: <strong style={{ color: "#cbd5e1" }}>{user?.name || "Student User"}</strong> ({user?.email || "active"})
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              onClick={() => {
                fetchSessionList();
                setIsHistoryOpen(true);
              }}
              style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "0.65rem", padding: "0.45rem 0.9rem", color: "#f1f5f9",
                fontSize: "0.82rem", fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: "0.4rem", transition: "all 0.2s"
              }}
            >
              📜 History
            </button>

            <button
              onClick={handleNewConversation}
              disabled={isStreaming || isUploading}
              style={{
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "0.65rem", padding: "0.45rem 0.9rem", color: "#f1f5f9",
                fontSize: "0.82rem", fontWeight: 600, cursor: isStreaming ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "0.4rem", transition: "all 0.2s"
              }}
            >
              ➕ New Chat
            </button>
          </div>
        </div>

        {/* Global Status Alert Banner */}
        {statusMessage && (
          <div style={{ padding: "0.6rem 1rem", marginBottom: "0.5rem", borderRadius: "0.6rem", background: "rgba(59, 130, 246, 0.15)", border: "1px solid rgba(59, 130, 246, 0.3)", color: "#93c5fd", fontSize: "0.83rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ width: 14, height: 14, border: "2px solid #93c5fd", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "1.25rem 1rem",
          display: "flex", flexDirection: "column", gap: "1.25rem",
          minHeight: "calc(100vh - 280px)",
        }}>
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

        {/* Composer Bar */}
        <div style={{
          position: "sticky", bottom: "1rem", marginTop: "0.5rem", marginBottom: "1rem",
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

      </main>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
