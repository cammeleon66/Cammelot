# Autonomous approved-backlog dispatcher

## Scope and architecture

Dependency-free **Node 20+**, plus an already authenticated `gh` executable on PATH.
The only repository is `cammeleon66/Cammelot`, the implementation base is **master**,
the allowlist is **issues 1–21**, and the ceiling is **three active coding sessions**.
The repository's older default branch is deliberately not used.
Bootstrap/infrastructure PRs (including PR25) are not ordinary backlog work.

Three small modules provide the interface:

- `policy.mjs`: pure snapshot-to-plan policy, file scope, lanes, acceptance, review
  and validation gates. Tests exercise this same seam.
- `github.mjs`: `gh.exe` on Windows / `gh` elsewhere, with fixed argv,
  `shell: false`, JSON request bodies over stdin, bounded reads, and a read-only
  default. No issue text becomes a command. No checked-out PR code is executed.
- `dispatcher.mjs`: run once, take an exclusive filesystem lock, read authoritative
  remote data, plan, re-read before mutation, checkpoint durable intent, and perform
  **at most one logical mutation**. Subsequent invocations reconcile outcomes.
  Consequently there is at most one merge per invocation, and a fresh base/plan
  precedes any later merge or next dispatch.

No workflow engine, npm dependency, token export, repository setting change,
branch-protection bypass, `--admin`, force merge, or routine human approval queue.
The dispatcher does **not** modify or install itself. Publish and install a
reviewed stable copy separately; never point the scheduler at a moving PR checkout.

## Commands and installation interface

From a reviewed checkout:

```powershell
node --test tests/automation_dispatcher.test.mjs

# Parent installs the final reviewed/merged modules into app\scripts\automation.
$Root = Join-Path $HOME '.copilot\automation\cammelot-backlog'
$Install = Join-Path $Root 'app'
$State = Join-Path $Root 'state'
$Logs = Join-Path $Root 'logs'

# Omission of --apply also means dry-run.
node "$Install\scripts\automation\dispatcher.mjs" run --state-dir "$State" --dry-run
node "$Install\scripts\automation\dispatcher.mjs" run --state-dir "$State" --apply
```

`--state-dir` is required, absolute, and outside the installed copy. It holds
`state.json` and the `dispatcher.lock` directory. Use a local filesystem and
restrict access to the current user; do not use a network/synchronised share.
Dry-run performs remote **reads only**: it does not create the directory, acquire
a lock, write the ledger, request a review, or mutate GitHub.

Parent installs **`Cammelot-AutonomousBacklog`** with Windows Task Scheduler, every
five minutes plus logon catch-up, under the current user's **Interactive / Limited**
logon. The parent registers the OS configuration; this module is not an installer.
Use absolute paths to `node.exe`, the installed dispatcher, and its state directory.
The scheduler action is the same `run --state-dir ... --apply` command above.
Prevent parallel task instances; the dispatcher's lock is a second safeguard.
Preserve JSON stdout/stderr in the sibling `logs` directory through the parent's wrapper/log collector;
Task Scheduler does not itself retain console output.

**The machine must remain on and the user logged in. The Copilot CLI can close.**
Cloud coding tasks already launched can continue while this local dispatcher is
offline; queue advancement/review/validation/merge actions resume when it runs again.
The existing Windows keyring authentication is reused by `gh`. Do not create,
copy, print, or store a token in a task, environment file, command line, or ledger.
No Azure deployment secret is used. This is a local dispatcher because the built-in
cloud automation mechanism is not available for this public repository.

Exit codes: `0` = a valid pass (including holds/parks), `1` = failed/uncertain pass,
`75` = existing lock. Logs are newline-delimited JSON with plan/holds, operation
IDs, mutation/reconciliation events and failures. Issue bodies and auth stderr
are not dumped into logs.

## Dispatch and resource policy

