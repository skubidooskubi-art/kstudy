import clientPromise from "@/lib/db";
import type { WithId, Document } from "mongodb";

/**
 * Shared provisioning helpers for KStudy customer profiles.
 *
 * A KStudy customer gets their OWN isolated Hermes profile (`cust_<id>`), which
 * powers both:
 *   • the web chat (routed by the `hermes_profile` cookie to the shared WebUI
 *     backend), and
 *   • an optional personal Telegram bot (attached later).
 *
 * Historically the profile was created ONLY by the Telegram-linking flow
 * (paste a BotFather token → provision). That coupled "chat on the web" to
 * "create a Telegram bot". This helper decouples them: a subscriber can be
 * provisioned WEB-ONLY (no bot token, no Telegram gateway) and chat on the web
 * immediately. Linking Telegram later just attaches a bot to the same profile.
 */

const PROVISION_API_URL =
  process.env.HERMES_PROVISION_URL || "http://127.0.0.1:8645/provision";
const PROVISION_API_SECRET = process.env.PROVISION_API_SECRET || "";

/** The canonical profile slug for a user (matches quota.ts + connect route). */
export function customerIdFor(user: { profile_name?: string; _id: unknown }): string {
  return user.profile_name || `cust_${String(user._id)}`;
}

export type EnsureProfileResult = {
  /** True when the user has (or now has) an isolated cust_ profile. */
  provisioned: boolean;
  /** The profile name to route web chat to, or null to use the shared trial. */
  profileName: string | null;
  /** Machine-readable outcome for logging / the client. */
  status:
    | "already_provisioned"
    | "provisioned_web_only"
    | "not_subscribed"
    | "provision_unavailable"
    | "provision_failed";
  error?: string;
};

/** Does this look like a "profile already exists" response from the script? */
function isAlreadyExists(detail: unknown): boolean {
  const text =
    typeof detail === "string"
      ? detail
      : detail && typeof detail === "object"
        ? JSON.stringify(detail)
        : "";
  return /already exists/i.test(text);
}

/**
 * Ensure a subscribed user has an isolated web-only profile, creating one if
 * needed. Idempotent and safe to call on every chat mount.
 *
 * Rules:
 *   • Already has `profile_name`         → nothing to do (already_provisioned).
 *   • Not subscribed                     → no per-user profile (they use the
 *                                          shared `kstudy_free` trial profile).
 *   • Subscribed + no profile yet        → provision WEB-ONLY, persist
 *                                          `profile_name`, return it.
 *
 * Fail-soft: if the provision API is unreachable or errors, we DO NOT throw —
 * the caller falls back to the shared trial profile so chat still works. We
 * never block a paying customer on an infra hiccup.
 */
export async function ensureWebProfile(email: string): Promise<EnsureProfileResult> {
  const client = await clientPromise;
  const db = client.db("kstudy");
  const user = (await db.collection("user").findOne({ email })) as WithId<Document> | null;

  if (!user) {
    return { provisioned: false, profileName: null, status: "not_subscribed" };
  }

  // Already provisioned — route straight to their profile.
  if (user.profile_name) {
    return {
      provisioned: true,
      profileName: String(user.profile_name),
      status: "already_provisioned",
    };
  }

  // Only paying customers get an isolated profile; everyone else uses the
  // shared, fully-scrubbed trial profile (kstudy_free).
  if (!(user.subscriptionActive ?? false)) {
    return { provisioned: false, profileName: null, status: "not_subscribed" };
  }

  const customerId = `cust_${String(user._id)}`;

  // No secret configured → cannot call the provision API. Fail soft.
  if (!PROVISION_API_SECRET) {
    return {
      provisioned: false,
      profileName: null,
      status: "provision_unavailable",
      error: "PROVISION_API_SECRET not configured",
    };
  }

  try {
    const res = await fetch(PROVISION_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PROVISION_API_SECRET}`,
      },
      // Empty bot_token => web-only profile (no Telegram gateway).
      body: JSON.stringify({ customer_id: customerId, bot_token: "", tg_user_id: "" }),
      signal: AbortSignal.timeout(60_000),
    });

    const data = await res.json().catch(() => ({}) as Record<string, unknown>);

    // Success, OR the profile already exists on disk (treat as success and
    // just record the name — this covers retries / races).
    const ok = res.ok && (data as { ok?: boolean }).ok !== false;
    if (ok || isAlreadyExists((data as { detail?: unknown }).detail ?? data)) {
      const profileName =
        (data as { profile?: string }).profile || customerId;
      await db.collection("user").updateOne(
        { _id: user._id },
        {
          $set: {
            profile_name: profileName,
            status: "web_active",
            provisioned_at: new Date(),
            monthly_budget_usd: user.monthly_budget_usd ?? 3.0,
            used_this_month_usd: user.used_this_month_usd ?? 0,
          },
        },
      );
      return {
        provisioned: true,
        profileName,
        status: "provisioned_web_only",
      };
    }

    // Genuine failure — record it, but let chat fall back to the trial profile.
    const errText =
      (data as { detail?: unknown; error?: unknown }).detail ??
      (data as { error?: unknown }).error ??
      `provision API returned HTTP ${res.status}`;
    await db.collection("user").updateOne(
      { _id: user._id },
      { $set: { status: "provision_failed", provision_error: String(errText).slice(0, 500) } },
    );
    return {
      provisioned: false,
      profileName: null,
      status: "provision_failed",
      error: String(errText).slice(0, 500),
    };
  } catch (err) {
    // Network / timeout — fail soft. The profile watcher / a later retry can
    // still complete provisioning; chat uses the trial profile meanwhile.
    return {
      provisioned: false,
      profileName: null,
      status: "provision_unavailable",
      error: err instanceof Error ? err.message : "provision API unreachable",
    };
  }
}
