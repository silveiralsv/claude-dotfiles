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
- **3. Small impact?** (Lead.) See the Lead's `## Auto-intake gates`.
- **4. Trusted area?** The ticket and the plan do not touch security,
  authentication, authorization, billing, privacy, migrations or schema,
  concurrency, or more than one system.
- **5. No decisions for you?** (Lead.) The plan's `## Decisions for you`
  says None.

## At PLAN_READY of a marked ticket

1. Read `## Auto-intake gates` in the plan. Check gate A again, and gate 4
   against the plan's files.
2. Any no: show the plan as the `cto` skill says, with the gate line on top.
3. All yes: open the veto window. Tell the user, in the user's language:
   `<TICKET>: auto mode em 10 min. Responda "STOP <TICKET>" para ver o plano antes.`
   Arm a one-time check in 10 minutes with the session scheduler, and end the
   turn.
4. When the check fires: if the user sent `STOP <TICKET>`, show the plan as
   usual. If not, run `hc send <lead> "APPROVED"`, and append
   `auto-approved after the veto window` to the state file's `## Log`.

The Lead then works as usual until the pull request. The user approves the
pull request. Never merge.

## Rules

- Only tickets assigned to the user. Unassigned tickets are out of scope.
- The mark lives in the state file (`auto: true`), so it survives a CTO
  restart. The watch does not: after `/cto`, run `/auto-intake --watch`
  again if the user wants it.
- When in doubt on a gate, the answer is no.
