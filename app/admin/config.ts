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
      id: "free",
      name: "Free Trial",
      priceUSD: 0,
      priceNGN: 0,
      credits: 1.50,
      periodDays: 30,
      description: "Basic access for clinical assistant trials",
      features: [
        "Up to 2 files analysis",
        "Hermes model reasoning access",
        "1.50 USD monthly usage credit",
      ],
    },
    {
      id: "basic",
      name: "Basic Plan",
      priceUSD: 10,
      priceNGN: 15000,
      credits: 15.00,
      periodDays: 30,
      description: "Essential tools for students and practitioners",
      features: [
        "Up to 10 files analysis",
        "Higher priority response speeds",
        "15.00 USD monthly usage credit",
        "Telegram bot integration",
      ],
    },
    {
      id: "premium",
      name: "Premium Scholar",
      priceUSD: 25,
      priceNGN: 38000,
      credits: 50.00,
      periodDays: 30,
      description: "Complete analytical access with high resource ceilings",
      features: [
        "Unlimited file analysis",
        "Highest priority reasoning speeds",
        "50.00 USD monthly usage credit",
        "Telegram bot integration",
        "Early access to new models",
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
