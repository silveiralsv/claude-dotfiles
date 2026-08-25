---
name: orchestrated-development
description: Orchestrate non-trivial repository development through parent-led investigation and planning, implementation by the opus-xhigh-implementer subagent, parent review, runtime verification with screenshot evidence by the opus-xhigh-evidence-verifier subagent, parent acceptance, and pull-request publication by the sonnet-pr-writer subagent. The primary model acts as architect, reviewer and approver; three subagent workers do the implementation, verification and publication work. Use for features, substantial fixes, maintenance, refactors, and tests — trigger on "orchestrated development", "delega a implementação", "roda com os subagentes sonnet", "implementa com o workflow orquestrado". Do not use for read-only analysis, diagnosis without requested fixes, or tiny mechanical changes.
---

# Orchestrated Development

Run non-trivial development work with the primary agent as orchestrator,
architectural owner, reviewer, and final approver.

## Roles

The primary agent (the session model — e.g. Fable/Opus) owns project-state
interpretation, ticket selection, investigation, architecture, implementation
planning, risk analysis, review of the actual diff, and final acceptance.

Custom agents are:

- `opus-xhigh-implementer` (Opus 5, effort xhigh): the only write-heavy
  implementation and fix worker.
- `opus-xhigh-evidence-verifier` (Opus 5, effort xhigh): the only agent that runs
  the application under test. Exercises the changed behavior and captures
  evidence. Writes only evidence files, never source.
- `sonnet-pr-writer` (Sonnet, effort medium): the final branch, commit, push,
  and pull-request worker.

Do not create an architectural reviewer subagent. Review of the diff and final
acceptance remain with the primary agent. The evidence verifier is not a
reviewer — it reports what the running application does, and the primary agent
decides what that means.

## Completion boundary

For substantial development requests, runtime verification with captured
evidence, branch creation, commit, push, and pull-request creation are part of
completion unless the user requests local-only work, says not to create a pull
request, repository instructions prohibit it, or authentication, permissions,
or external state block publication.

Never merge automatically.

For a very small or mechanical change, the primary agent may implement
directly when delegation would cost substantially more than the change. It
must still inspect the diff and run proportionate validation.

That allowance covers implementation only. If the change has a runnable
surface, runtime verification still goes to `opus-xhigh-evidence-verifier` — a
change small enough to write directly is not thereby small enough to verify
directly.

## Workflow

### 1. Establish the baseline

Before changing anything:

- Read every applicable `CLAUDE.md` (root and app-specific).
- Inspect the current branch, Git status, existing diff, recent commits,
  remotes, and relevant open pull requests when available.
- Record pre-existing or unrelated changes so they are not confused with
  worker output.
- Use the repository's existing ticket, roadmap, planning, or project-state
  mechanism (Linear tickets, the vault PI-Index when one exists).
- Resume existing in-progress work before selecting later work.
- Use a user-supplied ticket or task directly.
- When no task was supplied, select work only from clear repository evidence.
  Ask the user when the choice would materially change scope.

### 2. Investigate

Perform proportionate investigation of the affected architecture, ownership,
existing patterns, reusable code, callers, dependencies, data flow, tests,
integration boundaries, failure modes, and edge cases. Consider security,
authorization, data integrity, compatibility, concurrency, and performance
when relevant.

Keep investigation focused and reuse context already established in the task.

### 3. Approve an implementation plan

Before delegation, produce a concrete plan containing what is relevant:

- desired outcome and acceptance criteria;
- files or systems likely affected;
- required behavior and ownership boundaries;
- API, state, data, protocol, or interface changes;
- architectural and compatibility constraints;
- edge cases and failure handling;
- expected tests and validation commands;
- known pre-existing worktree changes;
- explicit exclusions.

The primary agent owns all architectural decisions. Give the worker enough
context to implement without repeating broad investigation.

### 4. Delegate implementation

Spawn the custom agent named exactly `opus-xhigh-implementer` via the Agent
tool (`subagent_type: "opus-xhigh-implementer"`). Provide the task or ticket
identifier, approved plan, acceptance criteria, relevant architectural
context, baseline worktree state, excluded scope, and validation expectations.

Do NOT pass a `model` override on the Agent call — the agent definition owns
its model and reasoning effort. Only one write-heavy agent may work on the
task at a time. Do not spawn competing implementers or parallel writers.

Note the returned agent id: corrections go back to the SAME agent via
SendMessage, which preserves its context. Wait for implementation and
validation to finish before reviewing.

### 5. Review the actual diff

The primary agent must inspect Git status and the complete resulting diff
against the recorded baseline (`git diff`, `git status`). Never accept
implementation solely from the worker summary or because tests pass.

Review correctness, requirements coverage, architecture, ownership,
unnecessary complexity, regressions, assumptions, edge cases, failure
handling, compatibility, test quality, maintainability, security,
authorization, concurrency, migrations, destructive behavior, performance,
and unrelated changes when relevant.

Use Ponytail guidance when available to identify code that can be deleted,
reused, or replaced by existing or native functionality. Its absence must not
block the workflow.

### 6. Correct substantive findings

Send precise corrective instructions to the same `opus-xhigh-implementer`
agent via SendMessage (using the agent id from step 4). Include the affected
behavior or location, why it is incorrect, the expected correction, and
validation that must be rerun.

Do not spawn a replacement implementer. Avoid correction loops for cosmetic
preferences handled by formatters or linters.

