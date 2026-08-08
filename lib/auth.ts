import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import clientPromise from "@/lib/db";

// Singleton — built once per server process
let authInstance: any = null;

export async function getAuth(): Promise<any> {
  if (authInstance) return authInstance;

  const client = await clientPromise;
  const db     = client.db("kstudy");

  authInstance = betterAuth({
    // ── Secret & Base URL ─────────────────────────────────────
    secret:  process.env.BETTER_AUTH_SECRET ?? "change-me-in-production",
    baseURL: process.env.BETTER_AUTH_URL   ?? "http://localhost:3000",

    // ── Database ──────────────────────────────────────────────
    database: mongodbAdapter(db, {
      client: client,
      transaction: false,
    }),

    // ── Email & Password ──────────────────────────────────────
    emailAndPassword: {
      enabled:                  true,
      requireEmailVerification: false,
    },

    // ── Social Providers ──────────────────────────────────────
    socialProviders: {
      google: {
        clientId:     process.env.GOOGLE_CLIENT_ID     as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    },

    // ── Session ───────────────────────────────────────────────
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    // ── Extra user fields (subscription) ──────────────────────
    user: {
      additionalFields: {
        subscriptionPlan:   { type: "string",  default: "free"  },
        subscriptionActive: { type: "boolean", default: false   },
        accessCode:         { type: "string",  required: false  },
        telegramBotToken:   { type: "string",  required: false  },
        telegramBotConnected:{ type: "boolean", default: false   },
        telegramChatId:       { type: "string",  required: false  },
        monthly_budget_usd:   { type: "number",  default: 1.50    },
        used_this_month_usd:  { type: "number",  default: 0       },
        bot_username:         { type: "string",  required: false  },
        bot_first_name:       { type: "string",  required: false  },
        status:               { type: "string",  default: "pending_profile" },
        profile_name:         { type: "string",  required: false  },
        provisioned_at:       { type: "date",    required: false  },
        subscription_period_end: { type: "date", required: false  },
      },
    },
    advanced: {
      cookiePrefix: "kstudy",
      crossSubDomainCookies: { enabled: false },
      defaultCookieAttributes: {
        secure: true,
        sameSite: "lax",
      },
    },
  });

  return authInstance;
}
