import { getAuth } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { ownsResource, type HermesResourceRecord } from "@/lib/hermes-access";
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

    const formData = await req.formData();
    const sessionId = formData.get("session_id");
    if (typeof sessionId !== "string" || !sessionId) {
      return NextResponse.json({ error: "Missing session_id." }, { status: 400 });
    }

    const client = await clientPromise;
    const resources = client.db("kstudy").collection<HermesResourceRecord>("hermes_resources");
    if (!(await ownsResource(resources, "session", sessionId, session.user.id))) {
      return NextResponse.json({ error: "Hermes resource not found." }, { status: 404 });
    }

    const upstreamRes = await fetch(`${HERMES_TARGET}/api/upload`, {
      method: "POST",
      body: formData,
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      const errText = await upstreamRes.text();
      return NextResponse.json(
        { error: `Upstream upload error: ${errText || upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 },
      );
    }

    return NextResponse.json(await upstreamRes.json());
  } catch (error) {
    console.error("Hermes upload POST route error:", error);
    return NextResponse.json({ error: "Failed to upload file to Hermes." }, { status: 500 });
  }
}
