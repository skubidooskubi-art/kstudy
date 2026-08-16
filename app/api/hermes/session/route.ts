import { getAuth } from "@/lib/auth";
import clientPromise from "@/lib/db";
import {
  getProfileCookie,
  ownsResource,
  registerResource,
  type HermesResourceCollection,
  type HermesResourceRecord,
} from "@/lib/hermes-access";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HERMES_TARGET = process.env.HERMES_WEB_URL || "http://10.0.1.1:8787";
let resourceIndexPromise: Promise<unknown> | null = null;

async function getOwner(req: NextRequest): Promise<{ id: string } | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user?.id ? { id: session.user.id } : null;
}

async function getResources(): Promise<HermesResourceCollection> {
  const client = await clientPromise;
  const collection = client.db("kstudy").collection<HermesResourceRecord>("hermes_resources");

  resourceIndexPromise ??= collection.createIndex(
    { kind: 1, resourceId: 1 },
    { unique: true, name: "hermes_resource_identity" },
  );
  await resourceIndexPromise;
  return collection;
}

async function notFound(): Promise<NextResponse> {
  return NextResponse.json({ error: "Hermes resource not found." }, { status: 404 });
}

export async function GET(req: NextRequest) {
  try {
    const owner = await getOwner(req);
    if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionId = new URL(req.url).searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id parameter." }, { status: 400 });
    }

    const resources = await getResources();
    if (!(await ownsResource(resources, "session", sessionId, owner.id))) {
      return notFound();
    }

    const cookie = await getProfileCookie(req);
    const upstreamRes = await fetch(
      `${HERMES_TARGET}/api/session?session_id=${encodeURIComponent(sessionId)}`,
      {
        headers: {
          Accept: "application/json",
          Cookie: cookie,
        },
        cache: "no-store",
      },
    );

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 },
      );
    }

    return NextResponse.json(await upstreamRes.json());
  } catch (error) {
    console.error("Hermes session GET route error:", error);
    return NextResponse.json({ error: "Failed to fetch session." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const owner = await getOwner(req);
    if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const cookie = await getProfileCookie(req);
    const upstreamRes = await fetch(`${HERMES_TARGET}/api/session/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 },
      );
    }

    const data = await upstreamRes.json();
    const sessionId = data?.session?.session_id;
    if (typeof sessionId !== "string" || !sessionId) {
      return NextResponse.json({ error: "Hermes returned an invalid session." }, { status: 502 });
    }

    await registerResource(await getResources(), {
      kind: "session",
      resourceId: sessionId,
      ownerId: owner.id,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Hermes session POST route error:", error);
    return NextResponse.json({ error: "Failed to create new session." }, { status: 500 });
  }
}
