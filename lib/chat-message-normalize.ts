/**
 * Convert Hermes message payloads into safe text for the React renderer.
 *
 * Hermes may persist assistant content as structured blocks after tool/document
 * turns, while the chat UI renders markdown from strings. Never call string
 * methods on an unknown payload from the API.
 */
export function textFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value == null ? "" : String(value);
  }

  if (Array.isArray(value)) {
    return value.map(textFromUnknown).filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "content", "value", "message", "output", "result"]) {
      if (key in record) {
        const text = textFromUnknown(record[key]);
        if (text) return text;
      }
    }
  }

  // Unknown objects are not useful markdown and may contain tool metadata.
  // Returning an empty string keeps the UI stable and avoids leaking raw data.
  return "";
}

export function normalizeAttachments(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => {
    return !!item && typeof item === "object";
  });
}
