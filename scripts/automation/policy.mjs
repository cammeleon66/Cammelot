// Pure policy: no clock, filesystem, network, or issue-body execution.
export const REPO = 'cammeleon66/Cammelot';
export const BASE = 'master';
export const WORKFLOW = '.github/workflows/minister-backlog-checks.yml';
export const REVIEWER = 'copilot-pull-request-reviewer[bot]';
export const CODER = 'copilot-swe-agent[bot]';
export const ISSUES = Object.freeze(Array.from({ length: 21 }, (_, i) => i + 1));
export const MAX_ACTIVE = 3;
export const MAX_REPAIRS = 3;
export const MAX_VALIDATION_RERUNS = 3;
export const validationKey = a => `${a.head}:${a.runId}:${a.runAttempt}`;
export const WAIT_MS = 24 * 60 * 60 * 1000;
const RUNNING = new Set(['queued', 'in_progress']);
const STOPPED = new Set(['failed', 'idle', 'waiting_for_user', 'timed_out', 'cancelled']);
const SHA = /^[a-f0-9]{40}$/;
export const isSha = value => typeof value === 'string' && SHA.test(value);
export const isCoder = user => user?.type === 'Bot' &&
  (user.node_id === 'BOT_kgDOC9w8XQ' || user.id === 198982749 ||
    user.databaseId === 198982749) &&
  (user.node_id === undefined || user.node_id === 'BOT_kgDOC9w8XQ') &&
  (user.id === undefined || user.id === 198982749) &&
  (user.databaseId === undefined || user.databaseId === 198982749);
