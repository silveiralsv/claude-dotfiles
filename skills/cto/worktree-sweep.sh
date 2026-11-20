#!/usr/bin/env bash
# Remove the worktrees whose pull request is merged, so no leftovers stay in ~/www.
# A worktree goes only when all of these are true:
#   - its branch has a merged pull request and no open one;
#   - the branch has no commit that the merged pull request does not have;
#   - no process runs inside it (a live Lead, a dev server, a `claude -w` session);
#   - `git worktree remove` accepts it without --force (no changed or untracked
#     files, not locked). Ignored files such as node_modules go with it.
# Then its local branch goes too. The main checkout, detached worktrees, and
# branches without a merged pull request are never touched, and neither are
# worktrees outside the folder of the main checkout (for example ~/.codex).
#
#   worktree-sweep.sh [--dry-run] <repo-path>...
#
# Prints one line per worktree it keeps for a reason, and a summary per repo.
# The removed paths are appended to ~/claude-workflows/worktree-sweep.log.
set -uo pipefail

DRY=
[ "${1:-}" = --dry-run ] && { DRY=1; shift; }
[ $# -gt 0 ] || { echo "usage: worktree-sweep.sh [--dry-run] <repo-path>..."; exit 2; }
LOG=~/claude-workflows/worktree-sweep.log
mkdir -p ~/claude-workflows

# The working directory of every live process, to skip a worktree in use.
CWDS=$(lsof -a -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | sort -u)
in_use() { printf '%s\n' "$CWDS" | grep -qE "^$(printf '%s' "$1" | sed 's/[][\.*^$+?(){}|]/\\&/g')(/|\$)"; }

for arg in "$@"; do
  repo=$(cd "$arg" 2>/dev/null && cd "$(git rev-parse --git-common-dir)/.." && pwd) \
    || { echo "$arg: not a git repo"; continue; }
  git -C "$repo" fetch -q --prune origin 2>/dev/null || echo "$repo: fetch failed, using the local refs"
  # branch <TAB> head commit of each merged pull request; branches of open ones.
  merged=$(cd "$repo" && gh pr list --state merged --limit 1000 --json headRefName,headRefOid \
    -q '.[] | "\(.headRefName)\t\(.headRefOid)"' 2>/dev/null) \
    || { echo "$repo: gh pr list failed, skipped"; continue; }
  open=$(cd "$repo" && gh pr list --state open --limit 500 --json headRefName -q '.[].headRefName' 2>/dev/null) \
    || { echo "$repo: gh pr list failed, skipped"; continue; }

  removed=0 kept=0 other=0
  while IFS=$'\t' read -r path branch; do
    [ "$path" = "$repo" ] && continue # the main checkout
    case "$path" in "$(dirname "$repo")"/*) ;; *) continue ;; esac # other tools' worktrees (~/.codex)
    if [ -z "$branch" ]; then other=$((other + 1)); continue; fi # detached
    oids=$(printf '%s\n' "$merged" | awk -F'\t' -v b="$branch" '$1 == b { print $2 }')
    if [ -z "$oids" ] || printf '%s\n' "$open" | grep -qxF "$branch"; then
      other=$((other + 1)); continue
    fi
    tip=$(git -C "$repo" rev-parse -q --verify "refs/heads/$branch") || { other=$((other + 1)); continue; }
    covered=
    for oid in $oids; do # the tip is the merged head, or an older commit of it
      if [ "$tip" = "$oid" ] || git -C "$repo" merge-base --is-ancestor "$tip" "$oid" 2>/dev/null; then covered=1; break; fi
    done
    [ -n "$covered" ] || [ -z "$(git -C "$repo" rev-list -n1 "$tip" --not --remotes)" ] && covered=1
    if [ -z "$covered" ]; then echo "kept $path: commits that the merged pull request does not have"; kept=$((kept + 1)); continue; fi
    if in_use "$path"; then echo "kept $path: a process runs inside it"; kept=$((kept + 1)); continue; fi
    if [ -n "$DRY" ]; then echo "would remove $path ($branch)"; removed=$((removed + 1)); continue; fi
    if err=$(git -C "$repo" worktree remove "$path" 2>&1); then
      git -C "$repo" branch -q -D "$branch" 2>/dev/null
      echo "$(date +%FT%T%z) removed $path ($branch)" >>"$LOG"
      removed=$((removed + 1))
    else
      echo "kept $path: $(printf '%s' "$err" | head -1)"; kept=$((kept + 1))
    fi
  done < <(git -C "$repo" worktree list --porcelain | awk '
    /^worktree / { if (p != "") print p "\t" b; p = substr($0, 10); b = "" }
    /^branch refs\/heads\// { b = substr($0, 19) }
    END { if (p != "") print p "\t" b }')
  [ -n "$DRY" ] || git -C "$repo" worktree prune
  echo "$repo: ${DRY:+would }remove $removed, kept $kept, not merged or detached $other"
done