Native issue blockers are authoritative. Every blocker must be an allowlisted
same-repository issue, closed with `state_reason=completed`, with its associated
work verifiably merged into the current master ancestry. Closed-not-planned,
stopped sessions, missing PRs, and missing merged evidence are **not** success.
External blockers hold rather than being guessed complete.

Ready work is ordered by P0, then P1, then other priorities; within a priority,
milestone due date/number, then issue number. Labels are matched as `P0`/`P1`
prefixes, including the live `priority:P0` / `priority:P1` / `priority:P2` names.
Open implementation PRs, assignments awaiting PR association, pending
repairs, and active sessions reserve capacity. Duplicate implementations park.
Unknown active task association holds new starts conservatively.
Capacity counts every active session individually, then adds open-work/assignment
reservations not represented by those sessions. Duplicate sessions never hide an
unrelated pending assignment. The same accounting gates evidence/repair follow-ups.

| Issue(s) | Writer lanes |
| --- | --- |
| 1 | contract |
| 17 | research |
| 9 | CI/deployment |
| 15 | minister + leaderboard |
| 21 | minister + research |
| All other allowlisted issues | minister |

Task REST state alone is not sufficient: branch-scoped Actions runs named
`Running Copilot cloud agent` / `Addressing comment on PR #...` (and coding-agent
dynamic paths) reserve work even when the task still says `completed`, including
runs on **older source SHAs**. Mirrored task/run observations count by the larger
per-PR count; ambiguous associations remain conservative.

A parked inactive implementation releases its lanes, allowing unrelated work to
continue. An actually running parked task retains its slots/lanes: parking is not
cancellation, and the dispatcher never pretends an agent has stopped.
Do not run another independent dispatcher or manually launch extra coding tasks.

File scope is deliberately explicit in `fileAllowed()`:

- Contract: `docs/MINISTER_*CONTRACT*.md`, the reference protocol, Minister ADRs,
  and the authorized minimal discovery link in `README.md` (issue1 only).
- Research17: `docs/research/*.md`, `docs/RESEARCH_*.md`, or
  `00_Project_Strategy/research/*.md`; never shared README.
- Minister work: `site/minister.html`, Minister-specific source/config,
  scripts/tests, and non-contract Minister documentation.
- Leaderboard15 additionally allows leaderboard source/test/documentation.
- Deployment9 allows workflow/deployment files; **all other issues reject workflow
  edits**, including renames from a forbidden path.
- Experiments21 additionally allows research-monitor/experiment files.
- Dispatcher files are not modifiable by ordinary backlog PRs.

Year-versioned research filenames such as `docs/RESEARCH_PROTOCOL_2027.md` are
included. Scope rejection waits while coding is active. A completed behind branch
is updated first: its old merge-base diff may list bootstrap files already on
master. The refreshed diff must still satisfy the same file policy.
An unexpected legitimate path is a visible scope park, not automatic scope
expansion. Change the reviewed policy and rerun tests to approve a new path.
The file policy is a containment check, not a semantic proof: independent review
must also assess the issue's actual requested scope.

## Completion and merge gates

1. Exactly one allowlisted closing reference, from PR closing references or a
   controlled `Fixes #N` / same-repository full reference, optionally prefixed by
   one Markdown list bullet. Multiple/foreign refs
   are not accepted. Base/head repository must be this repository, base `master`,
   author the coding bot (including REST login `Copilot`, verified by bot type and
   node ID `BOT_kgDOC9w8XQ` or database ID `198982749`, never the login alone),
   not the independent review bot, and every changed and
   renamed-from path allowed.
2. Coding tasks **and branch Actions sessions** must be idle/completed, not queued
   or running. Failed/idle/waiting/timed-out/cancelled tasks require repair, not
   fabricated completion.
3. A completed draft is marked ready as its **own action/pass**, before review/CI
   readiness. `ready_for_review` may enqueue/cancel same-head CI, so that pass never
   merges. The next pass reads all runs again.
4. Update a behind branch with `expected_head_sha`, then wait for new source-head
   evidence/checks/review. Update requests are deduplicated by source/base pair.
