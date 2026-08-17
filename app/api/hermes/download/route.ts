import { getAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/db";
import { promises as fs } from "fs";
import { resolve, basename, extname } from "path";

export const dynamic = "force-dynamic";

// Simple, fast inlined MIME-type lookup map
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

    // ── SECURITY BOWER BOUNDARIES ──
    // Allow files created in any Hermes profile folder, WebUI attachments, or workspace
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

    // Check if file exists on disk
    try {
      const stats = await fs.stat(targetPath);
      if (!stats.isFile()) {
        return NextResponse.json({ error: "Requested path is not a file." }, { status: 400 });
      }
    } catch (err) {
      return NextResponse.json({ error: "File not found on disk." }, { status: 404 });
    }

    // Read file bytes
    const fileBuffer = await fs.readFile(targetPath);
    const filename = basename(targetPath);
    const ext = extname(targetPath).toLowerCase();
    const mimeType = MIME_MAP[ext] || "application/octet-stream";

    // Stream back to client
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });

  } catch (err) {
    console.error("Secure file download error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
