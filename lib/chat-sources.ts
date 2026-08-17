/**
 * Web-source extraction from streamed tool events.
 *
 * The hermes-webui backend does NOT emit a structured "visited sources" list.
 * What it does stream (per tool call) is:
 *   - `tool`          { name, args, tid }         — args carry query / urls
 *   - `tool_complete` { name, preview, args, tid} — preview is a truncated
 *                       (<=4000 char) snippet of the tool result text
 *
 * For web tools (web_search, web_extract, web_fetch, browser_*), we derive a
 * clickable source list from those two signals:
 *   - explicit URLs found in tool args (most reliable), and
 *   - URLs found in the completion preview snippet (search results).
 * Titles aren't reliably available from the truncated preview, so we label
 * each source by its domain + path — honest and clean, per product decision.
 */

export interface WebSource {
  url: string;
  domain: string;
  /** Best-effort label (domain, or a short path when informative). */
  label: string;
}

export interface ToolEventLike {
  name?: string;
  args?: Record<string, unknown> | null;
  preview?: string | null;
}

const WEB_TOOL_NAMES = new Set([
  "web_search",
  "web_extract",
  "web_fetch",
  "web_browse",
  "browse",
  "fetch_url",
  "visit",
]);

export function isWebTool(name?: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  if (WEB_TOOL_NAMES.has(n)) return true;
  // Catch browser_use / browser_* style tools and anything web-ish.
  return n.startsWith("browser") || n.includes("web_") || n.includes("search");
}

// Global URL matcher (http/https only). Strips common trailing punctuation.
const URL_RE = /https?:\/\/[^\s"'<>)\]}]+/g;

function cleanUrl(raw: string): string | null {
  const u = raw.trim().replace(/[.,;:!?)\]}'"]+$/, "");
  if (!u) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function labelFor(url: string): string {
  const domain = domainOf(url);
  try {
    const p = new URL(url);
    const path = p.pathname.replace(/\/$/, "");
    // Show a short, human-ish path segment when it adds signal.
    if (path && path !== "" && path !== "/") {
      const lastSeg = path.split("/").filter(Boolean).pop() || "";
      const pretty = decodeURIComponent(lastSeg).replace(/[-_]+/g, " ").trim();
      if (pretty && pretty.length <= 60 && !/^\d+$/.test(pretty)) {
        return `${domain} — ${pretty}`;
      }
    }
  } catch {
    /* fall through */
  }
  return domain;
}

/** Pull candidate URLs out of a tool-args object (urls[], url, or query text). */
function urlsFromArgs(args?: Record<string, unknown> | null): string[] {
  if (!args || typeof args !== "object") return [];
  const out: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string") {
      const found = v.match(URL_RE);
      if (found) out.push(...found);
    }
  };
  for (const key of ["urls", "url", "link", "links", "query", "q"]) {
    const val = (args as Record<string, unknown>)[key];
    if (Array.isArray(val)) val.forEach(push);
    else push(val);
  }
  return out;
}

/**
 * Merge a batch of web tool events into a deduped, ordered source list.
 * Returns sources in first-seen order.
 */
export function extractSources(events: ToolEventLike[]): WebSource[] {
  const byUrl = new Map<string, WebSource>();

  const add = (rawUrl: string) => {
    const url = cleanUrl(rawUrl);
    if (!url) return;
    if (byUrl.has(url)) return;
    byUrl.set(url, { url, domain: domainOf(url), label: labelFor(url) });
  };

  for (const ev of events) {
    if (!isWebTool(ev.name)) continue;
    // 1) URLs explicitly present in tool args.
    for (const u of urlsFromArgs(ev.args)) add(u);
    // 2) URLs found in the completion preview snippet (search results).
    if (typeof ev.preview === "string") {
      const found = ev.preview.match(URL_RE);
      if (found) for (const u of found) add(u);
    }
  }

  return Array.from(byUrl.values());
}