5. Require coding-bot **current-head acceptance evidence**, as a PR comment:

   ```text
   <!-- backlog-evidence {"issue":1,"head":"40-character source SHA","criteria":[{"criterion":"Each acceptance criterion","evidence":"Concrete test/result or file evidence"}],"tests":["Actual command and result"],"humanValidation":"not-required","limitations":[],"blockingGaps":[]} -->
   ```

   This is a claim for independent review, not an assertion that prose is a test.
   All criteria must be documented honestly. The reviewer must assess completeness,
   tests, calibration claims and limitations. Issue16 remains parked when genuine
   human/device evidence is required; the runner does not manufacture or auto-certify
   that evidence. Existing PRs without the marker receive a deduplicated
   administrative evidence request, separate from the failed-code repair budget.
   Nonblocking scientific caveats may remain in `limitations`, but nonempty
   limitations require an explicit empty `blockingGaps` declaration. Any blocking
   gap prevents acceptance. Legacy markers with empty limitations remain supported;
   ambiguous nonempty limitations are never silently interpreted as completion.
6. Require the **latest current-head** trusted workflow run at
   `.github/workflows/minister-backlog-checks.yml`, name `Minister backlog checks`,
   from this repo/PR branch, event PR or workflow_dispatch, completed successfully,
   including its successful `Validate` job. A newer queued/failed run or attempt
   defeats an older success. Different workflow identities at the same trusted
   path are ambiguous and hold.
   A latest `action_required` result is not a code failure or grounds to use an
   older green run. The validated authorization mechanism is
   `POST actions/runs/{id}/rerun`, **never `/approve`**. A `rerun-validation` action
   requires an idle, scope-allowed official-bot PR with current master included,
   the exact trusted current-head PR run/attempt, and identical CI-definition blob
   SHAs fetched at the immutable master and source commits. Changed/unverified CI
   definitions hold, **even for issue9**. A fresh snapshot revalidates all identities
   before POST. Each run/head/attempt is requested once, then CI is re-read next pass;
   at most three such requests per head, with a 24-hour bounded wait and no code-repair
   charge. A successful newer attempt counts only after its real Validate job and
   all remaining current-head checks succeed.
7. All other current checks/statuses must also succeed, including
   `Running Copilot Code Review`. Zero checks, missing metadata, pending, cancelled,
   skipped, neutral or failed checks are not success. Superseded check attempts
   are compared by app + workflow + job name (latest check ID); same-name checks
   from other apps/workflows cannot mask each other. Commit statuses use the latest
   status per context. GitHub Actions check-suite IDs must map to workflow IDs.
8. Require a genuine current-head REST review from
   `copilot-pull-request-reviewer[bot]`, zero comments on that review, no unresolved
   threads (even outdated ones), and no effective changes-requested verdict.
   Accept genuine `APPROVED`, or the observed `COMMENTED` overview:
   `<!-- ccr-overview-v2 -->`, first heading `### 🟢 Approval recommended`,
   and explicit `**No open issues** 🎉`.
   Historical resolved findings inside `<details>` are not new open findings.
   Narrow explicit approval/no-actionable-assessment text is also recognized;
   unfamiliar prose, missing reviews, or negative assessments never pass.
9. Re-read all metadata before mutation. Immediately before merge, recheck source
   head/base, latest-base ancestry and all gates, then re-read base/head again.
   Merge uses only `gh pr merge --squash --match-head-commit SHA`.
10. Verify REST `merged=true`, the expected source SHA, and merge-commit ancestry
    in master after merge. Reconcile again on a later pass before explicitly
    closing the issue with `state_reason=completed`. `Fixes` is not relied on to
    close issues, because master is not the default branch.

**Native protection:** the parent has installed strict required `Validate`
protection on master, bound to GitHub Actions **app 15368**. This supplies the
server-side up-to-date/check enforcement that an expected-source-SHA CLI guard
alone cannot provide. The runner still performs its final source/base reads and
never uses an administrator bypass. It never installs, changes or weakens repo
settings. Keep strict protection enabled: without it, GitHub's merge command has
no expected-base-SHA condition, so external concurrent merges would reintroduce
the residual base race despite the final reads.

