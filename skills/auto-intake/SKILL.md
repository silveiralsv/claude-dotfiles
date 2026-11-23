---
name: auto-intake
description: Let the CTO take tickets through the plan gate without the user. `/auto-intake <TICKET> ...` runs the tickets the user picks; `/auto-intake --watch <source>` makes the CTO pick, by itself, the TODO tickets assigned to the user. Each ticket passes the auto-intake gates. With a yes on all of them, the CTO approves the plan itself after a veto window, and the user still approves the pull request. Any no sends the plan to the user as usual. Runs only in a CTO session. Use when the user says "/auto-intake", "auto intake", "roda esse ticket no automático", "deixa o CTO pegar os tickets sozinho", or "auto mode nesse ticket". Never start it on your own initiative.
---

# Auto-intake

This skill runs in a CTO session, next to the `cto` skill. If
`$HC_TERMINAL_ID` has no `role=cto` label, say that `/cto` must run first, and
stop. It changes one thing only: who approves the plan of the tickets it
marks. All other `cto` rules apply. A CTO that never runs this skill works as
before.

## Start

- `/auto-intake <TICKET> [<TICKET> ...]`: run the tickets that the user
  picked.
- `/auto-intake --watch <source>`: every 15 minutes, list the tickets in the
  TODO state of `<source>` (a Linear team or view, a Shortcut workflow, or a
  GitHub repository) that are assigned to the user, and take each one that
  has no state file yet. Use the session scheduler (for example
  `CronCreate`), and arm it again when it expires. Never block in a wait
  loop.
- `/auto-intake --accept-recommendations <TICKET> ...`: as the first form,
  and the Lead also takes its own recommendation for product decisions
  (gate 5). Add `accept: recommendations` to the state file and
  `Accept: recommendations` to the brief, after `Auto-intake: on`.
- `/auto-intake off`: stop the watch. Marked tickets keep their mark.
- `/auto-intake status`: list the marked tickets and their gate results.

Take only tickets assigned to the user. For an explicit ticket that already
has a state file, tell the user and ask before you take it again.

For each ticket, do the `cto` Triage, then gates A, B, 1 and 4. When they all
say yes, create the state file with `auto: true` in its frontmatter, add
`Auto-intake: on` to the brief, and spawn the Lead as usual. The Lead answers
gates 2, 3 and 5 in its plan.

## Gates

A yes goes on to the next gate. A no on gate 1 to 5 ends auto mode for that
ticket: spawn the Lead without the mark (before the spawn), or show the plan
as usual (at `PLAN_READY`), with one line on top:
`auto-intake: gate <n> said no: <reason>`.

- **A. Still yours?** The ticket is assigned to the user. No: someone else
  took it. Do not spawn. Tell the user, and go to the next ticket.
- **B. Fix still missing?** No pull request or commit already fixes it.
  Check the ticket's links, `gh pr list --search <TICKET> --state all`, and
  `git -C ~/www/<repo> log --all --oneline --grep <TICKET>`. No: spawn the
  Lead with `Auto-intake: verify <url>` in the brief. It verifies the
  existing fix and never opens a competing pull request.
- **1. Clear goal?** From the ticket alone, you can write the problem and the
  solution that the reporter wants. A bug states the expected result, what
  happens, the trigger, and the environment.
- **2. Reproduces?** (Lead, bugs only.) See the Lead's `## Auto-intake gates`.
- **3. Bounded impact?** (Lead.) The plan's `3 blast radius` line names
  the class, who uses the changed code today, the worst failure, how to
  revert, and the regression set, with a run that proves the bound. See the
  Lead's `## Auto-intake gates`.
- **4. Blast radius not red?** Classify the ticket before the spawn, and the
  plan again at `PLAN_READY`. The class follows who already uses the code
  that changes, not the topic: a new auth check is not red by itself.
  - **Red** (no): it changes how existing users sign in or what they may do
    (login, session, tokens, identity provider, existing roles or
    permissions, middleware on every request or response); a migration that
    changes or fills existing rows (backfill, `NOT NULL`, drop, rename);
    billing or money; email, SMS, or webhooks to real recipients; external
    or production configuration (DNS, providers, an env var that must exist
    before the deploy); production data; more than one system that must
    deploy in order; or an area that the brief marks risky.
  - **Yellow** (yes, with the regression rule): auth or permissions for a
    new surface (route, page, endpoint) behind a flag that is off in
    production, or that no user has today; a security fix that restricts
    one route or check (owner, scope, allowlist) of existing flows; an
    additive schema change without a backfill; a change to a shared
    component whose callers are listed. Regression rule: the evidence
    verifier compares main and the branch for each existing persona on the
    regression set. A difference that the plan does not ask for stops the
    ticket before the pull request (the Lead sends `BLOCKED`).
  - **Green** (yes): everything else.
- **5. No product decisions?** (Lead.) The plan's `## Decisions for you`
  has no product decision: UX, copy, policy, who may do what, cost, or a
  question for someone outside the team. The Lead settles technical choices
  itself. With `accept: recommendations`, the Lead also takes its
  recommendation for product decisions and lists them in `## Decisions
  taken`.

The user can relax the gates for a ticket or a project, for example
"everything is behind a feature flag, accept the recommendations, keep
going". Write the user's words in each state file's `## Decisions`, and
apply them at each gate. A waiver covers only what the user names.

## At PLAN_READY of a marked ticket

1. Read `## Auto-intake gates` in the plan. Check gate A again, and gate 4
   against the plan's `3 blast radius` line and files.
2. Any no: show the plan as the `cto` skill says, with the gate line on top.
3. All yes: open the veto window. Tell the user, in the user's language,
   with the class and the decisions that the Lead took:
   `<TICKET>: auto mode em 10 min (<class>: <one line>). Decisões tomadas: <list | nenhuma>. Responda "STOP <TICKET>" para ver o plano antes.`
   For a yellow ticket, or when the Lead took a product decision, put the
   line `Preciso de você:` before it, so that it reaches the user's phone.
   Arm a one-time check in 10 minutes with the session scheduler, and end the
   turn.
4. When the check fires: if the user sent `STOP <TICKET>`, show the plan as
   usual. If not, run `hc send <lead> "APPROVED"`, and append
   `auto-approved after the veto window` to the state file's `## Log`.

The Lead then works as usual until the pull request. The user approves the
pull request. Never merge. A `BLOCKED` from a yellow ticket whose regression
found a difference goes to the user as the `cto` skill says, with
`auto-intake: the regression found a difference` on top.

## Rules

- Only tickets assigned to the user. Unassigned tickets are out of scope.
- The mark lives in the state file (`auto: true`), so it survives a CTO
  restart. The watch does not: after `/cto`, run `/auto-intake --watch`
  again if the user wants it.
- When in doubt on a gate, the answer is no.
