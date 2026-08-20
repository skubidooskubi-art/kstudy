/**
 * Chat artifact extraction.
 *
 * The KStudy chat has no dedicated "list files for this session" backend, but
 * every file that appears in a conversation is already present in the loaded
 * messages:
 *   1. User attachments — msg.attachments[] (name + absolute path + mime).
 *   2. Assistant-generated documents — emitted inline as `MEDIA:/abs/path`
 *      markers in assistant message content (the same markers FormattedMessage
 *      renders as a download card).
 *
 * This module walks the message list and returns a deduped, ordered list of
 * artifacts for the Files panel. Everything is derived client-side; preview and
 * download both go through the existing /api/hermes/download proxy (which
 * streams bytes from Hermes /api/media).
 */

export type ArtifactKind = "pdf" | "image" | "text" | "office" | "data" | "other";

export interface ChatArtifact {
  /** Absolute path on the Hermes host — the key we download/preview by. */
  path: string;
  /** Display file name. */
  name: string;
  /** Lowercased extension without the dot (e.g. "pdf"). */
  ext: string;
  /** Coarse category that drives the preview renderer + icon. */
  kind: ArtifactKind;
  /** "user" (uploaded) or "assistant" (generated). */
  source: "user" | "assistant";
  /** Optional size in bytes (only known for user uploads). */
  size?: number;
}

interface MinimalAttachment {
  name?: string;
  path?: string;
  mime?: string;
  size?: number;
  is_image?: boolean;
}

interface MinimalMessage {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: MinimalAttachment[];
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);
const TEXT_EXTS = new Set(["txt", "md", "markdown", "json", "csv", "log", "yaml", "yml"]);
const OFFICE_EXTS = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx"]);
const DATA_EXTS = new Set(["csv", "json", "xlsx", "xls"]);

export function extensionOf(nameOrPath: string): string {
  const base = nameOrPath.split(/[\\/]/).pop() || nameOrPath;
  const dot = base.lastIndexOf(".");
  return dot > -1 ? base.slice(dot + 1).toLowerCase() : "";
}

export function kindForExt(ext: string): ArtifactKind {
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (OFFICE_EXTS.has(ext)) return "office";
  if (DATA_EXTS.has(ext)) return "data";
  if (TEXT_EXTS.has(ext)) return "text";
  return "other";
}

export function iconForKind(kind: ArtifactKind): string {
  switch (kind) {
    case "pdf": return "📄";
    case "image": return "🖼️";
    case "office": return "📝";
    case "data": return "📊";
    case "text": return "📃";
    default: return "📎";
  }
}

function nameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

/** Find every `MEDIA:/absolute/path` marker in a block of assistant text. */
export function extractMediaPaths(content: string): string[] {
  if (!content || !content.includes("MEDIA:/")) return [];
  const out: string[] = [];
  const re = /MEDIA:(\/[^\s)]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    out.push(m[1]);
  }
  return out;
}

/**
 * Build the deduped artifact list for a conversation. Order: first appearance
 * in the message stream (oldest → newest), which reads naturally in the panel.
 */
export function extractArtifacts(messages: MinimalMessage[]): ChatArtifact[] {
  const byPath = new Map<string, ChatArtifact>();

  for (const msg of messages) {
    // 1) User (or any) attachments carried on the message.
    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        if (!att?.path) continue;
        if (byPath.has(att.path)) continue;
        const name = att.name || nameFromPath(att.path);
        const ext = extensionOf(name || att.path);
        byPath.set(att.path, {
          path: att.path,
          name,
          ext,
          kind: att.is_image ? "image" : kindForExt(ext),
          source: msg.role === "assistant" ? "assistant" : "user",
          size: att.size,
        });
      }
    }

    // 2) Assistant-generated MEDIA:/ documents embedded in content.
    if (msg.role === "assistant" && typeof msg.content === "string") {
      for (const path of extractMediaPaths(msg.content)) {
        if (byPath.has(path)) continue;
        const name = nameFromPath(path);
        const ext = extensionOf(name);
        byPath.set(path, {
          path,
          name,
          ext,
          kind: kindForExt(ext),
          source: "assistant",
        });
      }
    }
  }

  return Array.from(byPath.values());
}

/** Build the download/preview URL for an artifact via the existing proxy. */
export function downloadUrl(path: string, inline = false): string {
  const params = new URLSearchParams({ path });
  if (inline) params.set("inline", "1");
  return `/api/hermes/download?${params.toString()}`;
}