The primary agent may directly fix a tiny mechanical issue when clearly more
efficient. Architecture-sensitive corrections return to the implementer.

### 7. Verify the running application and capture evidence

Once the diff is correct, spawn the custom agent named exactly
`opus-xhigh-evidence-verifier` via the Agent tool
(`subagent_type: "opus-xhigh-evidence-verifier"`, no model override). Ensure the
implementer has finished first — the two must never run at the same time.

Provide the ticket identifier or task slug, the change summary and changed
files, the acceptance criteria to exercise, how to reach the affected behavior
(route, screen, command, endpoint), and any flags, credentials, personas, or
seed data the scenario needs. Reaching the changed behavior is the point;
without a concrete entry point the worker verifies nothing.

Evidence is written to `~/claude-workflows/<ticket-id-or-slug>/evidences`,
outside every repository so it can never be swept into the pull request.

Skip this step only when the change has no runnable surface at all — pure
documentation, comments, or configuration that nothing executes. Say so
explicitly; never skip it silently to save time.

A verdict other than Verified returns to step 6: send the evidence and the
precise failure to the same `opus-xhigh-implementer` agent. After the fix,
re-verify by spawning `opus-xhigh-evidence-verifier` again — never by checking it
yourself because the remaining doubt is small.

Do not proceed to acceptance on a Partially verified, Not verified, or Blocked
result.

Inspect the evidence yourself. A worker's claim that a screenshot shows the
expected state is not the same as the screenshot showing it.

#### The primary agent never captures evidence itself

Verification runs in the worker, always. The primary agent must not, at any
point in this workflow:

- start, serve, or free ports for the application under test;
- drive a browser, simulator, or UI against it;
- take a screenshot or write anything into the evidence directory;
- run an end-to-end or manual scenario to satisfy itself the change works.

This holds regardless of how small the change looks, how confident the diff
review left you, how much faster doing it yourself would be, whether the
application is already running, whether the check is "just one page", or
whether a prior verification already passed and only a small delta remains.
Cost and convenience are never a reason to absorb this step.

Reading the returned evidence, judging whether it proves the criteria, and
rejecting insufficient evidence are the primary agent's job. Producing it is
not. If the evidence is inadequate, send the worker back with a more precise
scenario instead of capturing the missing shot yourself.

The only permitted exception is an explicit user instruction to skip
delegation. Announce it when it happens.

### 8. Perform final acceptance

Confirm requirements and acceptance criteria, architectural consistency,
scope, tests, highest-signal checks, and error handling. Confirm applicable
security, authorization, integrity, compatibility, concurrency, migration,
and performance concerns are resolved.

Run lint, type checks, builds, schema validation, and the test suite when
relevant — these are static or headless checks the primary agent owns. Any
check that requires the application to be running belongs to step 7 and its
worker, never to the parent.

Update repository planning state and acceptance evidence only when the task is
genuinely complete.

### 9. Publish the pull request

After final acceptance, spawn the custom agent named exactly
`sonnet-pr-writer` via the Agent tool (`subagent_type: "sonnet-pr-writer"`,
no model override). Provide the approved file scope, ticket or task
identifier, implementation summary, validation results, the verification
verdict and evidence directory, architectural decisions worth recording,
intended base branch, and known limitations or follow-ups.

Do not reach this step without either a Verified verdict from
`opus-xhigh-evidence-verifier` or an explicitly stated reason the change has no
runnable surface. A pull request opened on self-assurance instead of captured
evidence is the failure this workflow exists to prevent.

Ensure no other write-heavy agent is active. The PR worker may create the
branch, commit, push, and open the pull request using repository conventions
and `gh` when available.

If the caveman-commit skill is available, it may produce the commit message.
Its absence must not block publication.

If the PR worker finds a substantive problem, return control to the primary
agent. The PR worker must not redesign or hide failing validation.

Never merge, force-push, rewrite unrelated history, discard unrelated changes,
or use destructive Git operations.

## Parent-owned decisions

The primary agent retains ownership of major architecture, authentication,
authorization, trust boundaries, financial logic, risky migrations,
concurrency, distributed behavior, caching consistency, queues, events,
external integrations, public contracts, backward compatibility,
performance-sensitive systems, infrastructure, deployment, data integrity,
destructive operations, and complex state synchronization.

The implementer may execute an approved plan in these areas but must escalate
missing, contradictory, or unsafe decisions instead of improvising.

## Cost and context discipline

- Reuse established context and repository planning artifacts.
- Pass concise but complete handoffs.
- Do not ask workers to rediscover architecture unnecessarily.
- Do not duplicate tasks or use parallel write-heavy agents.
- Keep reports limited to changes, validation, blockers, deviations, and
  material findings.
- Reserve the primary agent's reasoning for investigation, architecture,
  ambiguity, difficult debugging, review, risk analysis, and acceptance.
- Token efficiency never justifies skipping correctness or validation, and
  never justifies absorbing a delegated step into the parent.

## Observability

Whenever work is delegated:

- Use the configured custom agent by its exact name.
- Make delegation visible through normal subagent activity.
- Do not silently perform delegated implementation, verification, or
  publication work in the parent.
- Identify which agent performed the work after it returns.
- Inspect the actual diff rather than trusting its summary.
- Never report a change as verified without a `opus-xhigh-evidence-verifier` run
  behind it. "I checked it myself" is not a verification result, and neither
  is a passing test suite.
