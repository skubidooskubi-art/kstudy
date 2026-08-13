import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HERMES_TARGET = process.env.HERMES_WEB_URL || "http://10.0.1.1:8787";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const streamId = searchParams.get("stream_id");

    if (!streamId) {
      return NextResponse.json({ error: "Missing stream_id parameter." }, { status: 400 });
    }

    const targetUrl = `${HERMES_TARGET}/api/chat/stream?stream_id=${encodeURIComponent(streamId)}`;

    // Fetch upstream SSE stream from Hermes WebUI API
    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
      },
      // Disable caching for real-time streaming
      cache: "no-store",
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      return NextResponse.json(
        { error: `Upstream stream error: ${upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 }
      );
    }

    // Pass the stream directly through a ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstreamRes.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }
            if (value) {
              controller.enqueue(value);
            }
          }
        } catch (err) {
          console.error("Error reading upstream stream:", err);
          controller.error(err);
        }
      },
    });

    // Return unbuffered SSE response headers
    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disables Nginx/Coolify proxy buffering
      },
    });
  } catch (error: any) {
    console.error("SSE stream proxy route error:", error);
    return NextResponse.json({ error: "Internal server streaming error." }, { status: 500 });
  }
}
