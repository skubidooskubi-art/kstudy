export interface PricingPlan {
  id: string;
  name: string;
  priceUSD: number;
  priceNGN: number;
  credits: number;
  periodDays: number;
  description: string;
  features: string[];
}

export interface ModelConfig {
  defaultModel: string;
  fallbackModel: string;
  inputCostPerMillion: number;  // USD
  outputCostPerMillion: number; // USD
}

export interface CreditConfig {
  signupBonusCredits: number;
  monthlyBudgetUSD: number;
}

export interface AdminSettings {
  plans: PricingPlan[];
  models: ModelConfig;
  credits: CreditConfig;
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  plans: [
    {
      id: "student",
      name: "Student Plan",
      priceUSD: 1.50,
      priceNGN: 2000,
      credits: 1.50,
      periodDays: 30,
      description: "Everything you need, for less than a coffee ☕",
      features: [
        "Unlimited AI messages on Telegram",
        "Assignments, essays & coding help",
        "Web search & research summaries",
        "Document & note generation",
        "Study planner & reminders",
        "24/7 availability",
        "Multi-language support",
        "Powered by Hermes AI (self-hosted)",
      ],
    },
  ],
  models: {
    defaultModel: "gemini-2.0-flash-thinking-exp",
    fallbackModel: "gemini-1.5-pro",
    inputCostPerMillion: 0.075,
    outputCostPerMillion: 0.30,
  },
  credits: {
    signupBonusCredits: 1.50,
    monthlyBudgetUSD: 1.50,
  },
};

// Mock API Call helpers (Frontend interface)
export async function getAdminSettings(): Promise<AdminSettings> {
  try {
    const res = await fetch("/api/admin/config");
    if (res.ok) {
      const data = await res.json();
      if (data.settings) return data.settings;
    }
  } catch (err) {
    console.warn("Failed to load settings from server, using local defaults:", err);
  }
  return DEFAULT_ADMIN_SETTINGS;
}

export async function saveAdminSettings(settings: AdminSettings): Promise<boolean> {
  console.log("[ADMIN] Mock API Save Payload:", settings);
  try {
    const res = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to save settings to server:", err);
    return false;
  }
}
