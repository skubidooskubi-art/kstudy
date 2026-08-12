"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

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
        <div onClick={() => setIsOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.1)" }} />
      )}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(7,11,20,0.85)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border)", padding: "0.85rem 2rem",
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
        {isOpen && (
          <div className="mobile-drawer" style={{ position: "absolute", top: "100%", left: 0, right: 0, padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem", zIndex: 100, marginTop: "0.5rem", borderRadius: "1.25rem", background: "rgba(9, 13, 24, 0.98)", border: "1px solid var(--border)", backdropFilter: "blur(20px)", boxShadow: "0 10px 35px rgba(0,0,0,0.6)" }}>
            <Link href="/" onClick={() => setIsOpen(false)} style={{ color: "var(--text-primary)", textDecoration: "none", fontSize: "0.95rem", fontWeight: 500 }}>Home</Link>
            <Link href="/dashboard" onClick={() => setIsOpen(false)} style={{ color: "var(--text-primary)", textDecoration: "none", fontSize: "0.95rem", fontWeight: 500 }}>Profile</Link>
            <Link href="/chat" onClick={() => setIsOpen(false)} style={{ color: "var(--cyan)", textDecoration: "none", fontSize: "0.95rem", fontWeight: 600 }}>AI Assistant</Link>
            <Link href="/setup" onClick={() => setIsOpen(false)} style={{ color: "var(--text-primary)", textDecoration: "none", fontSize: "0.95rem", fontWeight: 500 }}>Setup Guide</Link>
            <button onClick={handleSignOut} style={{ background: "none", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "0.6rem", color: "#f87171", width: "100%", fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit" }}>Sign Out</button>
          </div>
        )}
      </header>
    </>
  );
}

/* ─── Hermes Chat Page ──────────────────────────────────────── */
export default function HermesChatPage() {
  const { data: session, isPending } = useSession();
  const [iframeLoading, setIframeLoading] = useState(true);

  if (isPending) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-deep)", color: "var(--text-primary)" }}>
        <span style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--violet-light)", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const user = session?.user;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-deep)", color: "var(--text-primary)", display: "flex", flexDirection: "column" }}>
      <Topbar userName={user?.name} />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Main Container */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: "64px", position: "relative" }}>
        {iframeLoading && (
          <div style={{ position: "absolute", inset: "64px 0 0 0", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg-deep)", gap: "1rem" }}>
            <span style={{ width: 36, height: 36, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--cyan)", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>Loading KStudy AI Assistant...</p>
          </div>
        )}

        <iframe
          src="/hermes-chat/"
          style={{ width: "100%", height: "calc(100vh - 64px)", border: "none", outline: "none", background: "#0a0e1a" }}
          title="KStudy AI Assistant"
          allow="clipboard-write; microphone"
          onLoad={() => setIframeLoading(false)}
        />
      </main>
    </div>
  );
}
