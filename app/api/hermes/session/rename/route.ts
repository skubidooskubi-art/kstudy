import { getAuth } from "@/lib/auth";
import clientPromise from "@/lib/db";
import {
  getProfileCookie,
  ownsResource,
  type HermesResourceRecord,
} from "@/lib/hermes-access";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HERMES_TARGET = process.env.HERMES_WEB_URL || "http://10.0.1.1:8787";

/**
 * Rename a chat session's title.
 *
 * Proxies to the Hermes WebUI `POST /api/session/rename` (body {session_id,
 * title}). Ownership is enforced here first — a user may only rename a session
 * their account owns (hermes_resources), matching the other /api/hermes/* routes.
 *
 * Used by the chat page's editable title (click-to-edit) and by the auto-title
 * step that names a fresh conversation after the first exchange.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.session_id === "string" ? body.session_id : "";
    const title = typeof body?.title === "string" ? body.title.trim() : "";

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id." }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Missing title." }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json({ error: "Title too long (max 200 chars)." }, { status: 400 });
    }

    // Ownership gate — only rename sessions this account owns.
    const client = await clientPromise;
    const resources = client
      .db("kstudy")
      .collection<HermesResourceRecord>("hermes_resources");
    if (!(await ownsResource(resources, "session", sessionId, session.user.id))) {
      return NextResponse.json({ error: "Hermes resource not found." }, { status: 404 });
    }

    const cookie = await getProfileCookie(req);
    const upstreamRes = await fetch(`${HERMES_TARGET}/api/session/rename`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({ session_id: sessionId, title }),
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Upstream error: ${errText || upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 },
      );
    }

    return NextResponse.json(await upstreamRes.json());
  } catch (error) {
    console.error("Hermes session rename route error:", error);
    return NextResponse.json({ error: "Failed to rename session." }, { status: 500 });
  }
}
