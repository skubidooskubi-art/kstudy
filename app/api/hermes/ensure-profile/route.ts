import { getAuth } from "@/lib/auth";
import { ensureWebProfile } from "@/lib/provision";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/hermes/ensure-profile
 *
 * Idempotently ensures a subscribed user has their own isolated web-only Hermes
 * profile. Called by the chat page on mount so a paying customer can chat on
 * the web WITHOUT first creating a Telegram bot.
 *
 * Always returns 200 with a small JSON status; provisioning failures are
 * reported but never block the client (chat falls back to the shared trial
 * profile via getProfileCookie()).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await ensureWebProfile(session.user.email);
    return NextResponse.json(result);
  } catch (error) {
    console.error("ensure-profile route error:", error);
    // Fail soft: never block chat on a provisioning hiccup.
    return NextResponse.json({
      provisioned: false,
      profileName: null,
      status: "provision_failed",
      error: "internal error",
    });
  }
}
