import { getAuth } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { getOwnedSessionIds, type HermesResourceRecord } from "@/lib/hermes-access";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HERMES_TARGET = process.env.HERMES_WEB_URL || "http://10.0.1.1:8787";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const upstreamRes = await fetch(`${HERMES_TARGET}/api/sessions`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 },
      );
    }

    const data = await upstreamRes.json();
    const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
    const client = await clientPromise;
    const resources = client.db("kstudy").collection<HermesResourceRecord>("hermes_resources");
    const ownedIds = await getOwnedSessionIds(resources, session.user.id);

    return NextResponse.json({
      ...data,
      sessions: sessions.filter(
        (item: { session_id?: unknown }) =>
          typeof item.session_id === "string" && ownedIds.has(item.session_id),
      ),
    });
  } catch (error) {
    console.error("Hermes sessions list GET route error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions list." }, { status: 500 });
  }
}
