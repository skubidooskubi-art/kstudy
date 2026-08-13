import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HERMES_TARGET = process.env.HERMES_WEB_URL || "http://10.0.1.1:8787";

export async function GET(_req: NextRequest) {
  try {
    const targetUrl = `${HERMES_TARGET}/api/sessions`;
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
    console.error("Hermes sessions list GET route error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions list." }, { status: 500 });
  }
}
