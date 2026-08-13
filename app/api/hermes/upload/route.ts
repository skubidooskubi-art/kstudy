import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HERMES_TARGET = process.env.HERMES_WEB_URL || "http://10.0.1.1:8787";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const targetUrl = `${HERMES_TARGET}/api/upload`;

    const upstreamRes = await fetch(targetUrl, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      return NextResponse.json(
        { error: `Upstream upload error: ${errText || upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 }
      );
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Hermes upload POST route error:", error);
    return NextResponse.json({ error: "Failed to upload file to Hermes." }, { status: 500 });
  }
}
