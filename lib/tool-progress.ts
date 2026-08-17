/**
 * Human-readable progress labels for streamed tool activity.
 *
 * The backend streams `tool` / `tool_complete` events with a tool `name` (and
 * sometimes a `preview` label). We map those to short, friendly status lines
 * for the in-thread progress indicator so a long-running turn (web research,
 * document generation, multi-step tool use) never looks frozen.
 */

export interface ToolProgress {
  /** Friendly present-tense status line, e.g. "Searching the web…". */
  label: string;
  /** Emoji/icon hint for the status line. */
  icon: string;
}

interface Rule {
  test: (name: string) => boolean;
  label: string;
  icon: string;
}

// Order matters: first match wins.
const RULES: Rule[] = [
  { test: (n) => n.includes("web_search") || n === "search" || n.includes("search"), label: "Searching the web…", icon: "🔍" },
  { test: (n) => n.includes("web_extract") || n.includes("web_fetch") || n.includes("fetch") || n.startsWith("browser") || n.includes("visit") || n.includes("browse"), label: "Reading web pages…", icon: "🌐" },
  { test: (n) => n.includes("create_document") || n.includes("generate_document") || n.includes("docx") || n.includes("pdf") || n.includes("pptx") || n.includes("report"), label: "Generating document…", icon: "📝" },
  { test: (n) => n.includes("write_file") || n.includes("create_file"), label: "Writing file…", icon: "💾" },
  { test: (n) => n.includes("read_file") || n.includes("read_document") || n.includes("extract"), label: "Reading files…", icon: "📖" },
  { test: (n) => n.includes("edit") || n.includes("patch") || n.includes("apply"), label: "Editing…", icon: "✏️" },
  { test: (n) => n.includes("terminal") || n.includes("shell") || n.includes("bash") || n.includes("exec") || n.includes("command"), label: "Running commands…", icon: "⚙️" },
  { test: (n) => n.includes("image") || n.includes("vision") || n.includes("thumbnail"), label: "Working with images…", icon: "🖼️" },
  { test: (n) => n.includes("email") || n.includes("gmail") || n.includes("send"), label: "Preparing email…", icon: "✉️" },
  { test: (n) => n.includes("code") || n.includes("python") || n.includes("execute"), label: "Running code…", icon: "🧮" },
  { test: (n) => n.includes("session_search") || n.includes("memory") || n.includes("recall"), label: "Recalling context…", icon: "🧠" },
];

export function progressForTool(name?: string | null): ToolProgress {
  const n = (name || "").toLowerCase();
  for (const r of RULES) {
    if (r.test(n)) return { label: r.label, icon: r.icon };
  }
  // Generic fallback: humanize the raw tool name.
  const pretty = n.replace(/[_-]+/g, " ").trim();
  return {
    label: pretty ? `Working: ${pretty}…` : "Working…",
    icon: "🛠️",
  };
}

/** A rotating "still working" message for long gaps with no new tool events. */
export const IDLE_PROGRESS_MESSAGES = [
  "Thinking…",
  "Working on it…",
  "Almost there…",
  "Still working…",
];
