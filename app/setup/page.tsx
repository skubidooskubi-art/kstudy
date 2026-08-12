"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signOut, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

/* ─── Topbar ─────────────────────────────────────────────────── */
function Topbar({ userName }: { userName?: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Smart Navigation: Hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setVisible(false); // scrolling down
        setIsOpen(false);   // close menu drawer
      } else {
        setVisible(true);  // scrolling up
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
      {/* Click outside detection backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(0,0,0,0.1)",
          }}
        />
      )}

      <header
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          background: "rgba(7,11,20,0.85)", backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border)",
          padding: "0.85rem 2rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          transform: visible ? "translateY(0)" : "translateY(-100%)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: "9px", background: "linear-gradient(135deg, #6C3AE8, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>K</div>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>KStudy</span>
        </Link>

        {/* Desktop Links */}
        <div className="nav-right" style={{ gap: "1.25rem" }}>
          <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}>Home</Link>
          <Link href="/dashboard" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 500 }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--text-primary)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-secondary)"}>Profile</Link>
          <Link href="/chat" style={{ color: "var(--cyan)", textDecoration: "none", fontSize: "0.85rem", fontWeight: 600 }}>AI Assistant</Link>
          {userName && (
            <span style={{ fontSize: "0.83rem", color: "var(--text-muted)", borderLeft: "1px solid var(--border)", paddingLeft: "0.85rem" }}>
              👋 <strong style={{ color: "var(--text-primary)" }}>{userName.split(" ")[0]}</strong>
            </span>
          )}
          <button
            onClick={handleSignOut}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: "0.6rem", padding: "0.4rem 0.85rem", color: "var(--text-muted)", fontSize: "0.8rem", cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.2s, color 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--violet-light)"; e.currentTarget.style.color = "var(--text-primary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >Sign Out</button>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: "none",
            background: "none",
            border: "none",
            color: "var(--text-primary)",
            cursor: "pointer",
            padding: "0.25rem",
          }}
          className="hamburger-btn"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {isOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

        {/* Mobile dropdown drawer menu */}
        {isOpen && (
          <div
            className="mobile-drawer"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              zIndex: 100,
              marginTop: "0.5rem",
              borderRadius: "1.25rem",
              background: "rgba(9, 13, 24, 0.98)",
              border: "1px solid var(--border)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 10px 35px rgba(0,0,0,0.6)",
              animation: "slide-down 0.25s ease-out forwards",
            }}
          >
            <Link href="/" onClick={() => setIsOpen(false)} style={{ color: "var(--text-primary)", textDecoration: "none", fontSize: "0.95rem", fontWeight: 500 }}>Home</Link>
            <Link href="/dashboard" onClick={() => setIsOpen(false)} style={{ color: "var(--text-primary)", textDecoration: "none", fontSize: "0.95rem", fontWeight: 500 }}>Profile</Link>
            <Link href="/setup" onClick={() => setIsOpen(false)} style={{ color: "var(--cyan)", textDecoration: "none", fontSize: "0.95rem", fontWeight: 600 }}>Setup Guide</Link>
            <button
              onClick={handleSignOut}
              style={{
                background: "none", border: "1px solid var(--border)", borderRadius: "0.75rem",
                padding: "0.6rem", color: "#f87171", width: "100%",
                fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Sign Out
            </button>
          </div>
        )}
      </header>
    </>
  );
}

/* ─── Copy code helper ───────────────────────────────────────── */
function CopyCode({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "0.7rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginTop: "0.75rem" }}>
      <code style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: "0.9rem", color: "var(--cyan)", wordBreak: "break-all" }}>
        {children}
      </code>
      <button
        onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        style={{ background: copied ? "rgba(34,197,94,0.15)" : "rgba(108,58,232,0.15)", border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(108,58,232,0.4)"}`, borderRadius: "0.5rem", padding: "0.3rem 0.65rem", color: copied ? "#22c55e" : "var(--violet-light)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", whiteSpace: "nowrap" }}
      >{copied ? "✓ Copied" : "Copy"}</button>
    </div>
  );
}

