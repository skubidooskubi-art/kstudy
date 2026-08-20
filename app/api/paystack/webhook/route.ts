import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import clientPromise from "@/lib/db";
import { sendAccessCodeEmail } from "@/lib/mail";
import { ensureWebProfile } from "@/lib/provision";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";

  // Verify webhook signature
  const hash = crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(rawBody)
    .digest("hex");

  if (hash !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "charge.success") {
    const { customer, metadata, amount, reference } = event.data;
    const email = customer?.email;
    const plan  = metadata?.plan ?? "student";

    try {
      const client = await clientPromise;
      const db     = client.db("kstudy");

      // Generate a unique 6-character alphanumeric code: e.g. KSTUDY-Z7B8P9
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const accessCode = `KSTUDY-${randomPart}`;

      // Get user name for personalization if user exists
      const user = await db.collection("user").findOne({ email });
      const userName = user?.name;

      // Update user subscription status & assign access code
      // Renewal = NEW subscription cycle: reset ALL usage/credit to 0 so
      // the user gets their fresh credit allowance for the new 30 days.
      await db.collection("user").updateOne(
        { email },
        {
          $set: {
            subscriptionPlan:   plan,
            subscriptionActive: true,
            subscriptionRef:    reference,
            subscribedAt:       new Date(),
            // Amount is in kobo (NGN) — divide by 100
            amountPaid:         amount / 100,
            accessCode:         accessCode,
            // ── fresh cycle: reset usage to 0 ──
            used_this_month_usd: 0.0,
            monthly_budget_usd:  3.00,
            last_used:           "",
            last_reset_at:       new Date(),
          },
        }
      );

      // Mirror the fresh state into Redis immediately (if configured).
      // If REDIS_URI is not set here, quota_engine's lazy sync picks it
      // up from Mongo within ~60s automatically.
      try {
        const redisUri = process.env.REDIS_URI;
        if (redisUri) {
          const { createClient } = await import("redis");
          const redis = createClient({ url: redisUri });
          redis.on("error", () => {});
          await redis.connect();
          const profile = user?.profile_name || `cust_${user?._id}`;
          const p = redis.multi();
          p.set(`kstudy:quota:${profile}:used`, "0");
          p.set(`kstudy:quota:${profile}:limit`, String(3.0));
          p.set(`kstudy:quota:${profile}:subscription`, "1");
          p.set(`kstudy:quota:${profile}:plan`, plan);
          await p.exec();
          await redis.quit();
        }
      } catch (redisErr) {
        console.error("Webhook Redis mirror failed (non-fatal):", redisErr);
      }

      // Log the transaction
      await db.collection("transactions").insertOne({
        email,
        reference,
        plan,
        amount:    amount / 100,
        currency:  event.data.currency,
        status:    "success",
        createdAt: new Date(),
      });

      // Send confirmation email containing the access code and setup steps
      await sendAccessCodeEmail(email, accessCode, userName);

      // ── Provision the customer's OWN isolated profile at subscription time ──
      // A paying customer should immediately get their own scrubbed cust_
      // profile for web chat — NOT the shared trial profile and NEVER the
      // owner's "default" profile. This creates a WEB-ONLY profile (no bot
      // token, no Telegram gateway); a personal Telegram bot is merged into
      // this SAME profile later, only if/when they connect one.
      //
      // Fail-soft: ensureWebProfile never throws. If the provision API is
      // briefly unreachable, the profile_watcher backstop picks it up, and the
      // chat page's ensure-profile call is a further safety net — so we still
      // ACK the webhook (a 500 would make Paystack retry the whole event).
      try {
        const prov = await ensureWebProfile(email);
        console.log(`[webhook] ensureWebProfile(${email}): ${prov.status}` +
          (prov.profileName ? ` -> ${prov.profileName}` : ""));
      } catch (provErr) {
        console.error("[webhook] ensureWebProfile failed (non-fatal):", provErr);
      }

    } catch (err) {
      console.error("Webhook DB/Mail error:", err);
      return NextResponse.json({ error: "Server error during webhook processing" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
