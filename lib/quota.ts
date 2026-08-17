import clientPromise from "@/lib/db";

/**
 * Server-side quota gate for the web-app chat path.
 *
 * WHY: the Hermes WebUI chat path (POST /api/chat/start upstream) does not
 * enforce KStudy customer quotas — only the Telegram gateway does. Without a
 * gate here, a web-only customer could keep chatting past their $1.50 budget.
 * usage_sync.py keeps used_this_month_usd fresh (state.db -> Mongo + Redis)
 * every ~2 min; this helper reads that state and decides allow/deny BEFORE we
 * spend anything upstream.
 *
 * SOURCE OF TRUTH: MongoDB (kstudy.user.used_this_month_usd / monthly_budget_usd
 * / subscriptionActive) is authoritative and always present. Redis is an
 * OPTIONAL fast path, used only when REDIS_URI is configured (it is not, in the
 * current container) — so we default to Mongo and treat Redis as an accelerator,
 * never a requirement.
 *
 * FAIL-OPEN: on any unexpected error we allow the request. A billing check must
 * never hard-block a paying customer because of a transient infra hiccup; the
 * ~2-min sync + dashboard remain the backstop.
 */

export type QuotaDecision = {
  allowed: boolean;
  reason?: string;
  used?: number;
  limit?: number;
};

const DEFAULT_LIMIT = 1.5;

function profileFor(user: { profile_name?: string; _id?: unknown }): string {
  return user.profile_name || `cust_${String(user._id)}`;
}

/**
 * Try to read the live used/limit from Redis. Returns null when Redis is not
 * configured or unreachable, so the caller falls back to Mongo values.
 */
async function readRedisOverrides(
  profile: string,
): Promise<{ used?: number; limit?: number } | null> {
  const redisUri = process.env.REDIS_URI;
  if (!redisUri) return null;

  try {
    const { createClient } = await import("redis");
    const redis = createClient({ url: redisUri });
    // Never let a Redis hiccup throw past this helper.
    redis.on("error", () => {});
    await redis.connect();
    try {
      const [used, limit] = await Promise.all([
        redis.get(`kstudy:quota:${profile}:used`),
        redis.get(`kstudy:quota:${profile}:limit`),
      ]);
      const out: { used?: number; limit?: number } = {};
      if (used !== null) out.used = parseFloat(used);
      if (limit !== null) out.limit = parseFloat(limit);
      return out;
    } finally {
      await redis.quit().catch(() => {});
    }
  } catch {
    return null;
  }
}

/**
 * Decide whether the given user may start a new chat turn.
 * cust_* profiles only — the main account and non-customer profiles are never
 * gated (mirrors quota_engine.is_customer_profile()).
 */
export async function checkQuotaForEmail(email: string): Promise<QuotaDecision> {
  try {
    const client = await clientPromise;
    const user = await client.db("kstudy").collection("user").findOne({ email });

    if (!user) {
      // No customer record — not a paying customer we meter; let it through.
      return { allowed: true };
    }

    const profile = profileFor(user as { profile_name?: string; _id?: unknown });
    // Only meter customer profiles.
    if (!profile.startsWith("cust_")) {
      return { allowed: true };
    }

    // Subscription must be active.
    if (!(user.subscriptionActive ?? false)) {
      return {
        allowed: false,
        reason: "⚠️ Your subscription is inactive. Please renew on the dashboard to continue.",
      };
    }

    // Mongo is the source of truth; Redis (if present) can override with fresher values.
    let used = Number(user.used_this_month_usd ?? 0) || 0;
    let limit = Number(user.monthly_budget_usd ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;

    const redis = await readRedisOverrides(profile);
    if (redis) {
      if (typeof redis.used === "number" && !Number.isNaN(redis.used)) used = redis.used;
      if (typeof redis.limit === "number" && !Number.isNaN(redis.limit)) limit = redis.limit;
    }

    if (used >= limit) {
      return {
        allowed: false,
        used,
        limit,
        reason: `⚠️ You've used all your credits ($${used.toFixed(2)} of $${limit.toFixed(2)}) for this cycle. Please top up on the dashboard to keep chatting.`,
      };
    }

    return { allowed: true, used, limit };
  } catch (err) {
    // Fail open: never block a paying customer on an infra error.
    console.error("[quota] check failed (allowing):", err);
    return { allowed: true };
  }
}