/* ─── Telegram button ────────────────────────────────────────── */
function TelegramButton({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.7rem 1.4rem", marginTop: "0.85rem", background: "linear-gradient(135deg, #229ED9, #1a8fc7)", color: "#fff", borderRadius: "9999px", fontWeight: 600, fontSize: "0.9rem", textDecoration: "none", transition: "transform 0.2s, box-shadow 0.2s" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(34,158,217,0.4)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.247l-2.02 9.523c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.393c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L6.27 14.46l-2.967-.924c-.645-.204-.658-.645.136-.953l11.59-4.47c.537-.194 1.006.131.833.134z"/>
      </svg>
      {label}
    </a>
  );
}

/* ─── Chat bubble preview ────────────────────────────────────── */
function ChatPreview({ lines }: { lines: { role: "bot" | "user"; text: string }[] }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", borderRadius: "1rem", padding: "1rem 1.25rem", marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Telegram preview</div>
      {lines.map((l, i) => (
        <div key={i} className={l.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"} style={{ fontSize: "0.84rem", maxWidth: "90%" }}>
          {l.role === "bot" && <span style={{ color: "var(--cyan)", fontWeight: 600 }}>@BotFather · </span>}
          {l.text}
        </div>
      ))}
    </div>
  );
}

/* ─── Token submit form ──────────────────────────────────────── */
function TokenForm({ email }: { email?: string }) {
  const [token, setToken]       = useState("");
  const [status, setStatus]     = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errMsg, setErrMsg]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.includes(":")) {
      setErrMsg("That doesn't look like a valid bot token. It should contain a colon (:).");
      return;
    }
    setStatus("loading");
    setErrMsg("");
    
    try {
      const res = await fetch("/api/hermes/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrMsg(data.error || "Failed to connect bot.");
        setStatus("error");
      } else if (!data.provisioned) {
        setErrMsg(data.error || "Bot token saved, but provisioning is still in progress. It will activate automatically within a minute — if not, please contact support.");
        setStatus("error");
      } else {
        setStatus("done");
      }
    } catch (err) {
      console.error(err);
      setErrMsg("Network error connecting to Hermes. Please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
        <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎉</div>
        <h3 style={{ fontWeight: 800, fontSize: "1.1rem", marginBottom: "0.5rem" }}>Hermes is Connected!</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6 }}>
          Your personal bot is now powered by Hermes AI. Open it in Telegram and say hello!
        </p>
      </div>
    );
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "0.72rem 1rem",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(108,58,232,0.25)",
    borderRadius: "0.75rem", color: "var(--text-primary)",
    fontSize: "0.88rem", outline: "none", fontFamily: "inherit",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "0.5rem" }}>
      {errMsg && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "0.75rem", padding: "0.6rem 1rem", fontSize: "0.82rem", color: "#f87171" }}>⚠️ {errMsg}</div>
      )}
      <div>
        <label style={{ fontSize: "0.73rem", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "0.35rem", letterSpacing: "0.05em" }}>BOT API TOKEN (from BotFather)</label>
        <input
          required
          placeholder="123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxx"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={{ ...inp, fontFamily: "var(--font-geist-mono), monospace", fontSize: "0.82rem" }}
          onFocus={(e) => { e.target.style.borderColor = "var(--violet-light)"; e.target.style.boxShadow = "0 0 0 3px rgba(108,58,232,0.15)"; }}
          onBlur={(e)  => { e.target.style.borderColor = "rgba(108,58,232,0.25)"; e.target.style.boxShadow = "none"; }}
        />
      </div>
      <button
        type="submit"
        className="btn-primary"
        disabled={status === "loading"}
        style={{ justifyContent: "center", padding: "0.8rem", fontSize: "0.9rem", opacity: status === "loading" ? 0.75 : 1, marginTop: "0.25rem" }}
      >
        {status === "loading" ? (
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ width: 15, height: 15, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
            Connecting Hermes...
          </span>
        ) : "🔌 Connect Hermes to My Bot"}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );
}

/* ─── Steps ──────────────────────────────────────────────────── */
type Step = { id: number; icon: string; title: string; desc: string; content: React.ReactNode };

