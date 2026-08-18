import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import clientPromise from "@/lib/db";
import { DEFAULT_ADMIN_SETTINGS } from "@/app/admin/config";

export const dynamic = "force-dynamic";

async function verifyAdmin(req: NextRequest): Promise<{ isAdmin: boolean; email?: string }> {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user?.email) {
      return { isAdmin: false };
    }

    const email = session.user.email.toLowerCase().trim();
    const rawAdmins = process.env.ADMIN_EMAILS || "";
    const adminEmails = rawAdmins
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const fallbackAdmins = [
      "skubidooskubi@gmail.com",
      "vikiflowdesign@gmail.com",
      "victoruche3022@gmail.com",
    ];

    const allowedAdmins = adminEmails.length > 0 ? adminEmails : fallbackAdmins;

    if (allowedAdmins.includes(email)) {
      return { isAdmin: true, email };
    }
  } catch (err) {
    console.error("[ADMIN VERIFY ERROR]:", err);
  }
  return { isAdmin: false };
}

export async function GET(req: NextRequest) {
  const { isAdmin } = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const client = await clientPromise;
    const db = client.db("kstudy");
    const doc = await db.collection("system_settings").findOne({ key: "global_settings" });
    if (doc) {
      return NextResponse.json({ settings: doc.settings });
    }
    return NextResponse.json({ settings: DEFAULT_ADMIN_SETTINGS });
  } catch (err: any) {
    console.error("[ADMIN CONFIG GET ERROR]:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { isAdmin } = await verifyAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const settings = body.settings;

    if (!settings) {
      return NextResponse.json({ error: "Missing settings payload" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("kstudy");

    await db.collection("system_settings").updateOne(
      { key: "global_settings" },
      { $set: { settings, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[ADMIN CONFIG POST ERROR]:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}
