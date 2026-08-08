import { getAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/db";

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

    const budget      = user.monthly_budget_usd ?? 1.50;
    const used        = user.used_this_month_usd ?? 0;
    const remaining   = Math.max(0, budget - used);
    const pctUsed     = budget > 0 ? Math.min(100, (used / budget) * 100) : 0;
    const status      = user.status || (user.subscriptionActive ? "active" : "inactive");
    const resetDate   = user.subscription_period_end ?? null;

    return NextResponse.json({
      email:                user.email,
      subscription_active:  user.subscriptionActive ?? false,
      subscription_plan:    user.subscriptionPlan ?? "free",
      monthly_budget_usd:   budget,
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