function buildSteps(email?: string): Step[] {
  return [
    {
      id: 1, icon: "🎉",
      title: "Subscription Confirmed",
      desc: "Your access is active",
      content: (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse-dot 1.5s ease-in-out infinite" }} />
            <span style={{ fontSize: "0.85rem", color: "#22c55e", fontWeight: 600 }}>KStudy Student Plan — Active</span>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "1.1rem" }}>
            Welcome! Your ₦2,000/month subscription is confirmed. Now let's connect the Hermes AI engine to your very own personal Telegram bot — it takes about 5 minutes.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
            {["Unlimited AI messages", "Powered by Hermes AI", "Your own private bot", "24/7 availability"].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
                <span style={{ color: "#22c55e" }}>✓</span>{i}
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 2, icon: "🤖",
      title: "Open @BotFather on Telegram",
      desc: "Find the official Telegram bot creator",
      content: (
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "0.85rem" }}>
            BotFather is the official Telegram bot that lets you create and manage your own bots. Open Telegram and find it:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div className="glass" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.3rem" }}>Option A — Direct link</div>
              <TelegramButton label="Open @BotFather" href="https://t.me/BotFather" />
            </div>
            <div className="glass" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.3rem" }}>Option B — Search</div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.83rem" }}>Open Telegram → tap the search icon → search:</p>
              <CopyCode>@BotFather</CopyCode>
            </div>
          </div>
          <p style={{ marginTop: "0.85rem", fontSize: "0.82rem", color: "var(--text-muted)" }}>
            ✅ Make sure you pick the one with the blue verified checkmark — it's the official bot.
          </p>
        </div>
      ),
    },
    {
      id: 3, icon: "⚙️",
      title: "Create Your Personal Bot",
      desc: "Run /newbot and get your API token",
      content: (
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "0.85rem" }}>
            Once you've opened BotFather, send the command below to start creating your personal AI bot:
          </p>
          <CopyCode>/newbot</CopyCode>

          <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", lineHeight: 1.7, margin: "1rem 0 0.5rem" }}>
            BotFather will ask you two things:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
            {[
              { q: "1. What name?", a: "Any display name, e.g. My KStudy Agent" },
              { q: "2. What username?", a: "Must end in _bot, e.g. mykstudy_bot" },
            ].map((r) => (
              <div key={r.q} style={{ background: "rgba(108,58,232,0.08)", border: "1px solid rgba(108,58,232,0.2)", borderRadius: "0.75rem", padding: "0.65rem 1rem" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--violet-light)", fontWeight: 600 }}>{r.q}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>→ {r.a}</div>
              </div>
            ))}
          </div>

          <ChatPreview lines={[
            { role: "bot",  text: "Alright, a new bot! How are we going to call it? Please choose a name for your bot." },
            { role: "user", text: "My KStudy Agent" },
            { role: "bot",  text: "Good. Now let's choose a username for your bot. It must end in `bot`. Like this, for example: TetrisBot or tetris_bot." },
            { role: "user", text: "mykstudy_bot" },
            { role: "bot",  text: "Done! Congratulations on your new bot. You will find it at t.me/mykstudy_bot.\n\nUse this token to access the HTTP API:\n123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxx\n\nKeep your token secure!" },
          ]} />

          <div style={{ marginTop: "1rem", background: "rgba(247,201,72,0.08)", border: "1px solid rgba(247,201,72,0.25)", borderRadius: "0.75rem", padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--gold)" }}>
            📋 <strong>Copy your token now</strong> — the long string after the colon. You'll need it in the next step.
          </div>
        </div>
      ),
    },
    {
      id: 4, icon: "🔌",
      title: "Connect Hermes to Your Bot",
      desc: "Paste your token and you're live",
      content: (
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "1rem" }}>
            Paste your <strong style={{ color: "var(--text-primary)" }}>BotFather API token</strong> below. We'll wire Hermes AI directly into your personal bot.
          </p>
          <div style={{ marginBottom: "1rem", background: "rgba(108,58,232,0.1)", border: "1px solid rgba(108,58,232,0.3)", borderRadius: "0.75rem", padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--cyan)" }}>
            🔒 <strong>Important:</strong> Message your bot immediately after creating it, before sharing its link with anyone else — the first person to message it becomes its only authorized user.
          </div>
          <TokenForm email={email} />
        </div>
      ),
    },
    {
      id: 5, icon: "🚀",
      title: "You're All Set!",
      desc: "Start chatting with your AI agent",
      content: (
        <div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: "1rem" }}>
            Hermes AI is now running inside your personal Telegram bot. Open it and start chatting! Here are some things to try:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", marginBottom: "1.25rem" }}>
            {[
              { t: "Summarize this research paper for me [paste text]",  i: "📄" },
              { t: "Write an introduction for my essay on [topic]",       i: "✍️" },
              { t: "Explain [concept] in simple terms",                   i: "💡" },
              { t: "Create a 7-day study plan for my [exam] exam",        i: "📅" },
              { t: "Debug this code: [paste code]",                       i: "🐛" },
              { t: "Translate this paragraph to French: [text]",          i: "🌐" },
            ].map((c) => (
              <div key={c.t} style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem", background: "rgba(108,58,232,0.07)", border: "1px solid rgba(108,58,232,0.18)", borderRadius: "0.75rem", padding: "0.6rem 0.85rem" }}>
                <span>{c.i}</span>
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "var(--font-geist-mono), monospace" }}>"{c.t}"</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Open your bot in Telegram:</p>
          <TelegramButton label="Open My Bot on Telegram" href="https://t.me/" />
        </div>
      ),
    },
  ];
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function SetupPage() {
  const { data: session }    = useSession();
  const [activeStep, setStep] = useState(1);

  const steps       = buildSteps(session?.user?.email);
  const current     = steps.find((s) => s.id === activeStep)!;
  const progress    = ((activeStep - 1) / (steps.length - 1)) * 100;

  return (
    <>
      <Topbar userName={session?.user?.name} />
      <style>{`
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      <main style={{ minHeight: "100vh", maxWidth: 900, margin: "0 auto", padding: "100px 1.5rem 4rem" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div className="badge badge-cyan" style={{ marginBottom: "0.75rem" }}>⚡ Setup Guide</div>
          <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.5rem)", fontWeight: 800, marginBottom: "0.6rem" }}>
            Connect Hermes AI to <span className="gradient-text">Your Telegram Bot</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Create your own bot with BotFather, then we plug Hermes AI in — no coding required.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.05em" }}>STEP {activeStep} OF {steps.length}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--violet-light)", fontWeight: 600 }}>{Math.round(progress)}% complete</span>
          </div>
          <div style={{ width: "100%", height: 6, background: "rgba(108,58,232,0.15)", borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, var(--violet), var(--cyan))", borderRadius: 9999, transition: "width 0.4s ease" }} />
          </div>
        </div>

        <div className="responsive-setup-grid">

          {/* Sidebar nav */}
          <div className="glass" style={{ padding: "1rem", borderRadius: "1.25rem" }}>
            {steps.map((s) => {
              const done    = s.id < activeStep;
              const current = s.id === activeStep;
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  style={{
                    width: "100%", textAlign: "left", background: current ? "rgba(108,58,232,0.18)" : done ? "rgba(34,197,94,0.06)" : "transparent",
                    border: "none",
                    borderLeft: `2px solid ${current ? "var(--violet-light)" : done ? "rgba(34,197,94,0.5)" : "transparent"}`,
                    borderRadius: "0.75rem", padding: "0.7rem 0.85rem", cursor: "pointer",
                    fontFamily: "inherit", display: "flex", alignItems: "center", gap: "0.65rem",
                    marginBottom: "0.25rem", transition: "background 0.2s",
                  } as React.CSSProperties}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.75rem", fontWeight: 700,
                    background: done ? "rgba(34,197,94,0.2)" : current ? "rgba(108,58,232,0.3)" : "rgba(255,255,255,0.06)",
                    color: done ? "#22c55e" : current ? "var(--violet-light)" : "var(--text-muted)",
                    border: `1px solid ${done ? "rgba(34,197,94,0.4)" : current ? "rgba(108,58,232,0.5)" : "var(--border)"}`,
                  }}>
                    {done ? "✓" : s.id}
                  </div>
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: current ? "var(--text-primary)" : done ? "var(--text-secondary)" : "var(--text-muted)", lineHeight: 1.2 }}>{s.title}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>{s.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Main content */}
          <div className="glass" style={{ padding: "2rem", minHeight: 400, display: "flex", flexDirection: "column" }}>
            {/* Step header */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", paddingBottom: "1.25rem", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 52, height: 52, borderRadius: "14px", background: "linear-gradient(135deg, rgba(108,58,232,0.3), rgba(0,212,255,0.2))", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>
                {current.icon}
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--violet-light)", fontWeight: 600, letterSpacing: "0.08em", marginBottom: "0.15rem" }}>STEP {current.id} OF {steps.length}</div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>{current.title}</h2>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>{current.desc}</p>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1 }}>{current.content}</div>

            {/* Navigation */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => setStep((p) => Math.max(1, p - 1))}
                disabled={activeStep === 1}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: "9999px", padding: "0.6rem 1.25rem", color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: 600, cursor: activeStep === 1 ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: activeStep === 1 ? 0.4 : 1, transition: "all 0.2s" }}
              >← Back</button>

              {activeStep < steps.length ? (
                <button onClick={() => setStep((p) => Math.min(steps.length, p + 1))} className="btn-primary" style={{ padding: "0.6rem 1.6rem", fontSize: "0.9rem" }}>
                  Next Step →
                </button>
              ) : (
                <a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ padding: "0.6rem 1.6rem", fontSize: "0.9rem", textDecoration: "none" }}>
                  🚀 Open My Bot
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Help banner */}
        <div className="glass" style={{ marginTop: "1.5rem", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "1.3rem" }}>💬</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: "0.15rem" }}>Stuck somewhere?</div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Email us at <a href="mailto:support@kstudy.app" style={{ color: "var(--violet-light)", textDecoration: "none" }}>support@kstudy.app</a>{" "}
              or message us on Telegram <a href="https://t.me/KStudySupport" target="_blank" rel="noopener noreferrer" style={{ color: "var(--cyan)", textDecoration: "none" }}>@KStudySupport</a>.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
