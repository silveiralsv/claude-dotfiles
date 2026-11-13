// Self-check for parse.js: node herdr/mods/cto-board/parse.check.mjs
process.env.TZ = "America/Sao_Paulo"; // -03:00 all year, so local times are fixed
import assert from "node:assert/strict";
import { parseTime, parseState, mdPath, prUrl, steps, ago, hhmm } from "./parse.js";

// The three time forms Leads write, all the same instant here.
for (const s of ["2026-11-10T13:00", "2026-11-10T13:00:00-03", "2026-11-10T13:00:00-03:00", "2026-11-10T16:00:00Z"])
  assert.equal(parseTime(s)?.toISOString(), "2026-11-10T16:00:00.000Z", s);
assert.equal(parseTime("2026-11-10T13:00:05-03").toISOString(), "2026-11-10T16:00:05.000Z");
assert.equal(parseTime("queued"), null);
assert.equal(parseTime(undefined), null);

// sc-16306: unknown status, "- none (investigation only)", mixed log times.
const s16306 = parseState(`---
ticket: sc-16306
type: bug
space: sp58635156da1b6b7888907ee0597952a3
lead: lead-sc-16306
status: monitoring
updated: 2026-11-10T13:19:37-03:00
---

## Decisions

- Root cause: no code defect.

## Decisions (user)

- User chose: comment on ticket tagging John.

## Files touched

- none (investigation only)

## Log

- 2026-11-10T12:57 queued by the CTO
- 2026-11-10T13:03 investigation done (GCP logs + staging DB); blocked on user decision: ~/claude-workflows/sc-16306/findings.md
- 2026-11-10T13:19:37-03:00 story moved to In Review; comment watcher armed (15 min poll, log: watch.log, output: new-comments.json)
`);
assert.equal(s16306.status, "monitoring");
assert.equal(s16306.space, "sp58635156da1b6b7888907ee0597952a3");
assert.equal(s16306.updatedAt.toISOString(), "2026-11-10T16:19:37.000Z");
assert.equal(s16306.files, 0);
assert.equal(s16306.log.length, 3);
assert.equal(s16306.log[0].at.toISOString(), "2026-11-10T15:57:00.000Z");
assert.equal(s16306.last.text, "story moved to In Review; comment watcher armed (15 min poll, log: watch.log, output: new-comments.json)");
assert.ok(steps("monitoring").every((x) => x.state === "off"));
assert.equal(mdPath(s16306.log[1].text, "/h/claude-workflows/sc-16306", "/h"), "/h/claude-workflows/sc-16306/findings.md");

// sc-16210: "- none", blocked, a bare md name in an older line, none in the last.
const s16210 = parseState(`---
ticket: sc-16210
space: sp58635156da1b6b7888907ee0597952a3
status: blocked
updated: 2026-11-10T14:58:00-03:00
---

## Files touched

- none

## Log

- 2026-11-10T13:00:05-03 blocked: gcloud login expired, login started, waiting on browser
- 2026-11-10T13:06:36-03 investigation done; blocked: Corvus sandbox sends no webhooks to staging (evidence in blocked.md)
- 2026-11-10T14:58:00-03:00 posted approved Corvus comment (activity-16333, mention resolves to John 678d166c)
`);
assert.equal(s16210.files, 0);
assert.equal(s16210.log[0].at.toISOString(), "2026-11-10T16:00:05.000Z");
assert.equal(mdPath(s16210.log[1].text, "/d", "/h"), "/d/blocked.md");
assert.equal(mdPath("sent BLOCKED corvus-portal-login.md; waiting for user login", "/d", "/h"), "/d/corvus-portal-login.md");
assert.equal(mdPath(s16210.last.text, "/d", "/h"), null);
assert.equal(mdPath("notes in README.mdx", "/d", "/h"), null);

// sc-16214: five paths plus "- specs next to each", verifying.
const s16214 = parseState(`---
ticket: sc-16214
status: verifying
---

## Files touched

- api/src/carriers/arch/arch.service.ts
- api/src/carriers/arch/dto/quotesResponse.ts
- api/src/models/quote-carrier-lines/quote-carrier-lines.service.ts
- api/src/platform/quote-documents/quote-documents-job.service.ts
- api/src/integrations/binding-service/binding-supervisor/binding.supervisor.ts
- specs next to each

## Log

- 2026-11-10T14:23 PLAN_READY: plan.md
`);
assert.equal(s16214.files, 5);
assert.equal(mdPath(s16214.last.text, "/d", "/h"), "/d/plan.md");

