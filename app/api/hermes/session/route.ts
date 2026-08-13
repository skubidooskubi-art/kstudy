import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HERMES_TARGET = process.env.HERMES_WEB_URL || "http://10.0.1.1:8787";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id parameter." }, { status: 400 });
    }

    const targetUrl = `${HERMES_TARGET}/api/session?session_id=${encodeURIComponent(sessionId)}`;
    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 }
      );
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Hermes session GET route error:", error);
    return NextResponse.json({ error: "Failed to fetch session." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = `${HERMES_TARGET}/api/session/new`;

    const upstreamRes = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 }
      );
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Hermes session POST route error:", error);
    return NextResponse.json({ error: "Failed to create new session." }, { status: 500 });
  }
}
