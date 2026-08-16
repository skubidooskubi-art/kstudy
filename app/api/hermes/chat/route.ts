import { getAuth } from "@/lib/auth";
import clientPromise from "@/lib/db";
import {
  getProfileCookie,
  ownsResource,
  registerResource,
  type HermesResourceRecord,
} from "@/lib/hermes-access";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HERMES_TARGET = process.env.HERMES_WEB_URL || "http://10.0.1.1:8787";

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (typeof body.session_id !== "string" || !body.session_id) {
      return NextResponse.json({ error: "Missing session_id." }, { status: 400 });
    }

    const client = await clientPromise;
    const resources = client.db("kstudy").collection<HermesResourceRecord>("hermes_resources");
    if (!(await ownsResource(resources, "session", body.session_id, session.user.id))) {
      return NextResponse.json({ error: "Hermes resource not found." }, { status: 404 });
    }

    const cookie = await getProfileCookie(req);
    const upstreamRes = await fetch(`${HERMES_TARGET}/api/chat/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      return NextResponse.json(
        { error: `Upstream error: ${errText || upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 },
      );
    }

    const data = await upstreamRes.json();
    if (typeof data?.stream_id !== "string" || !data.stream_id) {
      return NextResponse.json({ error: "Hermes returned an invalid stream." }, { status: 502 });
    }

    await registerResource(resources, {
      kind: "stream",
      resourceId: data.stream_id,
      ownerId: session.user.id,
      sessionId: body.session_id,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Hermes chat start POST route error:", error);
    return NextResponse.json({ error: "Failed to start chat completion." }, { status: 500 });
  }
}
