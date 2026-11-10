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
assert.equal(parseState("no frontmatter at all").last, null);

// Stage mapping.
const names = (status) => steps(status).map((x) => `${x.state}:${x.name}`).join(" ");
assert.equal(names("planning"), "current:Plano todo:Implementa todo:Verifica todo:PR todo:Fim");
assert.equal(names("plan_ready"), "current:Plano pronto todo:Implementa todo:Verifica todo:PR todo:Fim");
assert.equal(names("implementing"), "done:✓ Plano current:Implementa todo:Verifica todo:PR todo:Fim");
assert.equal(names("verifying"), "done:✓ Plano done:✓ Implementa current:Verifica todo:PR todo:Fim");
assert.equal(names("publishing"), "done:✓ Plano done:✓ Implementa done:✓ Verifica current:PR todo:Fim");
assert.equal(names("pr_open"), "done:✓ Plano done:✓ Implementa done:✓ Verifica current:PR aberto todo:Fim");
assert.equal(names("done"), "done:✓ Plano done:✓ Implementa done:✓ Verifica done:✓ PR current:Fim");
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
