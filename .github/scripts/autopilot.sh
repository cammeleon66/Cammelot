#!/usr/bin/env bash
# Backlog autopilot: drives a fixed queue of issues through the Copilot cloud agent,
# merges on green Validate, deploys master to the publishing branch and closes issues.
# Anything it cannot decide safely becomes an alert issue, which halts later runs.
set -euo pipefail

R="${GITHUB_REPOSITORY}"
QUEUE="${AUTOPILOT_QUEUE:-52 53 54 55 56}"
PUBLISH_BRANCH="feature/agentic-overhaul"
MAX_PINGS=3
CONTINUE_MARK="<!-- autopilot:continue -->"
FIX_MARK="<!-- autopilot:fix -->"

log() { echo "[autopilot] $*"; }

alert() {
  local n="$1" msg="$2" title="Autopilot blocked on #$1"
  if [[ -z "$(gh issue list -R "$R" --state open --search "\"$title\" in:title" --json number -q '.[0].number')" ]]; then
    gh issue create -R "$R" -t "$title" -b "$msg

The autopilot halts while this alert is open. Close it after resolving the cause to resume." >/dev/null
  fi
  log "ALERT #$n: $msg"
  exit 0
}

instructions() {
  cat <<EOF
Implement issue #$1 exactly as scoped in its body, including the Invariants section. Its predecessors in the B-series are already merged to master: do not wait for anything. Commit and push in stages so nothing is lost if the session times out. Keep the PR checklist current and tick every item when done. Never POST to the production leaderboard. Use Python with newline='' and UTF-8 for site/*.html edits. CI runs 'git diff --check': no trailing whitespace (in Markdown use <br>, not two trailing spaces). Cite the CI Validate run instead of claiming tests you did not run.
EOF
}

count_marked() { # pr, marker
  gh api "repos/$R/issues/$1/comments" --paginate -q "[.[]|select(.body|contains(\"$2\"))]|length" | awk '{s+=$1} END {print s+0}'
}

agent_running() { # branch
  gh run list -R "$R" -w "Copilot cloud agent" -b "$1" -L 5 --json status \
    -q '[.[]|select(.status!="completed")]|length'
}

publish_master() { # label
  git fetch -q origin master "$PUBLISH_BRANCH"
  git merge-base --is-ancestor origin/master "origin/$PUBLISH_BRANCH" && return 0
  git checkout -q -B publish "origin/$PUBLISH_BRANCH"
  if ! git merge --no-edit -q origin/master -m "Publish $1 (autopilot)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"; then
    git merge --abort || true
    alert "${1#\#}" "Merging master into $PUBLISH_BRANCH conflicted while publishing $1."
  fi
  git push -q origin "publish:$PUBLISH_BRANCH"
  log "published master to $PUBLISH_BRANCH ($1)"
}

if [[ -n "$(gh issue list -R "$R" --state open --search '"Autopilot blocked" in:title' --json number -q '.[0].number')" ]]; then
  log "an open autopilot alert exists; halting"; exit 0
fi

for n in $QUEUE; do
  [[ "$(gh issue view "$n" -R "$R" --json state -q .state)" == "CLOSED" ]] && continue
  log "working on #$n"

  pr_json="$(gh pr list -R "$R" --state all -L 100 \
    --json number,state,isDraft,body,headRefName,headRefOid,mergeStateStatus,mergeCommit \
    | jq -c --arg re "(Fixes|Closes|Resolves) #$n\\b" '[.[]|select(.body|test($re))]|sort_by(.number)|last // empty')"

  if [[ -z "$pr_json" ]]; then
    if gh issue view "$n" -R "$R" --json assignees -q '[.assignees[].login]|index("Copilot")' | grep -q '^[0-9]'; then
      log "#$n assigned; waiting for Copilot to open a PR"; exit 0
    fi
    jq -n --arg r "$R" --arg ci "$(instructions "$n")" \
      '{assignees:["copilot-swe-agent[bot]"],agent_assignment:{target_repo:$r,base_branch:"master",custom_instructions:$ci}}' \
      | gh api -X POST "repos/$R/issues/$n/assignees" --input - >/dev/null
    log "assigned #$n to Copilot"; exit 0
  fi

  pr="$(jq -r .number <<<"$pr_json")"; state="$(jq -r .state <<<"$pr_json")"
  branch="$(jq -r .headRefName <<<"$pr_json")"; head="$(jq -r .headRefOid <<<"$pr_json")"

  if [[ "$state" == "MERGED" ]]; then
    sha="$(jq -r .mergeCommit.oid <<<"$pr_json")"
    publish_master "#$n"
    gh issue close "$n" -R "$R" -c "Shipped by the autopilot via #$pr (merged ${sha:0:7}; required Validate check passed) and published to \`$PUBLISH_BRANCH\`, which runs the Pages deployment and its tests. Live verification and human review are pending." >/dev/null
    log "closed #$n"
    continue
  fi
  [[ "$state" == "CLOSED" ]] && alert "$n" "PR #$pr was closed without merging."

  if [[ "$(agent_running "$branch")" != "0" ]]; then log "Copilot is working on #$pr"; exit 0; fi

  real_commits="$(gh pr view "$pr" -R "$R" --json commits -q '[.commits[]|select(.messageHeadline!="Initial plan")]|length')"
  open_items="$(jq -r '.body' <<<"$pr_json" | { grep -E '^\s*- \[ \]' || true; } | awk 'length($0) > 90 || tolower($0) !~ /codeql|code review/' | wc -l | tr -d ' ')"
  # Copilot often finishes without ticking its checklist: if it pushed commits after
  # our latest continue ping, treat the work as done and let Validate decide.
  last_ping="$(gh pr view "$pr" -R "$R" --json comments -q "[.comments[]|select(.body|contains(\"$CONTINUE_MARK\"))]|last|.createdAt // \"\"")"
  head_date="$(gh api "repos/$R/commits/$head" -q .commit.committer.date)"
  if [[ "$real_commits" != "0" && -n "$last_ping" && "$head_date" > "$last_ping" ]]; then open_items=0; fi
  if [[ "$real_commits" == "0" || "$open_items" != "0" ]]; then
    pings="$(count_marked "$pr" "$CONTINUE_MARK")"
    (( pings >= MAX_PINGS )) && alert "$n" "Copilot stopped $pings times on #$pr with unfinished work ($open_items open checklist items, $real_commits implementation commits)."
    gh pr comment "$pr" -R "$R" -b "@copilot Your session ended with unfinished work ($open_items open checklist items, $real_commits implementation commits). All predecessors are merged to master; do not wait. Please continue and finish issue #$n, pushing in stages. $CONTINUE_MARK" >/dev/null
    log "asked Copilot to continue #$pr"; exit 0
  fi

  validate="$(gh api "repos/$R/commits/$head/check-runs" -q '[.check_runs[]|select(.name=="Validate")]|sort_by(.started_at)|last|"\(.status) \(.conclusion) \(.html_url)"')"
  if [[ "$validate" == completed\ failure* ]]; then
    fixes="$(count_marked "$pr" "$FIX_MARK")"
    (( fixes >= MAX_PINGS )) && alert "$n" "Validate failed $fixes times on #$pr: ${validate##* }"
    gh pr comment "$pr" -R "$R" -b "@copilot The required Validate check failed on ${head:0:7}: ${validate##* } . Open that run, read the failing step's log, fix the cause and push. $FIX_MARK" >/dev/null
    log "asked Copilot to fix Validate on #$pr"; exit 0
  fi

  if [[ "$(jq -r .isDraft <<<"$pr_json")" == "true" ]]; then gh pr ready "$pr" -R "$R"; fi
  if [[ "$(jq -r .mergeStateStatus <<<"$pr_json")" == "BEHIND" ]]; then gh pr update-branch "$pr" -R "$R" || true; fi
  gh pr merge "$pr" -R "$R" --squash --auto || log "auto-merge not yet accepted (check queued); will retry"
  log "#$pr ready with auto-merge"; exit 0
done

publish_master "the completed queue"
log "queue complete"
