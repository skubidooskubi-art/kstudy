"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";

/* ── Google icon SVG ──────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.8 20-21 0-1.4-.2-2.7-.5-4z" fill="#FFC107"/>
      <path d="M6.3 14.7l7 5.1C15.2 15.5 19.2 12 24 12c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 16.3 3 9.6 7.9 6.3 14.7z" fill="#FF3D00"/>
      <path d="M24 45c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 35.9 27 37 24 37c-6 0-10.6-3.9-11.8-9.5l-7 5.4C8.5 40.1 15.7 45 24 45z" fill="#4CAF50"/>
      <path d="M44.5 20H24v8.5h11.8c-1.1 3-3.3 5.4-6.1 7l6.6 5.6C40.7 37.4 44.5 31.3 44.5 24c0-1.4-.2-2.7-.5-4z" fill="#1976D2"/>
    </svg>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.72rem 1rem",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(108,58,232,0.25)",
  borderRadius: "0.75rem",
  color: "var(--text-primary)",
  fontSize: "0.9rem",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

function SignInForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirect     = searchParams.get("redirect") ?? "/setup";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState<"google" | "email" | null>(null);

  /* ── Google sign-in ─────────────────────────── */
  async function handleGoogle() {
    console.log("[SIGN-IN] Google sign-in started");
    console.log("[SIGN-IN] redirect:", redirect);
    console.log("[SIGN-IN] window.location.origin:", window.location.origin);
    setLoading("google");
    setError("");
    try {
      console.log("[SIGN-IN] Calling signIn.social({ provider: 'google', callbackURL: redirect })");
      const result = await signIn.social({
        provider:    "google",
        callbackURL: redirect,
      });
      console.log("[SIGN-IN] signIn.social result:", JSON.stringify(result, null, 2));
      console.log("[SIGN-IN] result.url:", result?.url);
      console.log("[SIGN-IN] result.error:", result?.error);
      console.log("[SIGN-IN] result.data:", result?.data);

      if (result?.url) {
        console.log("[SIGN-IN] Redirecting to:", result.url);
        window.location.href = result.url;
      }
    } catch (err: any) {
      console.error("[SIGN-IN] Google sign-in error:", err);
      console.error("[SIGN-IN] Error message:", err.message);
      console.error("[SIGN-IN] Error stack:", err.stack);
      setError(err.message || "Google sign-in failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  /* ── Email sign-in ──────────────────────────── */
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    console.log("[SIGN-IN] Email sign-in started");
    console.log("[SIGN-IN] email:", email);
    console.log("[SIGN-IN] redirect:", redirect);
    setLoading("email");
    setError("");
    try {
      console.log("[SIGN-IN] Calling signIn.email({ email, password, callbackURL: redirect })");
      const result = await signIn.email({ email, password, callbackURL: redirect });
      console.log("[SIGN-IN] signIn.email result:", JSON.stringify(result, null, 2));
      console.log("[SIGN-IN] result.error:", result?.error);
      console.log("[SIGN-IN] result.data:", result?.data);

      if (result?.error) {
        console.log("[SIGN-IN] Auth error:", result.error.message);
        setError(result.error.message ?? "Invalid email or password.");
      } else {
        console.log("[SIGN-IN] Email sign-in successful, redirecting to:", redirect);
        router.push(redirect);
      }
    } catch (err: any) {
      console.error("[SIGN-IN] Email sign-in error:", err);
      console.error("[SIGN-IN] Error message:", err.message);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className="glass glow-violet"
      style={{ width: "100%", maxWidth: 440, padding: "2.5rem 2rem", position: "relative", zIndex: 10 }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "2rem" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none" }}>
          <div style={{
            width: 34, height: 34, borderRadius: "10px",
            background: "linear-gradient(135deg, #6C3AE8, #00D4FF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, color: "#fff", fontSize: "1rem",
          }}>K</div>
          <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)" }}>KStudy</span>
        </Link>
      </div>

      <h1 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: "0.35rem" }}>Welcome back</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1.75rem" }}>
        Sign in to access your AI study agent.
      </p>

      {/* Google button */}
      <button
        id="google-signin-btn"
        onClick={handleGoogle}
        disabled={!!loading}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.65rem",
          padding: "0.78rem",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "0.75rem",
          color: "var(--text-primary)",
          fontFamily: "inherit", fontWeight: 600, fontSize: "0.9rem",
          cursor: "pointer",
          transition: "background 0.2s, border-color 0.2s",
          marginBottom: "1.5rem",
          opacity: loading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; } }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
      >
        {loading === "google" ? (
          <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
        ) : <GoogleIcon />}
        Continue with Google
      </button>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>or sign in with email</span>
        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
      </div>

      {/* Email form */}
      <form onSubmit={handleEmail} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "0.75rem", padding: "0.65rem 1rem", fontSize: "0.83rem", color: "#f87171" }}>
            ⚠️ {error}
          </div>
        )}

        <div>
          <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: "0.35rem", letterSpacing: "0.05em" }}>EMAIL</label>
          <input
            id="email-input"
            type="email" required
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            onFocus={(e)  => { e.target.style.borderColor = "var(--violet-light)"; e.target.style.boxShadow = "0 0 0 3px rgba(108,58,232,0.15)"; }}
            onBlur={(e)   => { e.target.style.borderColor = "rgba(108,58,232,0.25)"; e.target.style.boxShadow = "none"; }}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.05em" }}>PASSWORD</label>
            <a href="#" style={{ fontSize: "0.75rem", color: "var(--violet-light)", textDecoration: "none" }}>Forgot password?</a>
          </div>
          <input
            id="password-input"
            type="password" required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            onFocus={(e)  => { e.target.style.borderColor = "var(--violet-light)"; e.target.style.boxShadow = "0 0 0 3px rgba(108,58,232,0.15)"; }}
            onBlur={(e)   => { e.target.style.borderColor = "rgba(108,58,232,0.25)"; e.target.style.boxShadow = "none"; }}
          />
        </div>

        <button
          id="email-signin-btn"
          type="submit"
          className="btn-primary"
          disabled={!!loading}
          style={{ justifyContent: "center", padding: "0.85rem", fontSize: "0.93rem", marginTop: "0.25rem", opacity: loading ? 0.7 : 1 }}
        >
          {loading === "email" ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
              Signing in...
            </span>
          ) : "Sign In →"}
        </button>
      </form>

      {/* Sign up link */}
      <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.83rem", color: "var(--text-muted)" }}>
        Don't have an account?{" "}
        <Link href="/sign-up" style={{ color: "var(--violet-light)", fontWeight: 600, textDecoration: "none" }}>
          Sign up free
        </Link>
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="glass glow-violet" style={{ width: "100%", maxWidth: 440, height: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }} />
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
