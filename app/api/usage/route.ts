import { getAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth    = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db     = client.db("kstudy");

    const user = await db.collection("user").findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isSubscribed = user.subscriptionActive ?? false;
    let budget = 0.00;
    let used = 0.00;
    let status = user.status || "inactive";

    if (isSubscribed) {
      status = user.status || "active";
      
      // Fallback values from MongoDB
      budget = user.monthly_budget_usd ?? 3.00;
      used = user.used_this_month_usd ?? 0.00;

      // Try to read live, authoritative data from Redis
      const redisUri = process.env.REDIS_URI;
      if (redisUri) {
        try {
          const { createClient } = await import("redis");
          const redis = createClient({ url: redisUri });
          
          // Use short connection timeout (2 seconds)
          await redis.connect();
          
          const profile = user.profile_name || `cust_${user._id}`;
          const usedKey = `kstudy:quota:${profile}:used`;
          const limitKey = `kstudy:quota:${profile}:limit`;
          
          const [redisUsed, redisLimit] = await Promise.all([
            redis.get(usedKey),
            redis.get(limitKey)
          ]);
          
          await redis.quit();

          if (redisUsed !== null) {
            used = parseFloat(redisUsed);
          }
          if (redisLimit !== null) {
            budget = parseFloat(redisLimit);
          }
        } catch (redisErr) {
          console.error("Dashboard API failed to read from Redis (falling back to Mongo):", redisErr);
        }
      }
    } else {
      // Free users always show $0.00 budget and $0.00 used
      budget = 0.00;
      used = 0.00;
      status = "inactive";
    }

    const remaining = Math.max(0, budget - used);
    const pctUsed   = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
    const resetDate = user.subscription_period_end ?? null;

    return NextResponse.json({
      email:                user.email,
      subscription_active:  isSubscribed,
      subscription_plan:    user.subscriptionPlan ?? "free",
      monthly_budget_usd:   Math.round(budget * 100) / 100,
      used_this_month_usd:  Math.round(used * 100) / 100,
      remaining_usd:        Math.round(remaining * 100) / 100,
      pct_used:             Math.round(pctUsed * 10) / 10,
      status:               status,
      bot_username:         user.bot_username ?? null,
      bot_connected:        user.telegramBotConnected ?? false,
      reset_date:           resetDate,
    });
  } catch (err) {
    console.error("Usage endpoint error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
