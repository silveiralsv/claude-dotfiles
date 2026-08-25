# Installation prompt

Install this repository as the user's cross-platform Claude Code dotfiles.
Complete the installation on Windows, macOS, or Linux without replacing
unrelated Claude Code state.

Repository:

```text
https://github.com/silveiralsv/claude-dotfiles.git
```

## Safety requirements

- Detect the operating system, shell, home directory, and `CLAUDE_CONFIG_DIR`
  before changing anything. Use `~/.claude` only when `CLAUDE_CONFIG_DIR` is
  unset.
- Never link, replace, delete, or move the entire Claude Code home directory.
- Do not modify authentication, history, logs, `settings.json`, memory, MCP
  settings, or unrelated agents and skills.
- Inspect every destination before creating a link.
- Leave a destination unchanged when it already resolves to the correct source.
- If a destination exists and is not the correct link, explain the conflict and
  ask before moving it to a timestamped backup.
- Never discard local repository changes. If an existing checkout is dirty,
  use it without pulling and report that it was not updated.
- Use non-destructive Git operations only. Update a clean existing checkout
  with a fast-forward-only pull.

The user invoked this prompt to install these dotfiles and the declared
Ponytail and Caveman dependencies. Do not request confirmation for ordinary
clone, link creation, or installation of a missing declared dependency. Ask
only when resolving an existing conflicting destination or when elevated
permissions are required.

## Locate the checkout

1. If the current working directory is this repository, use it.
2. Otherwise, look in common user development locations for an existing
   checkout whose `origin` identifies `silveiralsv/claude-dotfiles`, whether
   the remote uses HTTPS or SSH. Do not scan the entire home directory.
3. If none exists, clone it to `~/claude-dotfiles` on macOS/Linux or
   `$HOME\claude-dotfiles` on Windows.
4. Resolve and retain the checkout's absolute path for all link targets.

## Create only these links

Create parent directories when missing. Link individual files and the single
skill so existing user content remains available.

```text
<CLAUDE_HOME>/skills/orchestrated-development
  -> <checkout>/skills/orchestrated-development

<CLAUDE_HOME>/agents/opus-xhigh-implementer.md
  -> <checkout>/agents/opus-xhigh-implementer.md

<CLAUDE_HOME>/agents/opus-xhigh-evidence-verifier.md
  -> <checkout>/agents/opus-xhigh-evidence-verifier.md

<CLAUDE_HOME>/agents/sonnet-pr-writer.md
  -> <checkout>/agents/sonnet-pr-writer.md
```

`<CLAUDE_HOME>` is `CLAUDE_CONFIG_DIR` when set, otherwise `~/.claude`.

On macOS and Linux, use symbolic links.

On Windows, use PowerShell symbolic links. If Windows refuses link creation,
explain that Developer Mode or an elevated shell is required and request the
smallest necessary action. Do not silently copy files as a fallback because
copies would not stay synchronized with the repository.

## Install workflow dependencies

First inspect whether each dependency is already installed. Do not reinstall
or downgrade an existing installation.

### Ponytail

Project: <https://github.com/DietrichGebert/ponytail>

If Ponytail is absent, verify that the `claude` CLI is available, then use the
current Claude Code plugin installation commands documented by the project:

```text
claude plugin marketplace add DietrichGebert/ponytail
claude plugin add ponytail@ponytail
```

Inspect `claude plugin --help` first and adapt only if the installed Claude
CLI uses an equivalent newer command. Do not guess unsupported flags.

### Caveman

Project: <https://github.com/JuliusBrussee/caveman>

The workflow needs the Caveman skills, especially `caveman-commit`; it does
not require the Caveman proxy. If the skills are absent, verify that `npx` is
available, then use the project's Claude Code skill installation command:

```text
npx skills add JuliusBrussee/caveman --skill '*' -a claude --yes
```

If Node.js, `npx`, Git, or Claude Code is missing, do not install a system
package manager or change shell profiles automatically. Report the missing
prerequisite and the smallest platform-appropriate installation step.

## Validate

After installation:

1. Verify every link exists and resolves to the intended checkout source.
2. Parse all three subagent Markdown frontmatter blocks or otherwise confirm
   they are readable and declare a model: `claude-opus-5` for the implementer
   and the verifier, `sonnet` for the pull-request writer.
3. Confirm the `orchestrated-development` skill contains a readable `SKILL.md`.
4. Confirm Ponytail and the Caveman skills are discoverable when installed.
5. Report created links, unchanged correct links, dependency actions, backups,
   and blockers.
6. Tell the user to start a new Claude Code session so skills and subagents
   are reloaded.

Do not create a commit, push, or pull request in the dotfiles repository
unless the user separately asks for publication.
