import { getAuth } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { getProfileCookie, ownsResource, type HermesResourceRecord } from "@/lib/hermes-access";
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

    const streamId = new URL(req.url).searchParams.get("stream_id");
    if (!streamId) {
      return NextResponse.json({ error: "Missing stream_id parameter." }, { status: 400 });
    }

    const client = await clientPromise;
    const resources = client.db("kstudy").collection<HermesResourceRecord>("hermes_resources");
    if (!(await ownsResource(resources, "stream", streamId, session.user.id))) {
      return NextResponse.json({ error: "Hermes resource not found." }, { status: 404 });
    }

    const cookie = await getProfileCookie(req);
    const upstreamRes = await fetch(
      `${HERMES_TARGET}/api/chat/stream?stream_id=${encodeURIComponent(streamId)}`,
      {
        headers: {
          Accept: "text/event-stream",
          Cookie: cookie,
        },
        cache: "no-store",
      },
    );

    if (!upstreamRes.ok || !upstreamRes.body) {
      return NextResponse.json(
        { error: `Upstream stream error: ${upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 },
      );
    }

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
            controller.enqueue(value);
          }
        } catch (error) {
          console.error("Error reading upstream stream:", error);
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("SSE stream proxy route error:", error);
    return NextResponse.json({ error: "Internal server streaming error." }, { status: 500 });
  }
}
