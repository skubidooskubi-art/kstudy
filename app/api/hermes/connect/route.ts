import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/db";
import { getAuth } from "@/lib/auth";

const PROVISION_API_URL = process.env.HERMES_PROVISION_URL || "http://127.0.0.1:8645/provision";
const PROVISION_API_SECRET = process.env.PROVISION_API_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Missing bot token." }, { status: 400 });
    }

    if (!token.includes(":")) {
      return NextResponse.json({ error: "Invalid Telegram bot token format." }, { status: 400 });
    }

    // Get session from cookie to identify the logged-in user
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.email) {
      return NextResponse.json({ error: "You must be signed in to connect a bot." }, { status: 401 });
    }

    const client = await clientPromise;
    const db     = client.db("kstudy");

    // Find user by email from session
    const user = await db.collection("user").findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: "User not found. Please contact support." }, { status: 404 });
    }

    // Verify subscription status
    if (!user.subscriptionActive) {
      return NextResponse.json({ error: "Your subscription is not active. Please upgrade or subscribe first." }, { status: 403 });
    }

    // Fetch bot info from Telegram to get username and chat_id
    let botUsername = "";
    let botFirstName = "";
    try {
      const botInfoRes = await fetch(`https://api.telegram.org/bot${token.trim()}/getMe`);
      if (botInfoRes.ok) {
        const botInfo = await botInfoRes.json();
        botUsername   = botInfo.result?.username || "";
        botFirstName  = botInfo.result?.first_name || "";
      }
    } catch (e) {
      console.warn("Could not fetch bot info from Telegram:", e);
    }

    // Save Telegram bot connection to the user document
    await db.collection("user").updateOne(
      { _id: user._id },
      {
        $set: {
          telegramBotToken:     token.trim(),
          telegramBotConnected: true,
          telegramBotLinkedAt:  new Date(),
          bot_username:         botUsername,
          bot_first_name:       botFirstName,
        }
      }
    );

    // ── Call Hermes Provision API to create the profile and start the bot ──
    let provisionResult: { ok: boolean; profile?: string; bot_username?: string; error?: string } = { ok: false, error: "not attempted" };

    // If the user already has an isolated profile (e.g. a web-only profile
    // created on first web chat), ATTACH the bot to that same profile so their
    // existing chat history / workspace is preserved. Otherwise, provision a
    // fresh profile with the bot in one shot.
    const existingProfile = typeof user.profile_name === "string" && user.profile_name
      ? user.profile_name
      : "";
    const provisionUrl = existingProfile
      ? PROVISION_API_URL.replace(/\/provision$/, "/attach_bot")
      : PROVISION_API_URL;
    const customerId = existingProfile || `cust_${String(user._id)}`;

    if (PROVISION_API_SECRET) {
      try {
        const provRes = await fetch(provisionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${PROVISION_API_SECRET}`,
          },
          body: JSON.stringify({
            customer_id: customerId,
            bot_token:   token.trim(),
            tg_user_id:  user.telegramChatId || "",
            email:       user.email,
          }),
          signal: AbortSignal.timeout(45000), // 45s timeout (gateway start + bot check)
        });

        provisionResult = await provRes.json();

        // Update MongoDB with provisioning result
        if (provisionResult.ok) {
          await db.collection("user").updateOne(
            { _id: user._id },
            {
              $set: {
                status:              "active",
                profile_name:        provisionResult.profile || existingProfile || "",
                provisioned_at:      new Date(),
                monthly_budget_usd:  user.monthly_budget_usd ?? 3.0,
                used_this_month_usd: user.used_this_month_usd ?? 0,
              }
            }
          );
        } else {
          await db.collection("user").updateOne(
            { _id: user._id },
            { $set: { status: "provision_failed", provision_error: provisionResult.error } }
          );
        }
      } catch (provErr) {
        console.error("Hermes provision API call failed:", provErr);
        provisionResult = { ok: false, error: "Provision API unreachable" };

        await db.collection("user").updateOne(
          { _id: user._id },
          { $set: { status: "provision_pending", note: "Token saved, provisioning will retry via watcher" } }
        );
      }
    } else {
      // No provision secret configured — just save the token, watcher will pick it up
      await db.collection("user").updateOne(
        { _id: user._id },
        { $set: { status: "pending_profile", note: "Token saved, waiting for provision watcher" } }
      );
    }

    if (!provisionResult.ok) {
      // Be honest: token saved, but provisioning did not complete.
      // The profile watcher retries automatically, but the UI must not
      // claim "connected" when the bot is not actually running.
      return NextResponse.json({
        success: false,
        error: provisionResult.error || "Provisioning failed. Please try again or contact support.",
        provisioned: false,
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: "Hermes connected to your Telegram bot successfully!",
      email: user.email,
      bot_username: botUsername,
      provisioned: true,
    });

  } catch (err) {
    console.error("Hermes connection endpoint error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
