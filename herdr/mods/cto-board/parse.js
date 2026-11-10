// Pure helpers for the CTO board: no herdr or gpui imports, so `node parse.check.mjs` runs them.

const TIME = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?(?:\.\d+)?(Z|[+-]\d\d(?::?\d\d)?)?$/;

// ISO 8601 as Leads write it: no offset is local time, "-03" means "-03:00".
export function parseTime(s) {
  const m = TIME.exec(s ?? "");
  if (!m) return null;
  const [, y, mo, d, h, mi, sec = "0", zone] = m;
  if (!zone) return new Date(+y, mo - 1, +d, +h, +mi, +sec);
  let ms = Date.UTC(+y, mo - 1, +d, +h, +mi, +sec);
  if (zone !== "Z") {
    const digits = zone.slice(1).replace(":", "");
    ms -= (zone[0] === "-" ? -1 : 1) * (+digits.slice(0, 2) * 60 + +(digits.slice(2) || 0)) * 60000;
  }
  return new Date(ms);
}

// A Linear issue or Shortcut story URL; it ends before any "#..." or "?...".
const TRACKER = /https:\/\/(?:linear\.app\/[\w-]+\/issue\/([a-z0-9]+-\d+)|app\.shortcut\.com\/[\w-]+\/story\/(\d+))(?:\/([\w-]+))?/gi;

// The ticket's link and title: frontmatter `url:` and `title:` win. Else the first tracker URL in
// the text whose id is this ticket, titled from its slug. A URL of another ticket is never used.
function link(state, text) {
  const id = (state.ticket ?? "").toLowerCase();
  const m = [...text.matchAll(TRACKER)].find((m) => (m[1] ? m[1].toLowerCase() === id : m[2] === /^(?:sc-)?(\d+)$/.exec(id)?.[1]));
  const url = /^https?:\/\/\S+$/.test(state.url ?? "") ? state.url : m?.[0] ?? null;
  const title = state.title || (m?.[3] ? m[3].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) : null);
  const host = /^https?:\/\/([^/?#:]+)/.exec(url ?? "")?.[1]?.toLowerCase();
  const source = !host ? null : host === "linear.app" ? "Linear" : /(^|\.)shortcut\.com$/.test(host) ? "Shortcut" : host;
  return { url, title, source };
}

// A state.md: frontmatter fields, the Log as { at, text }, and how many files it touched.
// `ticket`: the id when the frontmatter has none (the folder name).
export function parseState(text, ticket) {
  const lines = text.split(/\r?\n/);
  const state = {};
  let body = 0;
  if (lines[0]?.trim() === "---") {
    for (body = 1; body < lines.length && lines[body].trim() !== "---"; body++) {
      const m = /^([\w-]+):\s*(.*)$/.exec(lines[body]);
      if (m) state[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
    }
    body++;
  }
  state.ticket ||= ticket;
  Object.assign(state, link(state, text));
  // Frontmatter `pr:` wins; Leads from before that field, or that left `pr: none`, have the URL only in the log.
  state.pr = prUrl(state.pr) ?? prUrl(text);
  const sections = {};
  let bullets = null;
  for (const l of lines.slice(body)) {
    const h = /^##\s+(.+?)\s*$/.exec(l);
    if (h) bullets = sections[h[1]] ??= [];
    else if (bullets && /^\s*- /.test(l)) bullets.push(l.replace(/^\s*- /, "").trim());
  }
  state.updatedAt = parseTime(state.updated);
  state.log = (sections.Log ?? []).map((b) => {
    const m = /^(\S+)\s+(.*)$/.exec(b);
    const at = m && parseTime(m[1]);
    return at ? { at, text: m[2] } : { at: null, text: b };
  });
  state.last = state.log.at(-1) ?? null;
  // "- none", "- none (investigation only)" and "- specs next to each" are not files.
  state.files = (sections["Files touched"] ?? []).filter((b) => b.includes("/")).length;
  return state;
}

// The last *.md a log line names, as a path: "~/..." under home, bare names in the ticket folder.
export function mdPath(text, dir, home) {
  const f = (text ?? "").match(/[~\w./-]*[\w-]\.md\b/g)?.at(-1);
  if (!f) return null;
  return f.startsWith("~/") ? home + f.slice(1) : f.startsWith("/") ? f : `${dir}/${f}`;
}

// The last pull request URL in the text.
export const prUrl = (text) => (text ?? "").match(/https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/g)?.at(-1) ?? null;

export const STEPS = ["Plano", "Implementa", "Verifica", "PR", "Fim"];
// status: [current step, its label when not the step name]
const STAGE = { planning: [0], plan_ready: [0, "Plano pronto"], implementing: [1], verifying: [2], publishing: [3], pr_open: [3, "PR aberto"], done: [4] };

// Each step as { name, state: "done" | "current" | "todo" | "off" }; "off" for statuses off the path.
export function steps(status) {
  const s = STAGE[status];
  return STEPS.map((name, i) =>
    !s ? { name, state: "off" }
    : i < s[0] ? { name: `✓ ${name}`, state: "done" }
    : i === s[0] ? { name: s[1] ?? name, state: "current" }
    : { name, state: "todo" });
}

export function ago(date, now = Date.now()) {
  if (!date) return "";
  const m = Math.floor((now - date) / 60000);
  return m < 1 ? "agora" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : `há ${Math.floor(m / 1440)} d`;
}

const pad = (n) => String(n).padStart(2, "0");
export const hhmm = (d) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "");