## Bounded repairs, parking and recovery

- At most **three repair comments per issue**, with persistent reason/head
  fingerprints. A repair is one `@copilot` comment with the failing condition,
  source SHA, review/check links, evidence contract and scope instructions.
  It is subject to the same slot/lane constraints.
- Acceptance re-attestation after a source/base update uses a distinct
  **`evidence` action**, at most one request per source SHA, with a 24-hour wait.
  These administrative requests **do not consume or reset** the three-attempt
  substantive repair budget. They still reserve coding slots/lanes until their
  execution is observed, have durable mutation intent and comment deduplication,
  and never accept a marker for an older SHA. A genuine gap times out/parks;
  new peer merges cannot exhaust an unrelated issue's code-repair budget merely
  by invalidating its previous evidence marker.
- Agents must fix substantive findings, verify them, and resolve **only genuinely
  addressed** threads with a reason/fixing commit. Never blanket-dismiss findings.
- Identical repairs are not repeated. Stalled identical repairs, review requests,
  update requests and missing-evidence waits park after 24 hours. Genuine running
  cloud tasks continue to reserve capacity; they are not forcibly cancelled.
- Parking is a conspicuous **`AUTOMATION PARKED` issue comment** plus durable local
  state (no label creation or repo-setting modification required).
- Durable intent is fsynced and atomically renamed **before** a subprocess call.
  After a timeout/crash/partial API failure, the next pass re-reads remote state
  first. Unconfirmed non-idempotent dispatch/repair/merge/close operations are
  parked, not blindly retried. A review/update intent reserves its head even if
  the response was lost. An unconfirmed parking comment emits an error and records
  `visibilityUncertain`; it does not flood comments.
- Reads are bounded to 100 entries/page and 10 pages/collection, with Link/header,
  count and truncation checks. Unsupported cursors or incomplete GraphQL pages
  fail closed. Each invocation has a 240-second network budget, at most 1,200
  subprocess calls, 30 seconds/call and 16 MiB output/call. Rate-limit/auth/schema
  failures result in no planned mutation. Restore access and let the next pass
  retry reads; do not reset the ledger to work around missing metadata.

**Stop:** disable `Cammelot-AutonomousBacklog`, let the current pass finish, and
confirm it is no longer running. To stop urgently, stop that specific scheduled
task; preserve `state.json` and any in-flight journal. No automatic stale-lock
stealing occurs. Inspect `dispatcher.lock/owner.json` and the exact PID/process
start time; only remove that lock directory after verifying no owner is running.
A crash before owner metadata is written requires the same manual verification.

**Resume a parked issue after a real fix:** with the scheduler stopped and no lock
owner, back up the state. In `state.issues["N"]`, set `parked=false`, clear
`needsPark`/`visibilityUncertain`, and set `resumeAfter` to a current UTC ISO
timestamp. This deliberately supersedes older remote parking markers.
Keep `repairs`, fingerprints, evidence requests and review/update/follow-up/validation-rerun reservations; new commits naturally
invalidate old head-specific gates. Do not erase `inFlight`: first run a dry-run
to inspect reconciliation, then an apply pass to checkpoint it. Re-enable the
scheduler only after reviewing that plan. Genuine unavailable human/device
criteria still park again; clearing state is not evidence.

**Reset/disaster recovery:** restore a known ledger backup, not an empty file.
Remote comments recover repair fingerprints/evidence requests/parking, but cannot perfectly
reconstruct review/update requests after lost local state. Deleting the ledger
can lose those reservations; it is not a supported routine reset. Review expired
reservations manually before deliberately clearing one. Never reset the repair
budget merely to drain the queue.

All tests are fixture-based and offline: no GitHub writes, production leaderboard
access, package installation, scheduler operation, or real cloud agent launch.
