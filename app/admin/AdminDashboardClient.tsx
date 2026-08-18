"use client";

import { useState, useEffect } from "react";
import { 
  AdminSettings, 
  PricingPlan, 
  DEFAULT_ADMIN_SETTINGS, 
  getAdminSettings, 
  saveAdminSettings 
} from "./config";

export default function AdminDashboardClient({ email }: { email: string }) {
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [activeTab, setActiveTab] = useState<"plans" | "models" | "credits">("plans");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    async function load() {
      const data = await getAdminSettings();
      // Try to load from localStorage as client preview fallback
      if (typeof window !== "undefined") {
        const local = localStorage.getItem("kstudy_admin_settings_preview");
        if (local) {
          try {
            setSettings(JSON.parse(local));
            setLoading(false);
            return;
          } catch (e) {
            console.error("Local settings load failed", e);
          }
        }
      }
      setSettings(data);
      setLoading(false);
    }
    load();
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    // Optimistic Save to LocalStorage for preview
    if (typeof window !== "undefined") {
      localStorage.setItem("kstudy_admin_settings_preview", JSON.stringify(settings));
    }
    
    const success = await saveAdminSettings(settings);
    setSaving(false);
    
    if (success) {
      showToast("Settings synchronized with server successfully!");
    } else {
      showToast("Preview updated locally! (Backend API will persist this permanently once wired up.)", "success");
    }
  };

  // Helper to update specific plan field
  const updatePlan = (planId: string, field: keyof PricingPlan, value: any) => {
    setSettings((prev) => ({
      ...prev,
      plans: prev.plans.map((p) => (p.id === planId ? { ...p, [field]: value } : p)),
    }));
  };

  // Helper to add/remove feature from plan
  const addFeature = (planId: string) => {
    setSettings((prev) => ({
      ...prev,
      plans: prev.plans.map((p) => {
        if (p.id === planId) {
          return { ...p, features: [...p.features, "New Feature Benefit"] };
        }
        return p;
      }),
    }));
  };

  const removeFeature = (planId: string, index: number) => {
    setSettings((prev) => ({
      ...prev,
      plans: prev.plans.map((p) => {
        if (p.id === planId) {
          return { ...p, features: p.features.filter((_, i) => i !== index) };
        }
        return p;
      }),
    }));
  };

  const updateFeatureText = (planId: string, index: number, text: string) => {
    setSettings((prev) => ({
      ...prev,
      plans: prev.plans.map((p) => {
        if (p.id === planId) {
          const updated = [...p.features];
          updated[index] = text;
          return { ...p, features: updated };
        }
        return p;
      }),
    }));
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#070b14", color: "#64748b" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 40, height: 40, border: "3px solid #6366f1", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 1rem" }} />
          <div>Loading Admin Workspace...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, #0e172e, #070b14)", color: "#f1f5f9", fontFamily: "system-ui, sans-serif", padding: "2.5rem 1.5rem" }}>
      
      {/* Toast Alert */}
      {toast && (
        <div style={{
          position: "fixed", top: "1.5rem", right: "1.5rem", zIndex: 1000,
          background: toast.type === "success" ? "rgba(16,185,129,0.95)" : "rgba(239,68,68,0.95)",
          backdropFilter: "blur(12px)", color: "#fff", padding: "1rem 1.5rem", borderRadius: "0.85rem",
          boxShadow: "0 10px 25px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: "0.50rem",
          fontWeight: 600, fontSize: "0.9rem", transition: "all 0.3s", animation: "slideIn 0.3s ease-out"
        }}>
          <span>{toast.type === "success" ? "🛡️" : "⚠️"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Admin Card */}
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        
        {/* Header Block */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "1.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#6366f1", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <span>🛡️ Secure Gateway</span>
            </div>
            <h1 style={{ fontSize: "1.85rem", fontWeight: 800, color: "#f8fafc", marginTop: "0.3rem" }}>
              KStudy System Settings
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ display: "inline-block", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)", color: "#a5b4fc", fontSize: "0.80rem", padding: "0.35rem 0.85rem", borderRadius: "10px", fontWeight: 600 }}>
              Admin: {email}
            </span>
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: "2rem" }}>
          
          {/* Navigation Sidebar */}
          <aside>
            <nav style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <button
                onClick={() => setActiveTab("plans")}
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1.15rem",
                  background: activeTab === "plans" ? "rgba(99,102,241,0.15)" : "transparent",
                  border: "1px solid " + (activeTab === "plans" ? "rgba(99,102,241,0.3)" : "transparent"),
                  borderRadius: "0.85rem", color: activeTab === "plans" ? "#a5b4fc" : "#94a3b8",
                  cursor: "pointer", transition: "all 0.2s", fontWeight: 600, textAlign: "left", fontSize: "0.9rem"
                }}
              >
                <span>💳</span> Plans & Pricing
              </button>
              
              <button
                onClick={() => setActiveTab("models")}
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1.15rem",
                  background: activeTab === "models" ? "rgba(99,102,241,0.15)" : "transparent",
                  border: "1px solid " + (activeTab === "models" ? "rgba(99,102,241,0.3)" : "transparent"),
                  borderRadius: "0.85rem", color: activeTab === "models" ? "#a5b4fc" : "#94a3b8",
                  cursor: "pointer", transition: "all 0.2s", fontWeight: 600, textAlign: "left", fontSize: "0.9rem"
                }}
              >
                <span>🤖</span> AI Models & Costs
              </button>

              <button
                onClick={() => setActiveTab("credits")}
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem 1.15rem",
                  background: activeTab === "credits" ? "rgba(99,102,241,0.15)" : "transparent",
                  border: "1px solid " + (activeTab === "credits" ? "rgba(99,102,241,0.3)" : "transparent"),
                  borderRadius: "0.85rem", color: activeTab === "credits" ? "#a5b4fc" : "#94a3b8",
                  cursor: "pointer", transition: "all 0.2s", fontWeight: 600, textAlign: "left", fontSize: "0.9rem"
                }}
              >
                <span>⚙️</span> Credits & Budgets
              </button>
            </nav>
            
            <div style={{ marginTop: "3.5rem", padding: "1.2rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "1rem", fontSize: "0.80rem", color: "#64748b", lineHeight: 1.5 }}>
              <strong style={{ color: "#94a3b8", display: "block", marginBottom: "0.4rem" }}>Server Sync Status:</strong>
              These settings configure quotas, billing cycles, pricing metrics, and routing models.
            </div>
          </aside>

          {/* Configuration Canvas */}
          <main style={{ minWidth: 0 }}>
            
            {/* TABS 1: PLANS & PRICING */}
            {activeTab === "plans" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
                <div style={{ background: "rgba(15,23,42,0.45)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.25rem", padding: "1.75rem" }}>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>Manage Pricing Plans</h3>
                  <p style={{ fontSize: "0.83rem", color: "#94a3b8", margin: "0 0 1.5rem 0" }}>
                    Configure the values, limits, features, and durations for all student and practitioner tiers.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                    {settings.plans.map((plan) => (
                      <div key={plan.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "1rem", padding: "1.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem", borderBottom: "1px dashed rgba(255,255,255,0.08)", paddingBottom: "0.75rem" }}>
                          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#a5b4fc", textTransform: "capitalize" }}>{plan.name} Tier</span>
                          <span style={{ fontSize: "0.72rem", background: "rgba(255,255,255,0.08)", color: "#94a3b8", padding: "0.15rem 0.5rem", borderRadius: "0.3rem", fontWeight: 700 }}>ID: {plan.id}</span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem", marginBottom: "1.25rem" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.35rem", fontWeight: 600 }}>Plan Display Name</label>
                            <input
                              type="text"
                              value={plan.name}
                              onChange={(e) => updatePlan(plan.id, "name", e.target.value)}
                              style={{ width: "100%", background: "#0b111e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.85rem", outline: "none" }}
                            />
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.35rem", fontWeight: 600 }}>Billing Duration (Days)</label>
                            <input
                              type="number"
                              min={1}
                              value={plan.periodDays}
                              onChange={(e) => updatePlan(plan.id, "periodDays", parseInt(e.target.value) || 30)}
                              style={{ width: "100%", background: "#0b111e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.85rem", outline: "none" }}
                            />
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.35rem", fontWeight: 600 }}>Price (USD)</label>
                            <input
                              type="number"
                              min={0}
                              value={plan.priceUSD}
                              onChange={(e) => updatePlan(plan.id, "priceUSD", parseFloat(e.target.value) || 0)}
                              style={{ width: "100%", background: "#0b111e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.85rem", outline: "none" }}
                            />
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.35rem", fontWeight: 600 }}>Price (NGN)</label>
                            <input
                              type="number"
                              min={0}
                              value={plan.priceNGN}
                              onChange={(e) => updatePlan(plan.id, "priceNGN", parseFloat(e.target.value) || 0)}
                              style={{ width: "100%", background: "#0b111e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.85rem", outline: "none" }}
                            />
                          </div>

                          <div>
                            <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.35rem", fontWeight: 600 }}>Usage Credits Granted (USD)</label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={plan.credits}
                              onChange={(e) => updatePlan(plan.id, "credits", parseFloat(e.target.value) || 0)}
                              style={{ width: "100%", background: "#0b111e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.85rem", outline: "none" }}
                            />
                          </div>
                        </div>

                        <div style={{ marginBottom: "1.25rem" }}>
                          <label style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.35rem", fontWeight: 600 }}>Description Subtitle</label>
                          <input
                            type="text"
                            value={plan.description}
                            onChange={(e) => updatePlan(plan.id, "description", e.target.value)}
                            style={{ width: "100%", background: "#0b111e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", color: "#fff", fontSize: "0.85rem", outline: "none" }}
                          />
                        </div>

                        {/* Feature bullets list */}
                        <div>
                          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.5rem", fontWeight: 600 }}>
                            <span>Features & Benefits Included</span>
                            <button
                              onClick={() => addFeature(plan.id)}
                              style={{ background: "rgba(99,102,241,0.15)", border: "none", color: "#a5b4fc", cursor: "pointer", fontSize: "0.70rem", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 700 }}
                            >
                              + Add Feature
                            </button>
                          </label>
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                            {plan.features.map((feature, fIdx) => (
                              <div key={fIdx} style={{ display: "flex", gap: "0.5rem" }}>
                                <input
                                  type="text"
                                  value={feature}
                                  onChange={(e) => updateFeatureText(plan.id, fIdx, e.target.value)}
                                  style={{ flex: 1, background: "#0b111e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "0.4rem", padding: "0.4rem 0.6rem", color: "#e2e8f0", fontSize: "0.80rem", outline: "none" }}
                                />
                                <button
                                  onClick={() => removeFeature(plan.id, fIdx)}
                                  title="Delete"
                                  style={{ background: "rgba(239,68,68,0.1)", border: "none", color: "#f87171", cursor: "pointer", padding: "0 0.5rem", borderRadius: "0.4rem", fontSize: "0.75rem" }}
                                >
                                  🗑️
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* VISUAL CARDS PREVIEW */}
                <div>
                  <h4 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff", marginBottom: "1rem" }}>Preview Plan Cards (Normal User View)</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
                    {settings.plans.map((plan) => (
                      <div key={plan.id} style={{
                        background: plan.id === "premium" ? "linear-gradient(135deg, rgba(30,27,75,0.6), rgba(15,23,42,0.8))" : "rgba(15,23,42,0.65)",
                        border: plan.id === "premium" ? "2px solid #6366f1" : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "1.25rem", padding: "1.5rem", display: "flex", flexDirection: "column",
                        boxShadow: plan.id === "premium" ? "0 10px 30px rgba(99,102,241,0.25)" : "none",
                        position: "relative"
                      }}>
                        {plan.id === "premium" && (
                          <span style={{ position: "absolute", top: "-10px", right: "1.5rem", background: "linear-gradient(90deg, #6366f1, #3b82f6)", color: "#fff", fontSize: "0.68rem", fontWeight: 800, padding: "0.2rem 0.6rem", borderRadius: "10px", textTransform: "uppercase" }}>
                            Popular Choice
                          </span>
                        )}
                        <h5 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 0.3rem 0", color: "#fff" }}>{plan.name}</h5>
                        <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0 0 1.25rem 0" }}>{plan.description}</p>
                        
                        <div style={{ marginBottom: "1.25rem" }}>
                          <span style={{ fontSize: "1.75rem", fontWeight: 800, color: "#fff" }}>
                            {plan.priceUSD === 0 ? "Free" : `$${plan.priceUSD}`}
                          </span>
                          {plan.priceUSD > 0 && <span style={{ fontSize: "0.78rem", color: "#64748b" }}> / {plan.periodDays} days</span>}
                          {plan.priceNGN > 0 && (
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.15rem" }}>
                              Or ₦{plan.priceNGN.toLocaleString()}
                            </div>
                          )}
                        </div>

                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1rem", flex: 1 }}>
                          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                            {plan.features.map((feature, idx) => (
                              <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "0.45rem", fontSize: "0.78rem", color: "#cbd5e1" }}>
                                <span style={{ color: "#34d399", fontWeight: 700 }}>✓</span>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TABS 2: AI MODELS & TOKENS */}
            {activeTab === "models" && (
              <div style={{ background: "rgba(15,23,42,0.45)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.25rem", padding: "1.75rem" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>AI Model & Cost Adjustments</h3>
                <p style={{ fontSize: "0.83rem", color: "#94a3b8", margin: "0 0 1.5rem 0" }}>
                  Define the default routing models and price configurations for the Gemini API backend integrations.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem", fontWeight: 600 }}>Default Model Route</label>
                      <select
                        value={settings.models.defaultModel}
                        onChange={(e) => setSettings((prev) => ({
                          ...prev,
                          models: { ...prev.models, defaultModel: e.target.value }
                        }))}
                        style={{ width: "100%", background: "#0b111e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.6rem", padding: "0.6rem 0.85rem", color: "#fff", fontSize: "0.85rem", outline: "none", cursor: "pointer" }}
                      >
                        <option value="gemini-2.0-flash-thinking-exp">gemini-2.0-flash-thinking-exp (Recommended)</option>
                        <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                        <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem", fontWeight: 600 }}>Fallback Model Route</label>
                      <select
                        value={settings.models.fallbackModel}
                        onChange={(e) => setSettings((prev) => ({
                          ...prev,
                          models: { ...prev.models, fallbackModel: e.target.value }
                        }))}
                        style={{ width: "100%", background: "#0b111e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.6rem", padding: "0.6rem 0.85rem", color: "#fff", fontSize: "0.85rem", outline: "none", cursor: "pointer" }}
                      >
                        <option value="gemini-1.5-pro">gemini-1.5-pro (Recommended)</option>
                        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                        <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginTop: "0.5rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem", fontWeight: 600 }}>Input Cost Per Million Tokens (USD)</label>
                      <input
                        type="number"
                        step="0.001"
                        min={0}
                        value={settings.models.inputCostPerMillion}
                        onChange={(e) => setSettings((prev) => ({
                          ...prev,
                          models: { ...prev.models, inputCostPerMillion: parseFloat(e.target.value) || 0 }
                        }))}
                        style={{ width: "100%", background: "#0b111e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.6rem", padding: "0.6rem 0.85rem", color: "#fff", fontSize: "0.85rem", outline: "none" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem", fontWeight: 600 }}>Output Cost Per Million Tokens (USD)</label>
                      <input
                        type="number"
                        step="0.001"
                        min={0}
                        value={settings.models.outputCostPerMillion}
                        onChange={(e) => setSettings((prev) => ({
                          ...prev,
                          models: { ...prev.models, outputCostPerMillion: parseFloat(e.target.value) || 0 }
                        }))}
                        style={{ width: "100%", background: "#0b111e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.6rem", padding: "0.6rem 0.85rem", color: "#fff", fontSize: "0.85rem", outline: "none" }}
                      />
                    </div>
                  </div>

                  {/* TOKENS COST CALCULATOR PREVIEW */}
                  <div style={{ marginTop: "1.5rem", padding: "1.2rem", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: "0.85rem" }}>
                    <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#a5b4fc", margin: "0 0 0.5rem 0", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      💡 Token Costs Calculator (Simulation)
                    </h4>
                    <p style={{ fontSize: "0.78rem", color: "#cbd5e1", margin: 0, lineHeight: 1.5 }}>
                      Under current pricing, a single case analysis of <strong style={{ color: "#fff" }}>50,000 input tokens</strong> and <strong style={{ color: "#fff" }}>15,000 output tokens</strong> costs:
                      <br />
                      <strong style={{ color: "var(--cyan)", fontSize: "0.95rem", display: "inline-block", marginTop: "0.35rem" }}>
                        ${((50000 * settings.models.inputCostPerMillion / 1000000) + (15000 * settings.models.outputCostPerMillion / 1000000)).toFixed(5)} USD
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TABS 3: CREDITS & BUDGETS */}
            {activeTab === "credits" && (
              <div style={{ background: "rgba(15,23,42,0.45)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "1.25rem", padding: "1.75rem" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>Credits & SignUp Quotas</h3>
                <p style={{ fontSize: "0.83rem", color: "#94a3b8", margin: "0 0 1.5rem 0" }}>
                  Adjust how many complimentary credits new users receive upon email validation and account signup.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem", fontWeight: 600 }}>SignUp Bonus Credit (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={settings.credits.signupBonusCredits}
                        onChange={(e) => setSettings((prev) => ({
                          ...prev,
                          credits: { ...prev.credits, signupBonusCredits: parseFloat(e.target.value) || 0 }
                        }))}
                        style={{ width: "100%", background: "#0b111e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.6rem", padding: "0.6rem 0.85rem", color: "#fff", fontSize: "0.85rem", outline: "none" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem", fontWeight: 600 }}>Default Free Monthly Budget (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={settings.credits.monthlyBudgetUSD}
                        onChange={(e) => setSettings((prev) => ({
                          ...prev,
                          credits: { ...prev.credits, monthlyBudgetUSD: parseFloat(e.target.value) || 0 }
                        }))}
                        style={{ width: "100%", background: "#0b111e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.6rem", padding: "0.6rem 0.85rem", color: "#fff", fontSize: "0.85rem", outline: "none" }}
                      />
                    </div>
                  </div>

                  <div style={{ padding: "1.2rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "0.85rem", fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.5 }}>
                    📌 **Quota Gate Logic:** When a user is not subscribed to a paid plan, their monthly budget limits their usage. The API route checks if `used_this_month_usd` has exceeded this setting before calling the upstream model.
                  </div>
                </div>
              </div>
            )}

            {/* FLOATING ACTION BUTTON */}
            <div style={{ marginTop: "2.5rem", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  border: "none", borderRadius: "0.85rem", color: "#fff",
                  fontSize: "0.95rem", fontWeight: 700, padding: "0.9rem 2.25rem",
                  cursor: "pointer", transition: "all 0.2s",
                  boxShadow: "0 6px 20px rgba(99,102,241,0.4)",
                  display: "flex", alignItems: "center", gap: "0.5rem"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1.0")}
              >
                {saving ? (
                  <>
                    <span style={{ width: 14, height: 14, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <span>💾</span> Save All Settings
                  </>
                )}
              </button>
            </div>

          </main>
        </div>

      </div>

      {/* Embedded Animations Styling */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
