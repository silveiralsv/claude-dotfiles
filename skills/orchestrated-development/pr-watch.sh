#!/usr/bin/env bash
# Wait until a pull request changes, print one line, and exit.
# Read-only: it only runs `gh`. It uses no model tokens while it waits, so a
# Lead runs it in the background instead of waking on a timer.
#
#   pr-watch.sh <pr-url> [interval-seconds=120] [max-hours=24]
#
# The exit line, first match wins:
#   MERGED | CLOSED
#   REVIEW decision=<APPROVED|CHANGES_REQUESTED|REVIEW_REQUIRED|NONE> reviews=+N comments=+N ci=<state>
#   CI_FAILED <check>,<check>   a check failed or was cancelled
#   CI_GREEN                    all checks passed
#   TIMEOUT                     nothing changed for max-hours
# Your own reviews and comments do not count. A failed gh call skips one tick.
set -uo pipefail

PR=${1:?usage: pr-watch.sh <pr-url> [interval-seconds] [max-hours]}
POLL=${2:-120}
END=$(( $(date +%s) + ${3:-24} * 3600 ))
ME=$(gh api user --jq .login) || { echo "ERROR gh is not logged in"; exit 1; }

snap() {
  local ci view
  # gh exits non-zero while checks fail or wait; only the JSON matters.
  ci=$(gh pr checks "$PR" --json name,bucket 2>/dev/null | jq -r '
    if length == 0 then "none"
    elif any(.[]; .bucket == "fail" or .bucket == "cancel")
      then "failed " + ([.[] | select(.bucket == "fail" or .bucket == "cancel") | .name] | unique | join(","))
    elif any(.[]; .bucket == "pending") then "pending"
    else "green" end' 2>/dev/null)
  [ -n "$ci" ] || ci=none # "no checks reported" prints no JSON
  view=$(gh pr view "$PR" --json state,reviewDecision,reviews,comments --jq "
    [.state, ((.reviewDecision // \"\") | if . == \"\" then \"NONE\" else . end),
     ([.reviews[] | select(.author.login != \"$ME\")] | length),
     ([.comments[] | select(.author.login != \"$ME\")] | length)] | @tsv" 2>/dev/null)
  [ -n "$view" ] || return 1
  printf '%s\t%s\n' "$view" "$ci"
}

base=$(snap) || { echo "ERROR cannot read $PR with gh"; exit 1; }
IFS=$'\t' read -r _ bdec brev bcom bci <<<"$base"

while [ "$(date +%s)" -lt "$END" ]; do
  sleep "$POLL"
  cur=$(snap) || continue
  IFS=$'\t' read -r st dec rev com ci <<<"$cur"
  case "$st" in MERGED | CLOSED) echo "$st"; exit 0 ;; esac
  if [ "$dec" != "$bdec" ] || [ "$rev" -gt "$brev" ] || [ "$com" -gt "$bcom" ]; then
    echo "REVIEW decision=$dec reviews=+$((rev - brev)) comments=+$((com - bcom)) ci=${ci%% *}"
    exit 0
  fi
  if [ "$ci" = pending ] || [ "$ci" = none ]; then
    bci=$ci
  elif [ "$ci" != "$bci" ]; then
    if [ "$ci" = green ]; then echo CI_GREEN; else echo "CI_FAILED ${ci#failed }"; fi
    exit 0
  fi
done
echo TIMEOUT
