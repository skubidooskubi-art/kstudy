import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HERMES_TARGET = process.env.HERMES_WEB_URL || "http://10.0.1.1:8787";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.session_id) {
      return NextResponse.json({ error: "Missing session_id." }, { status: 400 });
    }

    const targetUrl = `${HERMES_TARGET}/api/chat/start`;

    const upstreamRes = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      return NextResponse.json(
        { error: `Upstream error: ${errText || upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 }
      );
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Hermes chat start POST route error:", error);
    return NextResponse.json({ error: "Failed to start chat completion." }, { status: 500 });
  }
}
