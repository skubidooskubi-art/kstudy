import { getAuth } from "@/lib/auth";
import { getProfileCookie } from "@/lib/hermes-access";
import { NextRequest, NextResponse } from "next/server";
import { basename, extname, resolve } from "path";

export const dynamic = "force-dynamic";

// Hermes WebUI backend. This Next.js app runs inside a Coolify container with
// NO bind mounts, so the agent-written files on the *host* disk
// (/home/victor/.hermes/...) are NOT visible to `fs` in here. We therefore
// fetch file bytes over the network from Hermes — the same transport the chat
// route already uses — instead of reading container-local disk.
const HERMES_TARGET = process.env.HERMES_WEB_URL || "http://10.0.1.1:8787";

// Simple, fast inlined MIME-type lookup map (fallback only; we prefer the
// Content-Type Hermes returns).
const MIME_MAP: Record<string, string> = {
  ".pdf":   "application/pdf",
  ".docx":  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx":  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx":  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".md":    "text/markdown; charset=utf-8",
  ".txt":   "text/plain; charset=utf-8",
  ".json":  "application/json; charset=utf-8",
  ".png":   "image/png",
  ".jpg":   "image/jpeg",
  ".jpeg":  "image/jpeg",
  ".gif":   "image/gif",
  ".svg":   "image/svg+xml",
  ".mp3":   "audio/mpeg",
  ".mp4":   "video/mp4",
  ".zip":   "application/zip",
};

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: req.headers });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawPath = searchParams.get("path");

    if (!rawPath) {
      return NextResponse.json({ error: "Path parameter is required" }, { status: 400 });
    }

    // Resolve and normalize target path
    const targetPath = resolve(rawPath);

    // ── SECURITY: BOUNDARIES ──
    // Defense-in-depth: only proxy files created in a Hermes profile folder,
    // WebUI attachments, or the shared workspace. Hermes /api/media enforces
    // its own allow-list too, but we fail closed here as well.
    const allowedProfilesRoot   = resolve("/home/victor/.hermes/profiles");
    const allowedAttachmentsDir = resolve("/home/victor/.hermes/webui/attachments");
    const allowedWorkspaceDir   = resolve("/home/victor/workspace");

    const isInsideAllowedDir =
      targetPath.startsWith(allowedProfilesRoot) ||
      targetPath.startsWith(allowedAttachmentsDir) ||
      targetPath.startsWith(allowedWorkspaceDir);

    if (!isInsideAllowedDir) {
      return NextResponse.json(
        { error: "Access denied: file path is outside permitted boundaries." },
        { status: 403 }
      );
    }

    // Fetch the file bytes from Hermes over the network. The container cannot
    // read the host filesystem, so this is the only path that works.
    const cookie = await getProfileCookie(req);
    const upstreamUrl = `${HERMES_TARGET}/api/media?path=${encodeURIComponent(targetPath)}`;
    const upstreamRes = await fetch(upstreamUrl, {
      method: "GET",
      headers: { Cookie: cookie },
      cache: "no-store",
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      if (upstreamRes.status === 404) {
        return NextResponse.json({ error: "File not found on disk." }, { status: 404 });
      }
      const errText = await upstreamRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Upstream error: ${errText || upstreamRes.statusText}` },
        { status: upstreamRes.status || 502 }
      );
    }

    const filename = basename(targetPath);
    const ext = extname(targetPath).toLowerCase();
    // Prefer our known MIME for the extension (Hermes sometimes returns a
    // generic application/octet-stream for .md/.docx/.xlsx); fall back to what
    // Hermes reported, then to octet-stream.
    const upstreamType = upstreamRes.headers.get("content-type");
    const mimeType =
      MIME_MAP[ext] || upstreamType || "application/octet-stream";

    // Stream the upstream body straight back to the client as an attachment.
    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    };
    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) headers["Content-Length"] = contentLength;

    return new NextResponse(upstreamRes.body, { status: 200, headers });

  } catch (err) {
    console.error("Secure file download error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