export const isCodingRun = run => /^(?:Running Copilot cloud agent\b|Addressing comment on PR #\d+\b)/i.test(run.name ?? '') ||
  /^(?:Running Copilot cloud agent\b|Addressing comment on PR #\d+\b)/i.test(run.display_title ?? '') ||
  /copilot[-_](?:swe|coding)/i.test(run.path ?? '');
// Keep existing repair reservations readable across this ledger-compatible update.
export const pendingWork = e => ({
  head: e.workPendingHead ?? e.repairPendingHead,
  at: e.workPendingAt ?? e.lastRepairAt,
});

function activeWork(snapshot) {
  const work = snapshot.tasks.filter(t => RUNNING.has(t.state));
  // REST task state can lag a follow-up Actions session. Branch-scoped runs,
  // including older SHAs, independently reserve slots and prohibit mutation.
  // Use the larger count per PR, not a double count of mirrored telemetry.
  for (const p of snapshot.prs.filter(p => p.state === 'open')) {
    if (!Array.isArray(p.codingRuns)) throw new Error('Missing branch coding activity metadata');
    const running = p.codingRuns.filter(r => {
      if (!['queued', 'in_progress', 'waiting', 'requested', 'pending', 'completed'].includes(r.status)) throw new Error('Unknown branch run status');
      return r.status !== 'completed';
    });
    const represented = work.filter(t => t.prIds.includes(p.id)).length;
    for (const r of running.slice(represented)) work.push({ id: `actions-${r.id}`, state: 'in_progress', prIds: [p.id] });
  }
  return work;
}
export const lanes = n => n === 1 ? ['contract'] : n === 17 ? ['research'] :
  n === 9 ? ['ci'] : n === 15 ? ['minister', 'leaderboard'] :
    n === 21 ? ['minister', 'research'] : ['minister'];

export function fileAllowed(n, path) {
  if (!ISSUES.includes(n)) return false;
  if (typeof path !== 'string' || path.includes('..') || path.includes('\\')) return false;
  if (/^(scripts\/automation\/|tests\/automation_|docs\/AUTONOMOUS_BACKLOG|\.github\/agents\/)/.test(path)) return false;
  if (n === 1) return path === 'README.md' ||
    /^docs\/(?:MINISTER_[A-Z_]*CONTRACT[A-Z_]*\.md|MINISTER_REFERENCE_PROTOCOL\.md|adr\/minister-[\w-]+\.md)$/.test(path);
  if (n === 17) return /^(?:docs\/research\/[\w./-]+\.md|docs\/RESEARCH_[A-Z0-9_]+\.md|00_Project_Strategy\/research\/[\w./-]+\.md)$/.test(path);
  if (n === 9) return /^\.github\/workflows\/[\w-]+\.ya?ml$/.test(path) ||
    /^(?:Dockerfile(?:\.leaderboard)?|docker-compose\.yml|nginx\.conf|docs\/DEPLOYMENT[\w-]*\.md|tests\/deployment[\w.-]*\.(?:js|mjs))$/.test(path);
  if (n === 15 && /^(?:src\/leaderboard\/[\w./-]+|tests\/leaderboard\.test\.js|docs\/COMMUNITY_LEADERBOARD\.md)$/.test(path)) return true;
  if (n === 21 && /^(?:src\/research_monitor\/[\w./-]+|scripts\/(?:research|experiment)[\w.-]*\.(?:js|mjs|cjs)|docs\/research\/[\w./-]+\.md)$/.test(path)) return true;
  return path === 'site/minister.html' ||
    /^(?:src\/minister\/[\w./-]+|config\/minister[\w./-]*\.json|tests\/minister[\w.-]*\.(?:js|mjs|cjs)|scripts\/[\w-]*minister[\w.-]*\.(?:js|mjs|cjs))$/.test(path) ||
    (/^docs\/MINISTER_[A-Z_]+\.md$/.test(path) && !/CONTRACT|REFERENCE_PROTOCOL/.test(path));
}

// Only controlled closing keywords are interpreted, never arbitrary "#123" text.
// Cross-repository closing links are retained as invalid, rather than ignored.
export function closingRefs(body, graphRefs = []) {
  const refs = [...graphRefs];
  const re = /\b(?:fix(?:es|ed)?|clos(?:e[sd]?|ing)|resolv(?:e[sd]?|ing))\s+(?:(https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/(\d+))|(?:([\w.-]+\/[\w.-]+))?#(\d+))/gi;
  const text = String(body ?? '').replace(/```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)/g, '');
  for (const line of text.split(/\r?\n/)) {
    const matches = [...line.matchAll(re)];
    if (!matches.length) continue;
    // A controlled standalone closing line only. "Fixes #1, #2" must never
    // silently become a one-issue PR because only the first keyword matched.
    const controlledLine = line.trim().replace(/^[-*+]\s+/, '').replace(/\.$/, '');
    if (matches.length !== 1 || controlledLine !== matches[0][0]) {
      refs.push({ repo: 'ambiguous/closing-clause', number: 0 });
    }
    for (const m of matches) refs.push({ repo: m[2] || m[4] || REPO, number: Number(m[3] || m[5]) });
  }
  return [...new Map(refs.map(r => [`${r.repo.toLowerCase()}#${r.number}`, r])).values()];
}

export function associatedIssue(pr) {
  const refs = closingRefs(pr.body, pr.closingRefs);
  return refs.length === 1 && refs[0].repo.toLowerCase() === REPO.toLowerCase() &&
    ISSUES.includes(refs[0].number) ? refs[0].number : null;
}

export function scopeProblem(pr, n, { checkFiles = true } = {}) {
  if (associatedIssue(pr) !== n) return 'ambiguous or foreign closing references';
  if (pr.base?.ref !== BASE || pr.base?.repo?.full_name?.toLowerCase() !== REPO.toLowerCase()) return 'wrong base';
  if (pr.head?.repo?.full_name?.toLowerCase() !== REPO.toLowerCase()) return 'wrong head repository';
  if (!isCoder(pr.user)) return 'wrong PR author';
  if (!isSha(pr.head?.sha)) return 'missing head SHA';
  if (!checkFiles) return null;
  if (!Array.isArray(pr.files) || pr.files.length === 0) return 'missing changed files';
  if (pr.files.some(f => !fileAllowed(n, f.filename) || (f.previous_filename && !fileAllowed(n, f.previous_filename)))) return 'unauthorized file scope';
  return null;
}

export function reviewGate(pr) {
  if (!Array.isArray(pr.reviews) || !Array.isArray(pr.reviewComments) || !Array.isArray(pr.threads)) {
    return { ok: false, reason: 'missing review metadata', repair: false };
  }
  if (pr.threads.some(t => t.isResolved !== true)) return { ok: false, reason: 'unresolved review threads', repair: true };
  const latestByUser = new Map();
  for (const r of [...pr.reviews].sort((a, b) => a.id - b.id)) {
    if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state)) latestByUser.set(r.user?.login, r);
  }
  if ([...latestByUser.values()].some(r => r.state === 'CHANGES_REQUESTED')) {
    return { ok: false, reason: 'changes requested', repair: true };
  }
  const reviews = pr.reviews.filter(r => r.user?.login === REVIEWER && r.user?.type === 'Bot' &&
    r.commit_id === pr.head.sha && r.state !== 'PENDING').sort((a, b) => b.id - a.id);
  const r = reviews[0];
  if (!r) return { ok: false, reason: 'missing current-head independent review', request: true };
  if (pr.reviewComments.some(c => c.pull_request_review_id === r.id)) {
    return { ok: false, reason: `independent review ${r.id} contains findings`, repair: true };
  }
  // Intentionally narrow: only explicit approval formats are recognized.
  // No substring "approve" matching: negation and quoted assessments must not pass.
  const assessment = String(r.body ?? '').trim().replace(/\r\n/g, '\n');
  // Observed ccr-overview-v2: historical resolved findings live in <details>.
  // They are not current open findings. The first overview must explicitly
  // recommend approval AND explicitly report zero open issues.
  const overview = assessment.split(/^<details\b/m)[0];
  const ccrPositive = /^<!-- ccr-overview-v2 -->\s*\n### 🟢 Approval recommended\s*\n/.test(overview) &&
    /^\*\*No open issues\*\*(?: 🎉)?\s*$/m.test(overview) &&
    !/\b[1-9]\d*\s+open issues?\b/i.test(overview) &&
    !/^### [🟡🔴]/mu.test(overview);
  const positive = r.state === 'APPROVED' ||
    (r.state === 'COMMENTED' && (ccrPositive ||
      /^(?:## (?:Approval assessment|Assessment)\n)?(?:Approval assessment: )?(?:Approved|No actionable findings)\.?(?:\nNo actionable findings\.?)?$/i.test(assessment)));
  return positive ? { ok: true, reviewId: r.id } :
    { ok: false, reason: `unknown or negative review assessment (${r.id})`, repair: true };
}

export function ciGate(pr) {
  const head = pr.head.sha;
  if (!Array.isArray(pr.runs) || !Array.isArray(pr.checks) || !Array.isArray(pr.statuses)) {
    return { ok: false, reason: 'missing CI metadata' };
  }
  const runs = pr.runs.filter(r => r.path === WORKFLOW && r.name === 'Minister backlog checks' &&
    r.head_sha === head && r.head_branch === pr.head.ref &&
    r.head_repository?.full_name?.toLowerCase() === REPO.toLowerCase() &&
    ['pull_request', 'workflow_dispatch'].includes(r.event)).sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt);
  const run = runs[0];
  if (!run) return { ok: false, reason: 'missing trusted current-head CI' };
  if (new Set(runs.map(r => r.workflow_id)).size !== 1 || !Number.isSafeInteger(run.workflow_id)) {
    return { ok: false, reason: 'ambiguous trusted workflow identity' };
  }
  if (run.status !== 'completed') return { ok: false, reason: 'trusted CI pending', infrastructurePending: true };
  if (run.conclusion === 'action_required') return {
    ok: false, reason: `trusted CI run ${run.id} action_required`, infrastructureHold: true, run,
  };
  if (run.conclusion !== 'success') return { ok: false, reason: `trusted CI ${run.conclusion}`, repair: true };
  if (run.validateJob !== true) return { ok: false, reason: 'missing successful current-head Validate job', repair: true };
  if (!pr.checks.length) return { ok: false, reason: 'missing check runs' };
  const latestChecks = new Map();
  for (const c of [...pr.checks].sort((a, b) => a.id - b.id)) {
    if (c.head_sha !== head || !Number.isSafeInteger(c.id) || !Number.isSafeInteger(c.app?.id) || !c.name ||
      (c.app.slug === 'github-actions' && !Number.isSafeInteger(c.workflowId))) {
      return { ok: false, reason: 'stale or ambiguous check identity' };
    }
    // A rerun supersedes only its own app/workflow/job, never another app or
    // another workflow which happens to use the same job name.
    latestChecks.set(`${c.app.id}:${c.workflowId ?? 'external'}:${c.name}`, c);
  }
  if ([...latestChecks.values()].some(c => c.status !== 'completed')) return { ok: false, reason: 'pending checks' };
  if ([...latestChecks.values()].some(c => c.conclusion !== 'success')) return { ok: false, reason: 'unsuccessful check run', repair: true };
  const latest = new Map();
  for (const s of [...pr.statuses].sort((a, b) => a.id - b.id)) latest.set(s.context, s);
  if ([...latest.values()].some(s => s.sha !== head || s.state !== 'success')) {
    return { ok: false, reason: 'pending or failing commit status', repair: [...latest.values()].some(s => ['error', 'failure'].includes(s.state)) };
  }
  return { ok: true, runId: run.id };
}

export function validationRerunGate(pr, n, baseSha) {
  const problem = scopeProblem(pr, n);
  if (problem) return { ok: false, reason: problem };
  if (pr.state !== 'open' || pr.draft || pr.baseChecked !== baseSha || pr.includesBase !== true ||
    !Array.isArray(pr.codingRuns) || pr.codingRuns.some(r => r.status !== 'completed')) {
    return { ok: false, reason: 'validation rerun requires a current, idle, ready PR' };
  }
  const ci = ciGate(pr), run = ci.run;
  if (!ci.infrastructureHold || !run || run.event !== 'pull_request' ||
    !Number.isSafeInteger(run.id) || run.id < 1 ||
    !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1 ||
    !Array.isArray(run.pull_requests) || run.pull_requests.length !== 1 ||
    run.pull_requests[0].number !== pr.number || run.pull_requests[0].head?.sha !== pr.head.sha) {
    return { ok: false, reason: 'unverified current-head validation run/PR association' };
  }
  const definition = pr.workflowDefinition;
  if (definition?.baseCommit !== baseSha || definition?.headCommit !== pr.head.sha ||
    !isSha(definition.baseBlob) || definition.baseBlob !== definition.headBlob) {
    return { ok: false, reason: 'trusted CI definition differs from master or lacks immutable blob verification' };
  }
  return { ok: true, runId: run.id, runAttempt: run.run_attempt, workflowId: run.workflow_id,
    baseBlob: definition.baseBlob, headBlob: definition.headBlob };
}

export function acceptanceGate(pr, n) {
  if (n === 16) return { ok: false, reason: 'issue 16 requires genuine human/real-device evidence; never fabricate it', park: true };
  for (const c of pr.comments ?? []) {
    if (!isCoder(c.user)) continue;
    const matches = String(c.body).matchAll(/<!-- backlog-evidence ([^\r\n]+) -->/g);
    for (const m of matches) {
      try {
        const e = JSON.parse(m[1]);
        if (e.issue === n && e.head === pr.head.sha && e.humanValidation === 'not-required' &&
          Array.isArray(e.limitations) && e.limitations.every(x => typeof x === 'string') &&
          (e.blockingGaps === undefined ? e.limitations.length === 0 :
            Array.isArray(e.blockingGaps) && e.blockingGaps.length === 0) &&
          Array.isArray(e.criteria) && e.criteria.length > 0 && e.criteria.every(x =>
            typeof x.criterion === 'string' && x.criterion.trim() && typeof x.evidence === 'string' && x.evidence.trim()) &&
          Array.isArray(e.tests) && e.tests.length > 0 && e.tests.every(x => typeof x === 'string' && x.trim())) return { ok: true };
      } catch { /* Untrusted evidence is data; malformed claims cannot pass. */ }
    }
  }
  return { ok: false, reason: 'missing current-head acceptance evidence (backlog-evidence comment)', evidence: true };
}

export function mergeGate(pr, n, baseSha, { merged = false } = {}) {
  const scope = scopeProblem(pr, n);
  if (scope) return { ok: false, reason: scope, park: true };
  if (!Array.isArray(pr.codingRuns) || pr.codingRuns.some(r => r.status !== 'completed')) {
    return { ok: false, reason: 'missing or active branch coding activity' };
  }
  for (const gate of [acceptanceGate(pr, n), ciGate(pr), reviewGate(pr)]) if (!gate.ok) return gate;
  if (merged) return pr.merged === true && pr.mergeInBase === true ?
    { ok: true } : { ok: false, reason: 'missing verified merge ancestry' };
  if (pr.state !== 'open') return { ok: false, reason: 'PR not open', park: true };
  if (pr.baseChecked !== baseSha || pr.includesBase !== true) return { ok: false, reason: 'latest base not included', update: true };
  if (pr.mergeable !== true || !['clean', 'has_hooks'].includes(pr.mergeable_state)) {
    return { ok: false, reason: 'PR not mergeable', repair: pr.mergeable === false };
  }
  return { ok: true };
}

export function completed(issue, prs) {
  return issue?.state === 'closed' && issue.state_reason === 'completed' &&
    prs.some(p => associatedIssue(p) === issue.number && p.merged === true && p.mergeInBase === true && !scopeProblem(p, issue.number));
}

function commentsFor(snapshot, n) {
  return [...(snapshot.issues.find(i => i.number === n)?.comments ?? []),
    ...snapshot.prs.filter(p => associatedIssue(p) === n).flatMap(p => p.comments ?? [])];
}

export function issueLedger(snapshot, state, n) {
  const entry = state.issues[n] ?? {};
  const comments = commentsFor(snapshot, n).filter(c => c.user?.login === snapshot.viewer);
  const markers = comments.flatMap(c => [...String(c.body).matchAll(/<!-- backlog-dispatcher ([^\r\n]+) -->/g)].flatMap(m => {
    try { return [{ ...JSON.parse(m[1]), createdAt: c.created_at }]; } catch { return []; }
  })).filter(m => m.issue === n);
  return {
    ...entry,
    repairs: Math.max(entry.repairs ?? 0, new Set(markers.filter(m => m.kind === 'repair').map(m => m.id)).size),
    fingerprints: [...new Set([...(entry.fingerprints ?? []), ...markers.filter(m => m.kind === 'repair').map(m => m.reasonKey)])],
    evidenceRequests: {
      ...Object.fromEntries(markers.filter(m => m.kind === 'evidence' && isSha(m.head)).map(m => [m.head, m.createdAt])),
      ...(entry.evidenceRequests ?? {}),
    },
    lastRepairAt: entry.lastRepairAt ?? markers.filter(m => m.kind === 'repair').map(m => m.createdAt).sort().at(-1),
    parked: entry.parked || markers.some(m => m.kind === 'park' && (!entry.resumeAfter || m.createdAt > entry.resumeAfter)),
  };
}

function canStartFollowup(snapshot, state, n, now) {
  const { activeTasks: active, slots, unknownActive, pendingAssignments } = resources(snapshot, state, now);
  const activeIssues = active.map(t => associatedIssue(snapshot.prs.find(p => t.prIds.includes(p.id)) ?? {}));
  const pending = Object.entries(state.issues).filter(([number, item]) =>
    pendingWork(item).head && now - Date.parse(pendingWork(item).at) < WAIT_MS &&
    snapshot.prs.some(p => associatedIssue(p) === Number(number) && p.state === 'open' && p.head.sha === pendingWork(item).head) &&
    !activeIssues.includes(Number(number))).map(([number]) => Number(number));
  if (unknownActive || slots > MAX_ACTIVE || pending.includes(n) || active.length + pending.length >= MAX_ACTIVE ||
    pendingAssignments.some(other => other !== n && lanes(other).some(l => lanes(n).includes(l))) ||
    activeIssues.some(other => !other || (other !== n && lanes(other).some(l => lanes(n).includes(l)))) ||
    pending.some(other => other !== n && lanes(other).some(l => lanes(n).includes(l)))) return false;
  return true;
}

export function repairOrPark(snapshot, state, pr, n, reason, now) {
  const e = issueLedger(snapshot, state, n);
  const reasonKey = `${pr?.head?.sha ?? 'no-pr'}:${reason}`;
  if (e.fingerprints.includes(reasonKey)) {
    // Do not flood stalled tasks. Give one repair time, then visibly park.
    return now - Date.parse(e.lastRepairAt ?? new Date(now).toISOString()) >= WAIT_MS ?
      { kind: 'park', issue: n, pr: pr?.number, reason: `repair did not progress: ${reason}` } : null;
  }
  if (!pr || e.repairs >= MAX_REPAIRS) return { kind: 'park', issue: n, pr: pr?.number, reason: `repair budget unavailable/exhausted: ${reason}` };
  if (!canStartFollowup(snapshot, state, n, now)) return null;
  return { kind: 'repair', issue: n, pr: pr.number, head: pr.head.sha, reason, reasonKey, attempt: e.repairs + 1 };
}

const priority = i => i.labels?.some(l => /^(?:priority:)?P0\b/i.test(l.name)) ? 0 :
  i.labels?.some(l => /^(?:priority:)?P1\b/i.test(l.name)) ? 1 : 2;
const sortIssues = (a, b) => priority(a) - priority(b) ||
  String(a.milestone?.due_on ?? '9999').localeCompare(String(b.milestone?.due_on ?? '9999')) ||
  (a.milestone?.number ?? 9999) - (b.milestone?.number ?? 9999) || a.number - b.number;

function resources(snapshot, state, now) {
  const activeTasks = activeWork(snapshot);
  if (snapshot.tasks.some(t => ![...RUNNING, ...STOPPED, 'completed'].includes(t.state))) throw new Error('Unknown task state');
  const openPrs = snapshot.prs.filter(p => p.state === 'open');
  const reservedPrs = openPrs.filter(p => {
    const n = associatedIssue(p);
    return !n || !issueLedger(snapshot, state, n).parked;
  });
  const busyIssues = new Set(reservedPrs.map(associatedIssue).filter(Boolean));
  const occupied = new Set();
  let unknownActive = false;
  for (const t of activeTasks) {
    const p = snapshot.prs.find(p => t.prIds.includes(p.id));
    const n = p && associatedIssue(p);
    if (!n) unknownActive = true;
    else { busyIssues.add(n); lanes(n).forEach(l => occupied.add(l)); }
  }
  // Unrelated open coding-agent PRs also consume capacity and all lanes.
  if (openPrs.some(p => isCoder(p.user) && !associatedIssue(p))) unknownActive = true;
  for (const n of busyIssues) lanes(n).forEach(l => occupied.add(l));
  for (const issue of snapshot.issues) {
    const n = issue.number, e = issueLedger(snapshot, state, n);
    if (e.dispatchedAt && !e.parked && !snapshot.prs.some(p => associatedIssue(p) === n)) {
      busyIssues.add(n); lanes(n).forEach(l => occupied.add(l));
    }
    if (!e.parked && issue.assignees?.some(isCoder) && issue.state === 'open') {
      busyIssues.add(n); lanes(n).forEach(l => occupied.add(l));
    }
    if (pendingWork(e).head && now - Date.parse(pendingWork(e).at) < WAIT_MS &&
      snapshot.prs.some(p => associatedIssue(p) === n && p.state === 'open' && p.head.sha === pendingWork(e).head)) {
      busyIssues.add(n); lanes(n).forEach(l => occupied.add(l));
    }
  }
  // Count individual active sessions, then add only observations not already
  // represented by those sessions. Max(total sessions, total issues) loses a
  // pending assignment when another issue has duplicate active sessions.
  const activePrIds = new Set(activeTasks.flatMap(t => t.prIds));
  const unrepresentedPrs = reservedPrs.filter(p => (isCoder(p.user) || associatedIssue(p)) && !activePrIds.has(p.id));
  const representedIssues = new Set([...snapshot.prs.filter(p => activePrIds.has(p.id)), ...unrepresentedPrs]
    .map(associatedIssue).filter(Boolean));
  const pendingAssignments = [...busyIssues].filter(n => !representedIssues.has(n));
  const slots = activeTasks.length + unrepresentedPrs.length + pendingAssignments.length;
  return { activeTasks, busyIssues, occupied, unknownActive, slots, pendingAssignments };
}

export function plan(snapshot, state, now) {
  if (!isSha(snapshot.baseSha) || !snapshot.viewer || snapshot.issues.length !== 21 ||
    ISSUES.some(n => snapshot.issues.filter(i => i.number === n).length !== 1) ||
    snapshot.issues.some(i => !Array.isArray(i.blockers))) throw new Error('Incomplete authoritative snapshot');
  const actions = [], holds = [];
  const resource = resources(snapshot, state, now);
  const { activeTasks, busyIssues, occupied, unknownActive } = resource;
  let slots = resource.slots;
  for (const issue of [...snapshot.issues].sort(sortIssues)) {
    const n = issue.number, e = issueLedger(snapshot, state, n);
    if (e.parked) { holds.push({ issue: n, reason: 'parked' }); continue; }
    const prs = snapshot.prs.filter(p => associatedIssue(p) === n);
    const opens = prs.filter(p => p.state === 'open');
    const merged = prs.filter(p => p.merged === true && p.mergeInBase === true);
    if (completed(issue, snapshot.prs)) continue;
    if (issue.state !== 'open') {
      holds.push({ issue: n, reason: 'closed without completed + merged evidence' }); continue;
    }
    if (opens.length > 1 || activeTasks.filter(t => t.prIds.some(id => opens.some(p => p.id === id))).length > 1) {
      actions.push({ kind: 'park', issue: n, reason: 'duplicate implementation PRs or active sessions' }); continue;
    }
    if (merged.length) {
      const p = merged.at(-1), gate = mergeGate(p, n, snapshot.baseSha, { merged: true });
      if (gate.ok) actions.push({ kind: 'close', issue: n, pr: p.number, head: p.head.sha });
      else actions.push({ kind: 'park', issue: n, pr: p.number, reason: `merged but acceptance incomplete: ${gate.reason}` });
      continue;
    }
    const p = opens[0];
    if (p) {
      const seenAt = e.observedHead === p.head.sha ? e.headSeenAt : p.updated_at;
      const problem = scopeProblem(p, n, { checkFiles: false });
      if (problem) { actions.push({ kind: 'park', issue: n, pr: p.number, reason: problem }); continue; }
      const tasks = snapshot.tasks.filter(t => t.prIds.includes(p.id));
      if (activeTasks.some(t => t.prIds.includes(p.id))) {
        holds.push({ issue: n, reason: 'coding task/branch action active' });
        if (now - Date.parse(seenAt) >= WAIT_MS) actions.push({ kind: 'park', issue: n, pr: p.number, reason: 'coding session exceeded 24h without a new head; running work still reserves capacity' });
        continue;
      }
      if (!tasks.length) {
        holds.push({ issue: n, reason: 'missing task association' });
        if (now - Date.parse(seenAt) >= WAIT_MS) actions.push({ kind: 'park', issue: n, pr: p.number, reason: 'missing task association after 24h' });
        continue;
      }
      if (pendingWork(e).head === p.head.sha) {
        if (now - Date.parse(pendingWork(e).at) >= WAIT_MS) actions.push({ kind: 'park', issue: n, pr: p.number, reason: 'follow-up execution not confirmed after 24h' });
        else holds.push({ issue: n, reason: 'awaiting follow-up execution confirmation' });
        continue;
      }
      // Aggregate ANY active task above. For terminal histories, use explicit
      // creation timestamps, never array order or branch-artifact base_ref.
      let task = tasks[0];
      if (tasks.length > 1 && new Set(tasks.map(t => t.state)).size > 1) {
        const ordered = [...tasks].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        if (tasks.some(t => !Number.isFinite(Date.parse(t.created_at))) ||
          new Set(ordered.filter(t => Date.parse(t.created_at) === Date.parse(ordered[0].created_at)).map(t => t.state)).size > 1) {
          actions.push({ kind: 'park', issue: n, pr: p.number, reason: 'ambiguous conflicting task histories' }); continue;
        }
        task = ordered[0];
      }
      if (STOPPED.has(task.state)) {
        const action = repairOrPark(snapshot, state, p, n, `task ${task.id} ${task.state}`, now);
        if (action) actions.push(action);
        continue;
      }
      // Bring the branch current before asking for source-head evidence or review.
      // A merge/update invalidates both; never repeatedly request the same update.
      if (p.includesBase === false) {
        const updateKey = `${p.head.sha}:${snapshot.baseSha}`;
        const requested = e.updates?.[updateKey];
        if (!requested) actions.push({ kind: 'update', issue: n, pr: p.number, head: p.head.sha, base: snapshot.baseSha });
        else if (now - Date.parse(requested) >= WAIT_MS) actions.push({ kind: 'park', issue: n, pr: p.number, reason: 'branch update timed out' });
        else holds.push({ issue: n, reason: 'branch update already requested' });
        continue;
      }
      // A behind PR's merge-base diff can still list bootstrap files now present
      // on master. Reconcile the base first, never expand issue file permissions.
      const fileProblem = scopeProblem(p, n);
      if (fileProblem) { actions.push({ kind: 'park', issue: n, pr: p.number, reason: fileProblem }); continue; }
      // ready_for_review can enqueue/cancel same-head checks. This is always a
      // separate pass, before review/CI readiness, never a prelude to same-run merge.
      if (p.draft) {
        actions.push({ kind: 'ready', issue: n, pr: p.number, head: p.head.sha, base: snapshot.baseSha });
        continue;
      }
      // Authorize only the already-inspected, unchanged trusted validation
      // definition. This runs before acceptance evidence, so unavailable CI
      // cannot deadlock an agent's honest final evidence handoff.
      if (ciGate(p).infrastructureHold) {
        const authorization = validationRerunGate(p, n, snapshot.baseSha);
        if (!authorization.ok) {
          holds.push({ issue: n, reason: authorization.reason });
          if (now - Date.parse(seenAt) >= WAIT_MS) actions.push({ kind: 'park', issue: n, pr: p.number,
            reason: `validation authorization held for 24h: ${authorization.reason}` });
          continue;
        }
        const { ok, ...identity } = authorization;
        const action = { kind: 'rerun-validation', issue: n, pr: p.number, head: p.head.sha, base: snapshot.baseSha, ...identity };
        const requests = e.validationReruns ?? {}, requested = requests[validationKey(action)];
        if (requested) {
          holds.push({ issue: n, reason: 'validation rerun already requested for this run/head/attempt' });
          if (now - Date.parse(requested) >= WAIT_MS) actions.push({ kind: 'park', issue: n, pr: p.number, reason: 'validation rerun did not progress within 24h' });
        } else if (Object.keys(requests).filter(k => k.startsWith(`${p.head.sha}:`)).length >= MAX_VALIDATION_RERUNS) {
          actions.push({ kind: 'park', issue: n, pr: p.number, reason: 'validation rerun budget exhausted for current head' });
        } else actions.push(action);
        continue;
      }
      const gate = mergeGate(p, n, snapshot.baseSha);
      if (gate.ok) {
        const dependenciesDone = issue.blockers.every(b => {
          const full = snapshot.issues.find(i => i.number === b.number && b.repository_url === `https://api.github.com/repos/${REPO}`);
          return full && completed(full, snapshot.prs);
        });
        if (dependenciesDone) actions.push({ kind: 'merge', issue: n, pr: p.number, head: p.head.sha, base: snapshot.baseSha });
        else holds.push({ issue: n, reason: 'dependencies must complete before merge' });
      } else if (gate.park) actions.push({ kind: 'park', issue: n, pr: p.number, reason: gate.reason });
      else if (gate.update) {
        actions.push({ kind: 'update', issue: n, pr: p.number, head: p.head.sha, base: snapshot.baseSha });
      } else if (gate.request) {
        const requested = e.reviews?.[p.head.sha];
        if (!requested && !p.reviewRequested) actions.push({ kind: 'review', issue: n, pr: p.number, head: p.head.sha });
        else if (now - Date.parse(requested ?? seenAt) >= WAIT_MS) actions.push({ kind: 'park', issue: n, pr: p.number, reason: 'independent review timed out' });
      } else if (gate.evidence) {
        const requested = e.evidenceRequests[p.head.sha];
        if (requested) {
          if (now - Date.parse(requested) >= WAIT_MS) actions.push({ kind: 'park', issue: n, pr: p.number, reason: 'current-head acceptance evidence timed out' });
          else holds.push({ issue: n, reason: 'current-head evidence already requested' });
        } else if (canStartFollowup(snapshot, state, n, now)) {
          actions.push({ kind: 'evidence', issue: n, pr: p.number, head: p.head.sha });
        } else holds.push({ issue: n, reason: 'capacity or resource lane busy for evidence request' });
      } else if (gate.infrastructureHold || gate.infrastructurePending) {
        holds.push({ issue: n, reason: gate.reason });
        if (now - Date.parse(seenAt) >= WAIT_MS) actions.push({
          kind: 'park', issue: n, pr: p.number, reason: `validation infrastructure wait exceeded 24h: ${gate.reason}`,
        });
      } else if (gate.repair) {
        const a = repairOrPark(snapshot, state, p, n, gate.reason, now); if (a) actions.push(a);
      } else {
        holds.push({ issue: n, reason: gate.reason });
        if (now - Date.parse(seenAt) >= WAIT_MS) {
          const a = repairOrPark(snapshot, state, p, n, gate.reason, now); if (a) actions.push(a);
        }
      }
      continue;
    }
    if (prs.length) { actions.push({ kind: 'park', issue: n, reason: 'previous implementation closed without verified merge' }); continue; }
    if (busyIssues.has(n)) {
      holds.push({ issue: n, reason: 'assigned/dispatched; waiting for unambiguous PR association' });
      if (now - Date.parse(e.dispatchedAt ?? e.assignedSeenAt ?? issue.updated_at) >= WAIT_MS) actions.push({ kind: 'park', issue: n, reason: 'assignment produced no associated PR within 24h' });
      continue;
    }
    if (!Array.isArray(issue.blockers)) throw new Error(`Missing dependency metadata #${n}`);
    const blockers = issue.blockers.filter(b => {
      const full = snapshot.issues.find(i => i.number === b.number && b.repository_url === `https://api.github.com/repos/${REPO}`);
      return !full || !completed(full, snapshot.prs);
    });
    if (blockers.length) { holds.push({ issue: n, reason: 'dependencies not completed and merged' }); continue; }
    if (unknownActive || slots >= MAX_ACTIVE || lanes(n).some(l => occupied.has(l))) {
      holds.push({ issue: n, reason: 'capacity or resource lane busy' }); continue;
    }
    actions.push({ kind: 'dispatch', issue: n });
    slots++; lanes(n).forEach(l => occupied.add(l));
  }
  // One mutation per invocation, merge last so independent readiness/repairs progress.
  const rank = { close: 0, park: 1, repair: 2, evidence: 2, 'rerun-validation': 2, update: 3, review: 4, ready: 5, merge: 6, dispatch: 7 };
  actions.sort((a, b) => rank[a.kind] - rank[b.kind]);
  return { actions, holds, active: activeTasks.length, reserved: resource.slots, occupied: [...occupied], unknownActive };
}

export function taskPrompt(n) {
  return `Implement ONLY authorized issue #${n} in ${REPO}, based on master (not the default branch).
Use the merged Minister contract as source of truth; document reasonable engineering decisions without routine sign-off.
Preserve evidence honesty: no calibrated/validated clinical claims without evidence, no secrets or settings changes,
no production leaderboard writes, no unrelated issues. Stay within the dispatcher's per-issue file scope.
Keep research docs in docs/research/ (not README); contract docs in docs/MINISTER_*CONTRACT*.md.
Only issue 1 may add a minimal contract-discovery link to README.md; no unrelated README edits.
Run appropriate tests. Do not weaken or skip tests to manufacture green checks.
Do not merge or close the issue; the dispatcher handles independent review and current-head CI.
For issue 16, unavailable human/real-device validation is an evidence gap, never fabricated success.
When finished, post a PR comment with actual current source head SHA and this single-line JSON marker:
<!-- backlog-evidence {"issue":${n},"head":"40-character current SHA","criteria":[{"criterion":"each issue acceptance criterion","evidence":"concrete test/result or file evidence"}],"tests":["actual command and result"],"humanValidation":"not-required","limitations":[],"blockingGaps":[]} -->
List EVERY acceptance criterion honestly. Keep nonblocking scientific/clinical caveats in limitations; put EVERY unmet acceptance criterion, unavailable required validation, or unfinished work in blockingGaps. Only declare blockingGaps empty when all issue acceptance criteria are genuinely met. Do not erase caveats or manufacture evidence to claim completion.
Request no routine human approvals. Independent review must verify issue scope, all acceptance evidence, tests and honesty.
Use exactly one same-repository closing reference: Fixes #${n}.`;
}