// sc-16309: done, a PR URL in the log.
const pr = "2026-11-10T14:17:37-03:00 PR #3314 open https://github.com/Affinity-Advisors/affinity-platform/pull/3314 (commit 5c450e3d8); CI running";
assert.equal(prUrl(parseState(`## Log\n\n- ${pr}\n`).last.text), "https://github.com/Affinity-Advisors/affinity-platform/pull/3314");
assert.equal(prUrl("CI green, awaiting review"), null);
assert.equal(prUrl("closed https://github.com/o/r/pull/1, reopened as https://github.com/o/r/pull/2"), "https://github.com/o/r/pull/2");
// The card's PR: frontmatter `pr:` wins over the log; `pr: none` or no field falls back to the last PR URL in the file.
const log = "## Log\n\n- 2026-11-10T14:17 PR open https://github.com/o/r/pull/7\n- 2026-11-10T14:30 CodeRabbit asked for a change\n";
assert.equal(parseState(`---\npr: https://github.com/o/r/pull/9\n---\n\n${log}`).pr, "https://github.com/o/r/pull/9");
assert.equal(parseState(`---\npr: none\n---\n\n${log}`).pr, "https://github.com/o/r/pull/7");
assert.equal(parseState(log).pr, "https://github.com/o/r/pull/7");
assert.equal(parseState("---\npr: none\n---\n\n## Log\n\n- 2026-11-10T14:00 planning\n").pr, null);
assert.equal(parseState("no frontmatter at all").last, null);

// Title and link. sc-16306 has no title or url field: its log names the story with a slug and a fragment.
const story = "https://app.shortcut.com/affinity-advisors/story/16306/bdi-staging-quote-error";
const s16306link = parseState(`---\nticket: sc-16306\n---\n\n## Log\n\n- 2026-11-10T13:10 see ${story}#activity-16326 (other: https://app.shortcut.com/affinity-advisors/story/16300/other-story)\n`);
assert.deepEqual([s16306link.title, s16306link.url, s16306link.source], ["Bdi staging quote error", story, "Shortcut"]);
// Frontmatter wins, quotes come off; the folder name is the ticket when the frontmatter has none.
const fm = parseState(`---\ntitle: "Arch: declined quotes"\nurl: https://linear.app/acme/issue/APO-4796\n---\n\n- ${story}\n`, "apo-4796");
assert.deepEqual([fm.ticket, fm.title, fm.url, fm.source], ["apo-4796", "Arch: declined quotes", "https://linear.app/acme/issue/APO-4796", "Linear"]);
// Linear, ticket id in any case; with and without a slug; "url: none" falls back to the text.
const lin = (text) => { const s = parseState(`---\nticket: APO-4796\nurl: none\n---\n${text}\n`); return [s.title, s.url, s.source]; };
assert.deepEqual(lin("https://linear.app/acme/issue/apo-4796/export-bookings-as-csv?x=1"), ["Export bookings as csv", "https://linear.app/acme/issue/apo-4796/export-bookings-as-csv", "Linear"]);
assert.deepEqual(lin("(https://linear.app/acme/issue/APO-4796)."), [null, "https://linear.app/acme/issue/APO-4796", "Linear"]);
// Another ticket's URL is never used; no URL gives no title and no link.
assert.deepEqual(lin("https://linear.app/acme/issue/APO-4797/other-thing and https://app.shortcut.com/a/story/47960/x"), [null, null, null]);
assert.deepEqual(lin("no links"), [null, null, null]);
// A Linear-style id never claims the Shortcut story with its digits.
assert.deepEqual(lin("https://app.shortcut.com/a/story/4796/unrelated-story"), [null, null, null]);
// Another host: its name is the source.
const gh = parseState(`---\nticket: x-1\ntitle: Fix the build\nurl: https://github.com/acme/app/issues/12\n---\n`);
assert.deepEqual([gh.title, gh.source], ["Fix the build", "github.com"]);

// Stage mapping.
const names = (status) => steps(status).map((x) => `${x.state}:${x.name}`).join(" ");
assert.equal(names("planning"), "current:Plano todo:Testes todo:Implementa todo:Verifica todo:PR todo:Fim");
assert.equal(names("plan_ready"), "current:Plano pronto todo:Testes todo:Implementa todo:Verifica todo:PR todo:Fim");
assert.equal(names("testing"), "done:✓ Plano current:Testes todo:Implementa todo:Verifica todo:PR todo:Fim");
assert.equal(names("implementing"), "done:✓ Plano done:✓ Testes current:Implementa todo:Verifica todo:PR todo:Fim");
assert.equal(names("verifying"), "done:✓ Plano done:✓ Testes done:✓ Implementa current:Verifica todo:PR todo:Fim");
assert.equal(names("publishing"), "done:✓ Plano done:✓ Testes done:✓ Implementa done:✓ Verifica current:PR todo:Fim");
assert.equal(names("pr_open"), "done:✓ Plano done:✓ Testes done:✓ Implementa done:✓ Verifica current:PR aberto todo:Fim");
assert.equal(names("done"), "done:✓ Plano done:✓ Testes done:✓ Implementa done:✓ Verifica done:✓ PR current:Fim");
for (const s of ["blocked", "failed", "queued", undefined]) assert.ok(steps(s).every((x) => x.state === "off"), String(s));

// Relative time and clock.
const now = Date.parse("2026-11-10T17:00:00Z");
assert.equal(ago(new Date(now - 20000), now), "agora");
assert.equal(ago(new Date(now - 4 * 60000), now), "há 4 min");
assert.equal(ago(new Date(now - 3 * 3600000), now), "há 3 h");
assert.equal(ago(new Date(now - 50 * 3600000), now), "há 2 d");
assert.equal(ago(null, now), "");
assert.equal(hhmm(parseTime("2026-11-10T09:05:00-03:00")), "09:05");
assert.equal(hhmm(null), "");

console.log("parse.check: ok");
