import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  REPO, WORKFLOW, REVIEWER, CODER, ISSUES, WAIT_MS, lanes, closingRefs, associatedIssue,
  fileAllowed, scopeProblem, reviewGate, ciGate, acceptanceGate, mergeGate, completed,
  plan, issueLedger, repairOrPark, taskPrompt,
  isCoder,
} from '../scripts/automation/policy.mjs';
import { GitHub } from '../scripts/automation/github.mjs';
import { emptyState, checkpoint, loadState, acquireLock, runOnce, reconcile, observe, parseArgs } from '../scripts/automation/dispatcher.mjs';

const NOW = Date.parse('2026-10-22T12:00:00Z');
const stamp = new Date(NOW).toISOString();
const HEAD = 'a'.repeat(40), BASE = 'b'.repeat(40), OTHER = 'c'.repeat(40);
const coder = { login: CODER, type: 'Bot', node_id: 'BOT_kgDOC9w8XQ' };
const reviewer = { login: REVIEWER, type: 'Bot' };
const blocker = number => ({ number, repository_url: `https://api.github.com/repos/${REPO}` });
const clone = value => structuredClone(value);
const quiet = () => {};

test('live REST Copilot identities and bulleted closing references associate PR22/23/24', () => {
  const s = snapshot();
  for (const [n, number, id] of [[1, 22, 4964900434], [17, 23, 4965024347], [3, 24, 4965024528]]) {
    const p = pull(n, { number, id, body: `Implementation complete\n\n- Fixes #${n}`,
      user: { login: 'Copilot', type: 'Bot', node_id: 'BOT_kgDOC9w8XQ', id: 198982749 } });
    s.prs.push(p);
    s.tasks.push({ id: `task-${n}`, state: 'in_progress', prIds: [id] });
    s.issues[n - 1].assignees = [p.user];
    assert.equal(associatedIssue(p), n);
    assert.equal(isCoder(p.user), true);
  }
  const result = plan(s, emptyState(), NOW);
  assert.equal(result.unknownActive, false);
  assert.equal(result.active, 3);
  assert.ok(!result.holds.some(h => h.reason.includes('unambiguous PR association')));
});

test('verified bot database identity normalizes without trusting arbitrary Copilot login', () => {
  assert.equal(isCoder({ login: 'Copilot', type: 'Bot', id: 198982749 }), true);
  assert.equal(isCoder({ login: 'Copilot', type: 'Bot', databaseId: 198982749 }), true);
  assert.equal(isCoder({ login: 'Copilot', type: 'Bot', id: 123 }), false);
  assert.equal(isCoder({ login: CODER, type: 'Bot', id: 123 }), false);
  assert.equal(isCoder({ login: CODER, type: 'Bot' }), false);
  assert.equal(isCoder({ login: 'Copilot', type: 'Bot', node_id: 'BOT_kgDOC9w8XQ', id: 123 }), false);
  assert.equal(isCoder({ login: 'Copilot', type: 'User', id: 198982749 }), false);
  assert.equal(isCoder({ login: 'other', type: 'Bot', id: 123 }), false);
});

test('live priority:P0/P1/P2 labels precede milestone and issue number', () => {
  const s = snapshot([1, 9, 17]);
  s.issues[0].labels = [{ name: 'priority:P2' }];
  s.issues[8].labels = [{ name: 'priority:P1' }];
  s.issues[16].labels = [{ name: 'priority:P0' }];
  assert.deepEqual(actions(s).map(a => a.issue), [17, 9, 1]);
});

test('contract discovery README is allowed only for issue1', () => {
  const p = pull(1); p.files.push({ filename: 'README.md' });
  assert.equal(scopeProblem(p, 1), null);
  for (const n of ISSUES.filter(n => n !== 1)) assert.equal(fileAllowed(n, 'README.md'), false);
});

test('administrative evidence requests do not consume exhausted code repair budget', () => {
  const s = withPr(), state = emptyState();
  s.prs[0].comments = [];
  state.issues[1] = { repairs: 3 };
  assert.equal(forIssue(s, 1, state)[0].kind, 'evidence');
  state.issues[1].evidenceRequests = { [HEAD]: stamp };
  assert.equal(forIssue(s, 1, state).length, 0);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
  s.prs[0].head.sha = OTHER; // administrative update to newer master
  assert.equal(forIssue(s, 1, state)[0].kind, 'evidence');
  assert.equal(state.issues[1].repairs, 3);
});

test('evidence requests honor maximum coding concurrency and shared writer lanes', () => {
  const s = withPr(3); s.prs[0].comments = [];
  const p = pull(10); s.prs.push(p);
  s.tasks.push({ id: 'other-writer', state: 'in_progress', prIds: [p.id] });
  assert.equal(forIssue(s, 3).length, 0);
  const docs = withPr(); docs.prs[0].comments = [];
  docs.tasks.push(...[1, 2, 3].map(n => ({ id: `unknown-${n}`, state: 'queued', prIds: [] })));
  assert.equal(forIssue(docs, 1).length, 0);
});

for (const kind of ['evidence', 'repair']) {
  for (const reservation of ['assignment', 'dispatch']) {
    test(`${kind} follow-up respects another issue's pending ${reservation} lane`, () => {
      const s = withPr(3), state = emptyState();
      if (kind === 'evidence') s.prs[0].comments = [];
      else s.prs[0].checks[0].conclusion = 'failure';
      if (reservation === 'assignment') s.issues[9].assignees = [coder];
      else state.issues[10] = { dispatchedAt: stamp };

      const result = plan(s, state, NOW);
      assert.equal(result.reserved, 2); // Capacity is available; the Minister lane is not.
      assert.ok(!result.actions.some(a => a.issue === 3 && a.kind === kind));

      // Moving the reservation to an independent lane must not stall this work.
      s.issues[9].assignees = [];
      delete state.issues[10];
      if (reservation === 'assignment') s.issues[16].assignees = [coder];
      else state.issues[17] = { dispatchedAt: stamp };
      assert.ok(forIssue(s, 3, state).some(a => a.kind === kind));
    });
  }
}

test('evidence request journals its own dedupe reservation without incrementing repairs', async t => {
  const dir = await temp(t), s = withPr(), state = emptyState();
  s.prs[0].comments = [];
  state.issues[1] = { repairs: 3, lastRepairAt: '2026-10-20T00:00:00Z' };
  await checkpoint(dir, state);
  const api = fake(s);
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  const saved = await loadState(dir);
  assert.equal(api.calls[0].kind, 'evidence');
  assert.equal(saved.issues[1].repairs, 3);
  assert.equal(saved.issues[1].lastRepairAt, '2026-10-20T00:00:00Z');
  assert.equal(saved.issues[1].evidenceRequests[HEAD], stamp);
});

test('remote evidence marker recovers per-head dedupe but never a code repair attempt', () => {
  const s = withPr(); s.prs[0].comments = [{
    id: 900, user: { login: 'operator' }, created_at: stamp,
    body: `<!-- backlog-dispatcher ${JSON.stringify({ id: 'attestation', kind: 'evidence', issue: 1, head: HEAD })} -->`,
  }];
  const state = emptyState(), ledger = issueLedger(s, state, 1);
  assert.equal(ledger.repairs, 0);
  assert.equal(ledger.evidenceRequests[HEAD], stamp);
  assert.equal(forIssue(s, 1, state).length, 0);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
});

test('pending evidence occupies a coding slot before the remote task becomes visible', () => {
  const s = withPr(17), state = emptyState();
  s.prs[0].comments = [];
  for (const n of [1, 3, 9]) {
    const p = pull(n); s.prs.push(p);
    s.tasks.push({ id: `task-${n}`, prIds: [p.id], state: n === 1 ? 'completed' : 'in_progress' });
  }
  state.issues[1] = { workPendingHead: HEAD, workPendingAt: stamp, evidenceRequests: { [HEAD]: stamp } };
  assert.equal(forIssue(s, 17, state).length, 0);
  delete state.issues[1];
  s.prs = s.prs.filter(p => associatedIssue(p) !== 1);
  assert.equal(forIssue(s, 17, state)[0].kind, 'evidence');
});

test('actual year-versioned research protocol is scoped to research17', () => {
  const p = pull(17, { files: [{ filename: 'docs/RESEARCH_PROTOCOL_2027.md' }] });
  assert.equal(scopeProblem(p, 17), null);
  for (const n of ISSUES.filter(n => n !== 17)) assert.equal(fileAllowed(n, p.files[0].filename), false);
});

test('active clinical PR holds; completed behind PR refreshes base before rejecting workflow delta', () => {
  const s = withPr(3, { includesBase: false });
  s.prs[0].files.push({ filename: WORKFLOW });
  s.tasks[0].state = 'in_progress';
  assert.equal(forIssue(s, 3).length, 0);
  s.tasks[0].state = 'completed';
  assert.equal(forIssue(s, 3)[0].kind, 'update');
  s.prs[0].includesBase = true;
  assert.equal(forIssue(s, 3)[0].kind, 'park'); // genuine remaining workflow change is forbidden
  s.prs[0].files.pop();
  assert.equal(forIssue(s, 3)[0].kind, 'merge');
});
const response = (data, headers = '') => `HTTP/2.0 200 OK\r\nContent-Type: application/json\r\n${headers}\r\n${JSON.stringify(data)}`;

function evidence(n = 1, sha = HEAD) {
  return { id: 701, user: coder, created_at: stamp, updated_at: stamp, body: `<!-- backlog-evidence ${JSON.stringify({
    issue: n, head: sha, criteria: [{ criterion: 'Contract defined', evidence: 'docs/MINISTER_MODEL_CONTRACT.md and test results' }],
    tests: ['node --test: passed'], humanValidation: 'not-required', limitations: [],
  })} -->` };
}

function pull(n = 1, overrides = {}) {
  return {
    id: 1000 + n, number: 21 + n, body: `Implementation\nFixes #${n}`, closingRefs: [],
    state: 'open', merged: false, mergeInBase: false, draft: false, updated_at: stamp,
    user: coder, base: { ref: 'master', repo: { full_name: REPO } },
    head: { sha: HEAD, ref: `copilot/issue-${n}`, repo: { full_name: REPO } },
    files: [{ filename: n === 1 ? 'docs/MINISTER_MODEL_CONTRACT.md' : n === 17 ? 'docs/research/evidence.md' : 'site/minister.html' }],
    reviews: [{ id: 501, user: reviewer, commit_id: HEAD, submitted_at: new Date(NOW + 1000).toISOString(),
      state: 'COMMENTED', body: 'Approval assessment: Approved.\nNo actionable findings.' }],
    reviewComments: [], threads: [], comments: [evidence(n)],
    checks: [{ id: 301, name: 'Validate', head_sha: HEAD, status: 'completed', conclusion: 'success',
      app: { id: 1, slug: 'github-actions' }, check_suite: { id: 11 }, workflowId: 1 }],
    statuses: [],
    runs: [{ id: 401, name: 'Minister backlog checks', path: WORKFLOW, head_sha: HEAD,
      head_branch: `copilot/issue-${n}`, head_repository: { full_name: REPO }, event: 'pull_request',
      pull_requests: [{ number: 21 + n, head: { sha: HEAD } }],
      workflow_id: 1, check_suite_id: 11, run_number: 20, run_attempt: 1, status: 'completed', conclusion: 'success', validateJob: true }],
    workflowDefinition: { baseCommit: BASE, headCommit: HEAD, baseBlob: OTHER, headBlob: OTHER },
    baseChecked: BASE, includesBase: true, mergeable: true, mergeable_state: 'clean',
    reviewRequested: false, codingRuns: [], ...overrides,
  };
}
function snapshot(ready = []) {
  return { viewer: 'operator', baseSha: BASE, tasks: [], prs: [], issues: ISSUES.map(number => ({
    number, state: 'open', state_reason: null, assignees: [], labels: [], milestone: null,
    updated_at: stamp, comments: [], blockers: ready.includes(number) ? [] : [blocker(99)],
  })) };
}
function withPr(n = 1, overrides = {}) {
  const s = snapshot([n]), p = pull(n, overrides);
  s.prs.push(p);
  s.tasks.push({ id: `task-${n}`, state: 'completed', prIds: [p.id], artifacts: [] });
  return s;
}
const actions = (s, state = emptyState(), now = NOW) => plan(s, state, now).actions;
const forIssue = (s, n, state) => actions(s, state).filter(a => a.issue === n);
async function temp(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'backlog-dispatcher-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
function fake(s, overrides = {}) {
  const calls = [];
  return {
    calls, snapshot: async () => clone(s), base: async () => s.baseSha,
    pull: async n => clone(s.prs.find(p => p.number === n)),
    api: async route => {
      assert.match(route, /\/pulls\/\d+$/);
      return clone(s.prs.find(p => route.endsWith(`/${p.number}`)));
    },
    execute: async a => { calls.push(clone(a)); },
    verifyMerge: async () => true,
    ...overrides,
  };
}

function changeEvidence(comment, fields) {
  const data = JSON.parse(comment.body.match(/<!-- backlog-evidence (.*) -->/)[1]);
  comment.body = `<!-- backlog-evidence ${JSON.stringify({ ...data, ...fields })} -->`;
}

test('issue16 accepts its documented release-limitations alternative with honest evidence', () => {
  const s = withPr(16);
  changeEvidence(s.prs[0].comments[0], {
    humanValidation: 'release-limitations',
    releaseEvidence: 'docs/MINISTER_RELEASE_STATUS.md: executable/version and release-readiness summary',
    limitations: ['Uncoached physical-device checks were unavailable; release scope explicitly documents that limitation.'],
    blockingGaps: [],
  });
  assert.equal(acceptanceGate(s.prs[0], 16).ok, true);
  assert.equal(forIssue(s, 16)[0].kind, 'merge');
});

test('issue16 accepts referenced real human checks but not an unsupported completion claim', () => {
  const p = pull(16);
  changeEvidence(p.comments[0], { humanValidation: 'completed',
    releaseEvidence: 'docs/MINISTER_RELEASE_STATUS.md: versioned release evidence',
    humanEvidence: ['Documented uncoached participant/device results in release evidence appendix'], blockingGaps: [] });
  assert.equal(acceptanceGate(p, 16).ok, true);
  changeEvidence(p.comments[0], { humanEvidence: [] });
  assert.equal(acceptanceGate(p, 16).ok, false);
});

test('latest blocking or malformed attestation revokes older current-head success', () => {
  for (const malformed of [false, true]) {
    const p = pull(), correction = evidence();
    correction.id = 702;
    correction.created_at = correction.updated_at = new Date(NOW + 2000).toISOString();
    changeEvidence(correction, { blockingGaps: ['An acceptance criterion is not met'] });
    if (malformed) correction.body = `<!-- backlog-evidence {"issue":1,"head":"${HEAD}","blockingGaps": -->`;
    p.comments.push(correction);
    assert.equal(acceptanceGate(p, 1).ok, false);
    assert.equal(mergeGate(p, 1, BASE).ok, false);
  }
});

test('editing an older attestation makes its blocking correction the latest revision', () => {
  const p = pull(), newer = evidence();
  newer.id = 702;
  newer.created_at = newer.updated_at = new Date(NOW + 2000).toISOString();
  p.comments.push(newer);
  p.comments[0].updated_at = new Date(NOW + 3000).toISOString();
  changeEvidence(p.comments[0], { blockingGaps: ['Corrected finding: incomplete required test'] });
  assert.equal(acceptanceGate(p, 1).ok, false);
});

test('newer malformed routing or missing edit metadata never revives historical success', () => {
  for (const mutation of [
    c => changeEvidence(c, { issue: '1' }),
    c => changeEvidence(c, { head: null }),
    c => { delete c.updated_at; },
  ]) {
    const p = pull(), correction = evidence(); correction.id = 702;
    correction.created_at = correction.updated_at = new Date(NOW + 2000).toISOString();
    mutation(correction); p.comments.push(correction);
    assert.equal(acceptanceGate(p, 1).ok, false);
  }
});

test('untrusted or explicitly other-head attestations cannot replace current trusted evidence', () => {
  const p = pull(), wrongAuthor = evidence();
  wrongAuthor.id = 702; wrongAuthor.user = { login: 'outsider', type: 'User' };
  wrongAuthor.created_at = wrongAuthor.updated_at = new Date(NOW + 2000).toISOString();
  changeEvidence(wrongAuthor, { blockingGaps: ['not a trusted attestation'] });
  const oldHead = evidence(1, OTHER); oldHead.id = 703;
  oldHead.created_at = oldHead.updated_at = new Date(NOW + 3000).toISOString();
  p.comments.push(wrongAuthor, oldHead);
  assert.equal(acceptanceGate(p, 1).ok, true);
  assert.equal(reviewGate(p).ok, true);
});

test('current-head review predating a new or edited attestation cannot authorize merge', () => {
  for (const edited of [false, true]) {
    const s = withPr();
    if (edited) s.prs[0].comments[0].updated_at = new Date(NOW + 2000).toISOString();
    else {
      const latest = evidence(); latest.id = 702;
      latest.created_at = latest.updated_at = new Date(NOW + 2000).toISOString();
      s.prs[0].comments.push(latest);
    }
    assert.equal(mergeGate(s.prs[0], 1, BASE).ok, false);
    assert.equal(forIssue(s, 1)[0].kind, 'review');
    s.prs[0].reviews[0].submitted_at = new Date(NOW + 3000).toISOString();
    assert.equal(mergeGate(s.prs[0], 1, BASE).ok, true);
  }
});

test('review reservations bind both source head and evidence revision', () => {
  const s = withPr(), state = emptyState();
  s.prs[0].reviews = [];
  state.issues[1] = { reviews: { [HEAD]: stamp } };
  const first = forIssue(s, 1, state)[0];
  assert.equal(first?.kind, 'review'); // Legacy head-only reservation cannot certify evidence.
  assert.ok(first.evidenceRevision);
  state.issues[1].reviews[`${HEAD}:${first.evidenceRevision}`] = stamp;
  assert.equal(forIssue(s, 1, state).length, 0);
  s.prs[0].comments[0].updated_at = new Date(NOW + 2000).toISOString();
  const second = forIssue(s, 1, state)[0];
  assert.equal(second.kind, 'review');
  assert.notEqual(second.evidenceRevision, first.evidenceRevision);
});

test('same-second review/evidence ambiguity holds, while a genuinely later review passes', () => {
  const p = pull();
  p.reviews[0].submitted_at = stamp;
  assert.equal(reviewGate(p).request, true);
  p.reviews[0].submitted_at = new Date(NOW + 1000).toISOString();
  assert.equal(reviewGate(p).ok, true);
});

test('fresh evidence gets a bounded review wait even when the source head is old', () => {
  const s = withPr(), state = emptyState();
  s.prs[0].reviews = []; s.prs[0].reviewRequested = true;
  state.issues[1] = { observedHead: HEAD, headSeenAt: new Date(NOW - WAIT_MS - 1).toISOString() };
  assert.equal(forIssue(s, 1, state).length, 0);
});

test('review intent persists the exact evidence revision and aborts if it changes before request', async t => {
  const dir = await temp(t), s = withPr(); s.prs[0].reviews = [];
  const api = fake(s);
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  const action = api.calls[0], saved = await loadState(dir);
  assert.equal(saved.issues[1].reviews[`${HEAD}:${action.evidenceRevision}`], stamp);

  const otherDir = await temp(t);
  let reads = 0;
  const racing = fake(s, { snapshot: async () => {
    const copy = clone(s);
    if (++reads > 1) copy.prs[0].comments[0].updated_at = new Date(NOW + 2000).toISOString();
    return copy;
  } });
  const result = await runOnce({ stateDir: otherDir, apply: true, github: racing, now: () => NOW, log: quiet });
  assert.equal(result.aborted, true);
  assert.equal(racing.calls.length, 0);
});

test('confirmed conflict routes to bounded repair before attempting a behind-branch update', () => {
  const s = withPr(3, { includesBase: false, mergeable: false, mergeable_state: 'dirty' });
  assert.equal(forIssue(s, 3)[0].kind, 'repair');
  s.issues[9].assignees = [coder];
  assert.equal(forIssue(s, 3).length, 0); // Same pending-assignment lane guard.
  s.issues[9].assignees = [];
  const state = emptyState(); state.issues[3] = { repairs: 3 };
  assert.equal(forIssue(s, 3, state)[0].kind, 'park');
});

for (const issueClosed of [false, true]) {
  test(`GraphQL-only association survives PR merge with issue ${issueClosed ? 'closed' : 'open'}`, async () => {
    const s = snapshot([1]), p = pull(1, { state: 'closed', body: '', merged: true, mergeInBase: true,
      changed_files: 1, merge_commit_sha: OTHER });
    if (issueClosed) { s.issues[0].state = 'closed'; s.issues[0].state_reason = 'completed'; }
    const graph = { closingRefs: [{ repo: REPO, number: 1 }], threads: [] };
    const api = new GitHub();
    api.base = async () => BASE;
    api.graph = async () => graph;
    api.api = async route => {
      if (route === 'user') return { login: 'operator' };
      if (route.endsWith('/pulls/22')) return p;
      if (route.includes('/compare/')) return { status: 'ahead' };
      const n = Number(route.match(/\/issues\/(\d+)$/)?.[1]);
      if (n) return s.issues[n - 1];
      throw new Error(`Unexpected fixture route ${route}`);
    };
    api.pages = async route => {
      if (route.includes('/tasks')) return [];
      if (route.includes('/pulls?')) return [p];
      if (route.endsWith('/files')) return p.files;
      return [];
    };
    api.pull = async (number, base, prefetchedGraph) => ({ ...p, ...(prefetchedGraph ?? await api.graph(number)) });
    const result = await api.snapshot();
    assert.equal(result.prs.length, 1);
    assert.equal(associatedIssue(result.prs[0]), 1);
    if (issueClosed) assert.equal(completed(result.issues[0], result.prs), true);
    else {
      const state = emptyState(); state.inFlight = { id: 'merge', kind: 'merge', issue: 1, pr: 22 };
      reconcile(state, result, quiet);
      assert.equal(state.issues[1].needsPark, undefined);
      assert.equal(forIssue(result, 1, state)[0].kind, 'close');
    }
  });
}

test('allowlist is exactly 1..21 and base policy reserves all model writers', () => {
  assert.deepEqual(ISSUES, Array.from({ length: 21 }, (_, i) => i + 1));
  for (const n of [2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 16, 18, 19, 20, 21]) assert.ok(lanes(n).includes('minister'));
  assert.deepEqual(lanes(15), ['minister', 'leaderboard']);
});

test('controlled associations accept only one same-repository closing reference', () => {
  assert.equal(associatedIssue(pull()), 1);
  assert.equal(associatedIssue(pull(3, { body: `Fixes https://github.com/${REPO}/issues/3` })), 3);
  assert.equal(associatedIssue(pull(1, { body: 'Mentions #1' })), null);
  assert.equal(associatedIssue(pull(1, { body: 'Fixes #1\nFixes other/repo#7' })), null);
  assert.equal(associatedIssue(pull(1, { body: 'Fixes #1\nCloses #3' })), null);
  assert.equal(associatedIssue(pull(1, { body: 'Fixes #1, #3' })), null);
  assert.equal(associatedIssue(pull(1, { body: 'Fixes #1 and https://github.com/other/repo/issues/3' })), null);
  assert.equal(associatedIssue(pull(1, { body: '```text\nFixes #1\n```' })), null);
  assert.equal(associatedIssue(pull(1, { body: 'Fixes #25' })), null);
  assert.equal(closingRefs('Fixes #1', [{ repo: REPO, number: 1 }]).length, 1);
});

test('bootstrap PR25 is not actionable', () => {
  const s = snapshot();
  s.prs.push(pull(1, { number: 25, body: 'Bootstrap validation infrastructure', user: { login: 'operator', type: 'User' } }));
  assert.deepEqual(actions(s), []);
});

test('blocked dependencies are authoritative', () => {
  const s = snapshot([3]);
  s.issues[2].blockers = [blocker(1)];
  assert.equal(forIssue(s, 3).length, 0);
  assert.ok(plan(s, emptyState(), NOW).holds.some(h => h.issue === 3 && h.reason.includes('dependencies')));
});

for (const [label, issueState, merged, ancestry, expected] of [
  ['closed-not-planned', 'not_planned', true, true, false],
  ['closed-completed without merged work', 'completed', false, false, false],
  ['merged into wrong ancestry', 'completed', true, false, false],
  ['closed-completed and verified master merge', 'completed', true, true, true],
]) {
  test(`dependency completion: ${label}`, () => {
    const s = snapshot([3]);
    s.issues[0].state = 'closed'; s.issues[0].state_reason = issueState;
    s.issues[2].blockers = [blocker(1)];
    s.prs.push(pull(1, { state: 'closed', merged, mergeInBase: ancestry }));
    assert.equal(completed(s.issues[0], s.prs), expected);
    assert.equal(forIssue(s, 3).some(a => a.kind === 'dispatch'), expected);
  });
}

test('foreign/external dependency is not confused with an allowlisted number', () => {
  const s = snapshot([3]);
  s.issues[2].blockers = [{ ...blocker(1), repository_url: 'https://api.github.com/repos/other/repo' }];
  s.issues[0].state = 'closed'; s.issues[0].state_reason = 'completed';
  s.prs.push(pull(1, { state: 'closed', merged: true, mergeInBase: true }));
  assert.equal(forIssue(s, 3).length, 0);
});

test('dependencies also gate merge of an already-open PR', () => {
  const s = withPr(3); s.issues[2].blockers = [blocker(1)];
  assert.equal(forIssue(s, 3).length, 0);
});

test('max three independent dispatch reservations; clinical/UI/board share a lane', () => {
  const s = snapshot([1, 3, 9, 10, 12, 13, 15, 17, 21]);
  const starts = actions(s).filter(a => a.kind === 'dispatch');
  assert.equal(starts.length, 3);
  assert.deepEqual(starts.map(a => a.issue), [1, 3, 9]);
  assert.equal(starts.filter(a => lanes(a.issue).includes('minister')).length, 1);
});

test('priority P0/P1 then milestone determines dispatch order', () => {
  const s = snapshot([1, 9, 17]);
  s.issues[16].labels = [{ name: 'P0' }];
  s.issues[8].labels = [{ name: 'P1: important' }];
  assert.deepEqual(actions(s).map(a => a.issue), [17, 9, 1]);
});

test('three active cloud tasks block all new dispatch', () => {
  const s = snapshot([9]);
  for (const n of [1, 3, 17]) {
    const p = pull(n); s.prs.push(p);
    s.tasks.push({ id: `t${n}`, state: 'in_progress', prIds: [p.id] });
  }
  assert.equal(actions(s).filter(a => a.kind === 'dispatch').length, 0);
  assert.equal(plan(s, emptyState(), NOW).active, 3);
});

test('duplicate active sessions plus an unrepresented assignment reserve all three slots', () => {
  const s = snapshot([17]), state = emptyState(), p = pull(3);
  s.prs.push(p);
  s.tasks.push({ id: 'duplicate-1', state: 'in_progress', prIds: [p.id] },
    { id: 'duplicate-2', state: 'in_progress', prIds: [p.id] });
  s.issues[0].assignees = [coder];
  state.issues[3] = { parked: true };
  const result = plan(s, state, NOW);
  assert.equal(result.active, 2);
  assert.equal(result.reserved, 3);
  assert.ok(!result.actions.some(a => a.kind === 'dispatch' && a.issue === 17));
});

test('unknown active task occupies capacity and conservatively all lanes', () => {
  const s = snapshot([1, 3, 17]);
  s.tasks.push({ id: 'unassociated', state: 'queued', prIds: [] });
  assert.equal(actions(s).length, 0);
});

test('active task and its PR are not counted twice', () => {
  const s = withPr(1);
  s.tasks[0].state = 'in_progress';
  s.issues[2].blockers = []; s.issues[16].blockers = [];
  assert.deepEqual(actions(s).filter(a => a.kind === 'dispatch').map(a => a.issue), [3, 17]);
});

test('active task prevents review/merge/repair of its PR', () => {
  const s = withPr(); s.tasks[0].state = 'in_progress';
  assert.deepEqual(forIssue(s, 1), []);
});

test('follow-up task with branch base=head remains associated; any active task blocks', () => {
  const s = withPr();
  s.tasks.push({ id: 'follow-up', state: 'in_progress', prIds: [s.prs[0].id],
    artifacts: [{ provider: 'github', type: 'branch', data: { base_ref: s.prs[0].head.ref, head_ref: s.prs[0].head.ref } }] });
  assert.equal(forIssue(s, 1).length, 0);
  s.tasks.reverse();
  assert.equal(forIssue(s, 1).length, 0);
});

test('newest dated terminal task wins; undated conflicting history parks', () => {
  const s = withPr();
  s.tasks[0].state = 'failed';
  s.tasks[0].created_at = '2026-10-20T00:00:00Z';
  s.tasks.push({ id: 'follow-up', state: 'completed', prIds: [s.prs[0].id], created_at: stamp });
  assert.equal(forIssue(s, 1)[0].kind, 'merge');
  s.tasks.reverse();
  assert.equal(forIssue(s, 1)[0].kind, 'merge');
  delete s.tasks[0].created_at;
  assert.equal(forIssue(s, 1)[0].kind, 'park');
});

test('completed task with older-head branch coding action blocks merge and duplicate repair', () => {
  const s = withPr();
  s.prs[0].codingRuns = [{ id: 99, name: 'Addressing comment on PR #22', head_sha: OTHER, status: 'in_progress' }];
  assert.equal(forIssue(s, 1).length, 0);
  assert.equal(plan(s, emptyState(), NOW).active, 1);
  s.prs[0].checks[0].conclusion = 'failure';
  assert.equal(forIssue(s, 1).length, 0);
  s.prs[0].codingRuns[0].status = 'completed';
  assert.equal(forIssue(s, 1)[0].kind, 'repair');
});

test('branch action telemetry reserves lanes and is not double-counted with its task', () => {
  const s = withPr(3); s.issues[9].blockers = [];
  s.prs[0].codingRuns = [{ id: 99, status: 'queued' }];
  assert.ok(!actions(s).some(a => a.issue === 10 && a.kind === 'dispatch'));
  s.tasks[0].state = 'in_progress';
  assert.equal(plan(s, emptyState(), NOW).active, 1);
  s.prs[0].codingRuns.push({ id: 100, status: 'in_progress' });
  assert.equal(plan(s, emptyState(), NOW).active, 2);
  assert.equal(forIssue(s, 3)[0].kind, 'park');
});

test('repair intent waits for observable execution completion, not stale completed task', () => {
  const s = withPr(), state = emptyState();
  state.issues[1] = { repairs: 1, repairPendingHead: HEAD, lastRepairAt: stamp, workPendingRunIds: [] };
  observe(state, s, NOW);
  assert.equal(forIssue(s, 1, state).length, 0);
  s.prs[0].codingRuns = [{ id: 99, status: 'completed', created_at: new Date(NOW + 1).toISOString() }];
  observe(state, s, NOW + 2);
  assert.equal(state.issues[1].repairPendingHead, undefined);
  assert.equal(forIssue(s, 1, state)[0].kind, 'merge');
});

test('stable first-observed head bounds waiting despite unrelated updated_at changes', () => {
  const s = withPr(), state = emptyState();
  s.tasks = [];
  observe(state, s, NOW);
  s.prs[0].updated_at = new Date(NOW + WAIT_MS + 1).toISOString();
  observe(state, s, NOW + WAIT_MS + 1);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
});

test('duplicate task sessions and duplicate open PRs park visibly', () => {
  const s = withPr(); s.tasks[0].state = 'queued';
  s.tasks.push({ ...s.tasks[0], id: 'duplicate' });
  assert.equal(forIssue(s, 1)[0].kind, 'park');
  const t = withPr(); t.prs.push(pull(1, { id: 1999, number: 40 }));
  assert.equal(forIssue(t, 1)[0].kind, 'park');
});

test('already assigned and pending-ledger work is never reassigned', () => {
  const s = snapshot([1]); s.issues[0].assignees = [coder];
  assert.equal(actions(s).length, 0);
  const state = emptyState(); state.issues[1] = { dispatchedAt: stamp };
  s.issues[0].assignees = [];
  assert.equal(actions(s, state).length, 0);
});

test('parked inactive PR releases lane while active parked tasks still reserve it', () => {
  const s = withPr(3); s.issues[9].blockers = [];
  const state = emptyState(); state.issues[3] = { parked: true };
  assert.ok(actions(s, state).some(a => a.kind === 'dispatch' && a.issue === 10));
  s.tasks[0].state = 'in_progress';
  assert.ok(!actions(s, state).some(a => a.kind === 'dispatch' && a.issue === 10));
});

for (const [label, change] of [
  ['no CI', p => { p.runs = []; p.checks = []; }],
  ['stale trusted CI', p => { p.runs[0].head_sha = OTHER; }],
  ['wrong workflow path', p => { p.runs[0].path = '.github/workflows/ci.yml'; }],
  ['wrong workflow branch', p => { p.runs[0].head_branch = 'somewhere-else'; }],
  ['missing Validate job', p => { p.runs[0].validateJob = false; }],
  ['failed CI', p => { p.runs[0].conclusion = 'failure'; }],
  ['pending CI', p => { p.runs[0].status = 'in_progress'; }],
  ['pending check', p => { p.checks.push({ name: 'Running Copilot Code Review', head_sha: HEAD, status: 'in_progress' }); }],
  ['failed check', p => { p.checks[0].conclusion = 'failure'; }],
  ['neutral is not success', p => { p.checks[0].conclusion = 'neutral'; }],
  ['stale check', p => { p.checks[0].head_sha = OTHER; }],
  ['failed commit status', p => { p.statuses = [{ id: 1, context: 'test', sha: HEAD, state: 'failure' }]; }],
  ['pending commit status', p => { p.statuses = [{ id: 1, context: 'test', sha: HEAD, state: 'pending' }]; }],
  ['stale commit status', p => { p.statuses = [{ id: 1, context: 'test', sha: OTHER, state: 'success' }]; }],
]) {
  test(`merge refuses ${label}`, () => {
    const p = pull(); change(p);
    assert.equal(ciGate(p).ok, false);
    assert.equal(mergeGate(p, 1, BASE).ok, false);
  });
}

test('new workflow attempt failure overrides historical success', () => {
  const p = pull(); p.runs.push({ ...p.runs[0], run_attempt: 2, conclusion: 'failure' });
  assert.equal(ciGate(p).ok, false);
});

test('newer pending trusted run never falls back to an older success', () => {
  const p = pull();
  p.runs.push({ ...p.runs[0], id: 402, run_number: 21, status: 'queued', conclusion: null, validateJob: false });
  assert.equal(ciGate(p).ok, false);
  p.runs[1].status = 'completed'; p.runs[1].conclusion = 'failure';
  assert.equal(ciGate(p).ok, false);
});

test('action_required holds validation without charging code repairs or falling back to old success', () => {
  const s = withPr(), state = emptyState();
  delete s.prs[0].workflowDefinition; // No verified definition: authorization must hold.
  s.prs[0].runs.push({ ...s.prs[0].runs[0], id: 402, run_number: 21, conclusion: 'action_required', validateJob: false });
  state.issues[1] = { repairs: 3 };
  const gate = ciGate(s.prs[0]);
  assert.equal(gate.ok, false);
  assert.equal(gate.infrastructureHold, true);
  assert.equal(gate.repair, undefined);
  assert.equal(forIssue(s, 1, state).length, 0);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
  assert.equal(state.issues[1].repairs, 3);
});

test('action_required schedules exactly the current trusted run attempt for rerun', () => {
  const s = withPr(), state = emptyState();
  s.prs[0].runs[0].conclusion = 'action_required';
  s.prs[0].runs[0].validateJob = false;
  state.issues[1] = { repairs: 3 };
  const action = forIssue(s, 1, state)[0];
  assert.equal(action.kind, 'rerun-validation');
  assert.equal(action.runId, 401);
  assert.equal(action.runAttempt, 1);
  assert.equal(action.head, HEAD);
  assert.equal(action.baseBlob, OTHER);
  state.issues[1].validationReruns = { [`${HEAD}:401:1`]: stamp };
  assert.equal(forIssue(s, 1, state).length, 0);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
  s.prs[0].runs[0].run_attempt = 2;
  s.prs[0].runs[0].conclusion = 'success';
  s.prs[0].runs[0].validateJob = true;
  assert.equal(forIssue(s, 1, state)[0].kind, 'merge');
  assert.equal(state.issues[1].repairs, 3);
});

test('validation rerun rejects changed CI definitions even for deployment issue9', () => {
  const s = withPr(9, { files: [{ filename: WORKFLOW }] });
  s.prs[0].runs[0].conclusion = 'action_required';
  s.prs[0].workflowDefinition.headBlob = HEAD;
  assert.ok(!forIssue(s, 9).some(a => a.kind === 'rerun-validation'));
});

test('validation rerun refuses mismatched run identity, source, PR association, or active writer', () => {
  const cases = [
    p => { p.runs[0].path = '.github/workflows/untrusted.yml'; },
    p => { p.runs[0].event = 'workflow_dispatch'; },
    p => { p.runs[0].head_sha = OTHER; },
    p => { p.runs[0].pull_requests[0].number = 25; },
    p => { p.runs[0].pull_requests[0].head.sha = OTHER; },
    p => { p.runs[0].pull_requests = []; },
    p => { p.user = { login: 'Copilot', type: 'Bot', id: 123 }; },
    p => { p.codingRuns = [{ id: 999, status: 'in_progress' }]; },
    p => { p.workflowDefinition.baseCommit = OTHER; },
  ];
  for (const change of cases) {
    const s = withPr(); s.prs[0].runs[0].conclusion = 'action_required'; change(s.prs[0]);
    assert.ok(!forIssue(s, 1).some(a => a.kind === 'rerun-validation'));
  }
});

test('validation reruns have a separate bounded per-head budget', () => {
  const s = withPr(), state = emptyState();
  s.prs[0].runs[0].conclusion = 'action_required';
  s.prs[0].runs[0].run_attempt = 4;
  state.issues[1] = { repairs: 0, validationReruns: Object.fromEntries([1, 2, 3].map(n => [`${HEAD}:401:${n}`, stamp])) };
  assert.equal(forIssue(s, 1, state)[0].kind, 'park');
  assert.equal(state.issues[1].repairs, 0);
});

test('validation rerun is journaled, deduplicated and never merges in the same pass', async t => {
  const dir = await temp(t), s = withPr(), api = fake(s);
  s.prs[0].runs[0].conclusion = 'action_required';
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.deepEqual(api.calls.map(a => a.kind), ['rerun-validation']);
  assert.equal((await loadState(dir)).issues[1].validationReruns[`${HEAD}:401:1`], stamp);
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.equal(api.calls.length, 1);
});

test('validation rerun revalidation rejects a newly superseding run attempt', async t => {
  const dir = await temp(t), s = withPr();
  s.prs[0].runs[0].conclusion = 'action_required';
  let reads = 0;
  const api = fake(s, { snapshot: async () => {
    const copy = clone(s);
    if (++reads > 1) copy.prs[0].runs[0].run_attempt = 2;
    return copy;
  } });
  const result = await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.equal(result.aborted, true);
  assert.equal(api.calls.length, 0);
});

test('superseded check failure does not poison latest success of the exact same identity', () => {
  const p = pull();
  p.checks.push({ ...p.checks[0], id: 302 });
  p.checks[0].conclusion = 'failure';
  assert.equal(ciGate(p).ok, true);
  p.checks[1].status = 'in_progress';
  assert.equal(ciGate(p).ok, false);
});

test('same-name checks from different apps/workflows cannot hide each other', () => {
  for (const change of [
    c => { c.app = { id: 2, slug: 'another-app' }; },
    c => { c.workflowId = 2; },
  ]) {
    const p = pull(); p.checks[0].conclusion = 'failure';
    const newer = { ...clone(p.checks[0]), id: 302, conclusion: 'success' };
    change(newer); p.checks.push(newer);
    assert.equal(ciGate(p).ok, false);
  }
});

test('observed positive COMMENTED ccr-overview-v2 with historical resolved finding passes', () => {
  const p = pull();
  p.reviews[0].body = '<!-- ccr-overview-v2 -->\n\n### 🟢 Approval recommended\n\nNo blocking issues found.\n\n**No open issues** 🎉\n\n<details>\n<summary>1 resolved since last review</summary>\nOld finding: https://github.com/cammeleon66/Cammelot/pull/25#discussion_r1\n</details>';
  assert.equal(reviewGate(p).ok, true);
  assert.equal(mergeGate(p, 1, BASE).ok, true);
  p.checks[0].status = 'in_progress';
  assert.equal(mergeGate(p, 1, BASE).ok, false);
  p.reviews[0].body = p.reviews[0].body.replace('**No open issues** 🎉', '<strong>1 open issue</strong>');
  assert.equal(reviewGate(p).ok, false);
});

test('a later COMMENTED review does not clear changes requested', () => {
  const p = pull();
  p.reviews.push({ id: 600, user: { login: 'human' }, commit_id: HEAD, state: 'CHANGES_REQUESTED' },
    { id: 601, user: { login: 'human' }, commit_id: HEAD, state: 'COMMENTED' });
  assert.equal(reviewGate(p).ok, false);
});

test('latest status supersedes historical status for same context', () => {
  const p = pull();
  p.statuses = [{ id: 1, context: 'test', sha: HEAD, state: 'failure' }, { id: 2, context: 'test', sha: HEAD, state: 'success' }];
  assert.equal(ciGate(p).ok, true);
});

for (const [label, change] of [
  ['missing review', p => { p.reviews = []; }],
  ['stale review', p => { p.reviews[0].commit_id = OTHER; }],
  ['coding bot is not independent reviewer', p => { p.reviews[0].user = coder; }],
  ['unknown COMMENTED verdict', p => { p.reviews[0].body = 'I reviewed these files.'; }],
  ['negated approval', p => { p.reviews[0].body = 'Not approved. No actionable findings were verified.'; }],
  ['observed ccr negative', p => { p.reviews[0].body = '<!-- ccr-overview-v2 -->\n\n### 🟡 Changes recommended\n<strong>1 open issue</strong>'; }],
  ['unresolved thread', p => { p.threads = [{ isResolved: false, isOutdated: true }]; }],
  ['current reviewer findings', p => { p.reviewComments = [{ pull_request_review_id: 501 }]; }],
  ['changes requested by another reviewer', p => { p.reviews.push({ id: 600, user: { login: 'other' }, commit_id: HEAD, state: 'CHANGES_REQUESTED' }); }],
]) {
  test(`merge refuses ${label}`, () => {
    const p = pull(); change(p);
    assert.equal(reviewGate(p).ok, false);
    assert.equal(mergeGate(p, 1, BASE).ok, false);
  });
}

test('resolved old findings do not defeat a clean current-head independent review', () => {
  const p = pull(); p.threads = [{ isResolved: true }];
  p.reviewComments = [{ pull_request_review_id: 400 }];
  assert.equal(reviewGate(p).ok, true);
});

test('current independent APPROVED review with zero findings passes', () => {
  const p = pull(); p.reviews[0].state = 'APPROVED'; p.reviews[0].body = '';
  assert.equal(reviewGate(p).ok, true);
});

for (const [label, change] of [
  ['wrong base', p => { p.base.ref = 'feature/agentic-overhaul'; }],
  ['wrong base repo', p => { p.base.repo.full_name = 'other/repo'; }],
  ['wrong head repo', p => { p.head.repo.full_name = 'other/repo'; }],
  ['wrong author', p => { p.user = { login: 'human', type: 'User' }; }],
  ['missing file evidence', p => { p.files = []; }],
  ['workflow modification', p => { p.files.push({ filename: WORKFLOW }); }],
  ['renamed forbidden file', p => { p.files[0].previous_filename = '.github/workflows/ci.yml'; }],
]) {
  test(`scope refuses ${label}`, () => {
    const p = pull(); change(p);
    assert.ok(scopeProblem(p, 1));
    assert.equal(mergeGate(p, 1, BASE).ok, false);
  });
}

test('only deployment issue9 may modify workflows; dispatcher cannot modify itself', () => {
  assert.equal(fileAllowed(9, WORKFLOW), true);
  assert.equal(fileAllowed(3, WORKFLOW), false);
  for (const n of ISSUES) assert.equal(fileAllowed(n, 'scripts/automation/policy.mjs'), false);
  assert.equal(fileAllowed(17, 'README.md'), false);
  assert.equal(fileAllowed(17, 'docs/research/findings.md'), true);
  assert.equal(fileAllowed(3, 'docs/MINISTER_MODEL_CONTRACT.md'), false);
  assert.equal(fileAllowed(1, '../secret.md'), false);
});

test('missing/stale/forged acceptance evidence blocks closure and merge', () => {
  for (const comments of [[], [evidence(1, OTHER)], [{ ...evidence(), user: { login: 'outsider', type: 'User' } }]]) {
    const p = pull(1, { comments });
    assert.equal(acceptanceGate(p, 1).ok, false);
  }
  const p = pull(); p.comments[0].body = '<!-- backlog-evidence {invalid} -->';
  assert.equal(acceptanceGate(p, 1).ok, false);
});

test('scientific caveats require explicit zero blocking gaps, never silent acceptance', () => {
  const p = pull(), e = JSON.parse(p.comments[0].body.match(/<!-- backlog-evidence (.*) -->/)[1]);
  e.limitations = ['Clinical calibration is not established; this is a documented assumption.'];
  const update = () => { p.comments[0].body = `<!-- backlog-evidence ${JSON.stringify(e)} -->`; };
  update(); assert.equal(acceptanceGate(p, 1).ok, false);
  e.blockingGaps = []; update(); assert.equal(acceptanceGate(p, 1).ok, true);
  e.blockingGaps = ['Required acceptance criterion remains incomplete']; update();
  assert.equal(acceptanceGate(p, 1).ok, false);
  e.limitations = []; update(); assert.equal(acceptanceGate(p, 1).ok, false);
});

test('issue16 human/device acceptance is never fabricated', () => {
  const s = withPr(16);
  assert.equal(acceptanceGate(s.prs[0], 16).ok, false);
  assert.equal(forIssue(s, 16)[0].kind, 'evidence');
});

test('new base updates before fresh acceptance/review and invalidates old approvals', () => {
  const s = withPr(); s.prs[0].includesBase = false;
  assert.equal(forIssue(s, 1)[0].kind, 'update');
  assert.equal(mergeGate(s.prs[0], 1, OTHER).ok, false);
  s.prs[0].includesBase = true; s.prs[0].head.sha = OTHER;
  assert.equal(mergeGate(s.prs[0], 1, BASE).ok, false);
});

test('update request deduplicates and then parks after bounded wait', () => {
  const s = withPr(); s.prs[0].includesBase = false;
  const state = emptyState(); state.issues[1] = { updates: { [`${HEAD}:${BASE}`]: stamp } };
  assert.equal(forIssue(s, 1, state).length, 0);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
});

test('review request deduplicates by head/evidence revision and times out visibly', () => {
  const s = withPr(); s.prs[0].reviews = [];
  const action = forIssue(s, 1)[0];
  assert.equal(action.kind, 'review');
  const state = emptyState(); state.issues[1] = { reviews: { [`${HEAD}:${action.evidenceRevision}`]: stamp } };
  assert.equal(forIssue(s, 1, state).length, 0);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
});

test('completed draft is marked ready in its own pass before review/CI gates', () => {
  const s = withPr(1, { draft: true });
  assert.equal(forIssue(s, 1)[0].kind, 'ready');
  s.prs[0].checks = [];
  assert.equal(forIssue(s, 1)[0]?.kind, 'ready');
  s.tasks[0].state = 'in_progress';
  assert.equal(forIssue(s, 1).length, 0);
});

test('session stopping never closes issue; verified merge + acceptance closes explicitly', () => {
  const s = withPr();
  assert.equal(forIssue(s, 1)[0].kind, 'merge');
  s.prs[0].state = 'closed'; s.prs[0].merged = true; s.prs[0].mergeInBase = true;
  assert.equal(forIssue(s, 1)[0].kind, 'close');
  s.prs[0].comments = [];
  assert.equal(forIssue(s, 1)[0].kind, 'park');
});

for (const stateName of ['idle', 'waiting_for_user', 'failed', 'timed_out', 'cancelled']) {
  test(`task ${stateName} causes bounded repair, not completion`, () => {
    const s = withPr(); s.tasks[0].state = stateName;
    assert.equal(forIssue(s, 1)[0].kind, 'repair');
  });
}

test('same repair reason deduplicates, exhausted budget parks, no progression times out', () => {
  const s = withPr(); s.tasks[0].state = 'failed';
  const a = forIssue(s, 1)[0];
  const state = emptyState(); state.issues[1] = { repairs: 1, fingerprints: [a.reasonKey], lastRepairAt: stamp };
  assert.equal(forIssue(s, 1, state).length, 0);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
  state.issues[1] = { repairs: 3 };
  assert.equal(forIssue(s, 1, state)[0].kind, 'park');
});

test('repairs cannot exceed concurrency or conflict with another active writer', () => {
  const s = withPr(3);
  s.tasks[0].state = 'failed';
  const p = pull(10); s.prs.push(p);
  s.tasks.push({ id: 'other', state: 'in_progress', prIds: [p.id] });
  assert.equal(repairOrPark(s, emptyState(), s.prs[0], 3, 'broken', NOW), null);
  s.tasks.push({ id: 'x', state: 'queued', prIds: [] }, { id: 'y', state: 'queued', prIds: [] });
  assert.equal(repairOrPark(s, emptyState(), s.prs[0], 3, 'broken', NOW), null);
});

test('repair markers recover dedupe and budget, ignoring forged markers', () => {
  const s = withPr();
  const marker = { id: 'repair-id', kind: 'repair', issue: 1, reasonKey: 'reason' };
  s.prs[0].comments.push({ user: { login: 'operator' }, created_at: stamp, body: `<!-- backlog-dispatcher ${JSON.stringify(marker)} -->` });
  s.prs[0].comments.push({ user: { login: 'outsider' }, created_at: stamp, body: '<!-- backlog-dispatcher {"kind":"park","issue":1} -->' });
  const e = issueLedger(s, emptyState(), 1);
  assert.equal(e.repairs, 1); assert.equal(e.lastRepairAt, stamp); assert.equal(e.parked, false);
});

test('unknown task state and missing snapshot data fail closed', () => {
  const s = snapshot(); s.tasks.push({ id: 't', state: 'new_state', prIds: [] });
  assert.throws(() => actions(s), /Unknown task/);
  s.tasks = []; s.issues.pop();
  assert.throws(() => actions(s), /Incomplete/);
});

test('dry-run causes neither remote mutations nor directory/ledger/lock writes', async t => {
  const parent = await temp(t), dir = path.join(parent, 'not-created');
  const api = fake(snapshot([1, 3, 17]));
  const result = await runOnce({ stateDir: dir, github: api, log: quiet });
  assert.equal(result.actions.length, 3);
  assert.equal(api.calls.length, 0);
  assert.deepEqual(await readdir(parent), []);
});

test('dry-run does not checkpoint in-memory journal reconciliation', async t => {
  const dir = await temp(t), state = emptyState();
  state.inFlight = { id: 'uncertain', kind: 'dispatch', issue: 1, createdAt: stamp, status: 'prepared' };
  await checkpoint(dir, state);
  const before = await readFile(path.join(dir, 'state.json'), 'utf8');
  await runOnce({ stateDir: dir, github: fake(snapshot([1])), log: quiet });
  assert.equal(await readFile(path.join(dir, 'state.json'), 'utf8'), before);
  assert.deepEqual(await readdir(dir), ['state.json']);
});

test('lock contention fails before network and never steals lock', async t => {
  const dir = await temp(t), release = await acquireLock(dir);
  let reads = 0;
  await assert.rejects(runOnce({ stateDir: dir, apply: true, github: fake(snapshot(), { snapshot: async () => { reads++; } }), log: quiet }), { code: 'LOCKED' });
  assert.equal(reads, 0);
  assert.ok((await readdir(dir)).includes('dispatcher.lock'));
  await release();
});

test('atomic checkpoint replaces valid JSON, preserves last state on invalid input', async t => {
  const dir = await temp(t), state = emptyState();
  await checkpoint(dir, state);
  for (let i = 0; i < 5; i++) {
    state.issues[1] = { repairs: i };
    await checkpoint(dir, state);
    assert.equal((await loadState(dir)).issues[1].repairs, i);
  }
  await assert.rejects(checkpoint(dir, { version: 99 }), /Invalid/);
  assert.equal((await loadState(dir)).issues[1].repairs, 4);
  assert.deepEqual(await readdir(dir), ['state.json']);
  await writeFile(path.join(dir, 'state.json'), '{broken');
  await assert.rejects(loadState(dir));
});

test('apply journals intent before invoking adapter and executes at most one action', async t => {
  const dir = await temp(t);
  const api = fake(snapshot([1, 3, 17]));
  api.execute = async a => {
    const state = await loadState(dir);
    assert.equal(state.inFlight.id, a.id);
    assert.equal(state.inFlight.status, 'prepared');
    api.calls.push(a);
  };
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.equal(api.calls.length, 1);
  assert.equal((await loadState(dir)).inFlight.status, 'sent');
  assert.deepEqual(await readdir(dir), ['state.json']);
});

test('assignment unknown outcome is re-read and parked, never blindly repeated', async t => {
  const dir = await temp(t), s = snapshot([1]);
  let count = 0;
  const api = fake(s, { execute: async () => { count++; throw new Error('lost response'); } });
  await assert.rejects(runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet }), /lost response/);
  assert.equal((await loadState(dir)).inFlight.kind, 'dispatch');
  api.execute = async a => { assert.equal(a.kind, 'park'); count++; };
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.equal(count, 2);
  assert.equal((await loadState(dir)).issues[1].parked, true);
});

test('partial assignment success reconciles existing assignee without reassignment', () => {
  const state = emptyState();
  state.inFlight = { id: 'x', issue: 1, kind: 'dispatch' };
  const s = snapshot([1]); s.issues[0].assignees = [coder];
  reconcile(state, s, quiet);
  assert.equal(state.inFlight, null);
  assert.equal(state.issues[1].needsPark, undefined);
  assert.deepEqual(actions(s, state), []);
});

test('metadata failure causes no mutation and releases invocation lock', async t => {
  const dir = await temp(t), api = fake(snapshot(), { snapshot: async () => { throw new Error('metadata unavailable'); } });
  await assert.rejects(runOnce({ stateDir: dir, apply: true, github: api, log: quiet }), /metadata unavailable/);
  assert.equal(api.calls.length, 0);
  assert.deepEqual(await readdir(dir), []);
});

test('dispatch revalidation catches newly active assignment/task', async t => {
  const dir = await temp(t), s = snapshot([1]);
  let reads = 0;
  const api = fake(s, { snapshot: async () => { const copy = clone(s); if (++reads > 1) copy.issues[0].assignees = [coder]; return copy; } });
  const result = await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.equal(result.aborted, true); assert.equal(api.calls.length, 0);
});

test('unknown active task ownership holds a merge-ready PR without starting repair', () => {
  for (const taskState of ['queued', 'in_progress']) {
    const s = withPr();
    s.tasks.push({ id: 'awaiting-artifacts', state: taskState, prIds: [] });
    const result = plan(s, emptyState(), NOW + WAIT_MS + 1);
    assert.equal(result.unknownActive, true);
    assert.equal(result.actions.length, 0);
    assert.ok(result.holds.some(h => h.issue === 1 && /ownership.*unknown/.test(h.reason)));
    s.tasks.at(-1).state = 'completed';
    assert.equal(forIssue(s, 1)[0].kind, 'merge');
  }
});

test('final merge gate rejects unknown active task ownership despite passing PR checks', () => {
  const s = withPr();
  assert.equal(mergeGate(s.prs[0], 1, BASE).ok, true);
  s.tasks.push({ id: 'awaiting-artifacts', state: 'in_progress', prIds: [] });
  const { unknownActive } = plan(s, emptyState(), NOW);
  const gate = mergeGate(s.prs[0], 1, BASE, { unknownActive });
  assert.equal(gate.ok, false);
  assert.match(gate.reason, /ownership.*unknown/);
});

test('merge revalidation aborts when an unknown-owner task appears after planning', async t => {
  const dir = await temp(t), s = withPr();
  let reads = 0;
  const api = fake(s, { snapshot: async () => {
    const copy = clone(s);
    if (++reads > 1) copy.tasks.push({ id: 'awaiting-artifacts', state: 'in_progress', prIds: [] });
    return copy;
  } });
  const result = await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.equal(result.aborted, true);
  assert.equal(api.calls.length, 0);
  assert.equal((await loadState(dir)).inFlight, null);
});

for (const race of ['source head', 'base head']) {
  test(`merge fence aborts changed ${race}`, async t => {
    const dir = await temp(t), s = withPr();
    let baseReads = 0;
    const api = fake(s, {
      api: async () => ({ ...clone(s.prs[0]), head: { ...s.prs[0].head, sha: race === 'source head' ? OTHER : HEAD } }),
      base: async () => ++baseReads > 1 && race === 'base head' ? OTHER : BASE,
    });
    const result = await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
    assert.equal(result.aborted, true); assert.equal(api.calls.length, 0);
  });
}

test('merge does not close until a later verified remote merge observation', async t => {
  const dir = await temp(t), s = withPr(), api = fake(s);
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.deepEqual(api.calls.map(a => a.kind), ['merge']);
  s.prs[0].merged = true; s.prs[0].mergeInBase = true; s.prs[0].state = 'closed';
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.deepEqual(api.calls.map(a => a.kind), ['merge', 'close']);
});

test('unconfirmed merge response retains journal, never closes issue', async t => {
  const dir = await temp(t), api = fake(withPr(), { verifyMerge: async () => false });
  await assert.rejects(runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet }), /not verified/);
  assert.deepEqual(api.calls.map(a => a.kind), ['merge']);
  assert.equal((await loadState(dir)).inFlight.status, 'prepared');
});

test('ready action is an entire pass; next-pass newly queued CI prohibits merge', async t => {
  const dir = await temp(t), s = withPr(1, { draft: true }), api = fake(s);
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.deepEqual(api.calls.map(a => a.kind), ['ready']);
  s.prs[0].draft = false;
  s.prs[0].runs.push({ ...s.prs[0].runs[0], id: 402, run_number: 21, status: 'queued', conclusion: null });
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.deepEqual(api.calls.map(a => a.kind), ['ready']);
});

test('adapter blocks writes unless explicitly enabled; query-only GraphQL allowed', async () => {
  const calls = [], api = new GitHub({ invoke: async (...args) => { calls.push(args); return '{}'; } });
  await assert.rejects(api.execute({ kind: 'dispatch', issue: 1 }), /mutations disabled/);
  await assert.rejects(api.api('graphql', { method: 'POST', body: { query: 'mutation { dangerous }' } }), /mutations disabled/);
  await api.api('graphql', { method: 'POST', body: { query: 'query Check { viewer { login } }' } });
  assert.equal(calls.length, 1);
});

test('adapter uses fixed argv, POST preserves assignees, JSON over stdin, guarded merge', async () => {
  const calls = [], api = new GitHub({ allowWrites: true, invoke: async (args, input) => { calls.push({ args, input }); return '{}'; } });
  await api.execute({ kind: 'dispatch', issue: 3 });
  assert.ok(calls[0].args.includes('POST'));
  assert.ok(calls[0].args.includes('--input'));
  assert.deepEqual(calls[0].input.assignees, [CODER]);
  assert.equal(calls[0].input.agent_assignment.base_branch, 'master');
  await api.execute({ kind: 'review', issue: 1, pr: 22 });
  assert.deepEqual(calls[1].args, ['pr', 'edit', '22', '--repo', REPO, '--add-reviewer', '@copilot']);
  await api.execute({ kind: 'merge', issue: 1, pr: 22, head: HEAD });
  assert.deepEqual(calls[2].args, ['pr', 'merge', '22', '--repo', REPO, '--squash', '--match-head-commit', HEAD]);
  await api.execute({ kind: 'repair', issue: 1, pr: 22, head: HEAD, reason: '$(malicious); & cmd.exe', attempt: 1, id: 'safe' });
  assert.ok(!calls[3].args.join(' ').includes('malicious'));
  assert.ok(calls[3].input.body.includes('$(malicious)'));
  await api.execute({ kind: 'rerun-validation', issue: 1, pr: 22, head: HEAD, runId: 401, baseBlob: OTHER, headBlob: OTHER });
  assert.ok(calls[4].args.includes(`repos/${REPO}/actions/runs/401/rerun`));
  assert.ok(calls[4].args.includes('POST'));
  assert.deepEqual(calls[4].input, {});
  assert.ok(!calls.some(c => c.args.some(a => a.endsWith('/approve'))));
  await assert.rejects(api.execute({ kind: 'dispatch', issue: 25 }), /outside allowlist/);
});

test('adapter paginates tasks wrapper and bounds/truncation failures', async () => {
  let requests = 0;
  const api = new GitHub({ invoke: async () => response({ tasks: ++requests === 1 ? Array.from({ length: 100 }, (_, id) => ({ id })) : [{ id: 100 }] }) });
  assert.equal((await api.pages('agents/repos/test/tasks', 'tasks')).length, 101);
  assert.equal(requests, 2);
  const truncated = new GitHub({ invoke: async () => response({ total_count: 2, tasks: [{ id: 1 }] }) });
  await assert.rejects(truncated.pages('x', 'tasks'), /Truncated/);
  const infinite = new GitHub({ invoke: async () => response(Array(100).fill({})) });
  await assert.rejects(infinite.pages('x'), /Pagination bound/);
  const missing = new GitHub({ invoke: async () => response({}) });
  await assert.rejects(missing.pages('x', 'tasks'), /Missing collection/);
});

test('Link pagination is followed even on a short page; unsafe/cursor pagination holds', async () => {
  let page = 0;
  const api = new GitHub({ invoke: async () => ++page === 1 ?
    response({ tasks: [{ id: 1 }] }, 'Link: <https://api.github.com/agents/repos/x/tasks?per_page=100&page=2>; rel="next"\r\n') :
    response({ tasks: [{ id: 2 }] }) });
  assert.equal((await api.pages('agents/repos/x/tasks', 'tasks')).length, 2);
  api.invoke = async () => response({ tasks: [] }, 'Link: <https://evil.invalid/tasks?per_page=100&page=2>; rel="next"\r\n');
  await assert.rejects(api.pages('agents/repos/x/tasks', 'tasks'), /unsafe pagination/);
  api.invoke = async () => response({ tasks: [], next_cursor: 'next-page' });
  await assert.rejects(api.pages('agents/repos/x/tasks', 'tasks'), /cursor pagination/);
});

test('full adapter snapshot consumes REST/GraphQL fixtures and normalizes real shapes', async () => {
  const p = pull(1, { id: 4964900434, body: '- Fixes #1',
    user: { login: 'Copilot', type: 'Bot', id: 198982749, node_id: 'BOT_kgDOC9w8XQ' } });
  p.files.push({ filename: 'README.md' });
  p.comments[0].user = p.user;
  const rest = { ...p, changed_files: p.files.length, requested_reviewers: [], merge_commit_sha: OTHER };
  const root = `repos/${REPO}`, paths = [];
  const api = new GitHub({ invoke: async (argv, input) => {
    const route = argv[argv.indexOf('--method') + 2];
    paths.push(route);
    let data;
    if (route === 'user') data = { login: 'operator' };
    else if (route === `${root}/git/ref/heads/master`) data = { object: { sha: BASE } };
    else if (route.startsWith(`agents/repos/${REPO}/tasks?`)) data = { tasks: [{
      id: 'real-task-id', state: 'completed', artifacts: [
        { provider: 'github', type: 'pull', data: { id: p.id, global_id: '' } },
        { provider: 'github', type: 'branch', data: { base_ref: 'master', head_ref: p.head.ref } },
      ],
    }] };
    else if (route.startsWith(`${root}/pulls?`)) data = [rest];
    else if (route === `${root}/pulls/22`) data = rest;
    else if (route.startsWith(`${root}/git/trees/`)) data = { truncated: false, tree: [
      { type: 'blob', mode: '100644', path: WORKFLOW, sha: OTHER },
    ] };
    else if (route.startsWith(`${root}/pulls/22/files?`)) data = p.files;
    else if (route.startsWith(`${root}/pulls/22/reviews?`)) data = p.reviews;
    else if (route.startsWith(`${root}/pulls/22/comments?`)) data = [];
    else if (route.startsWith(`${root}/issues/22/comments?`)) data = p.comments;
    else if (/\/issues\/\d+\/comments\?/.test(route)) data = [];
    else if (/\/issues\/\d+\/dependencies\/blocked_by\?/.test(route)) data = route.includes('/issues/1/') ? [] : [blocker(99)];
    else if (/\/issues\/\d+$/.test(route)) {
      const number = Number(route.split('/').at(-1));
      data = snapshot().issues[number - 1];
    } else if (route === 'graphql') {
      assert.equal(input.variables.number, 22);
      data = { data: { repository: { pullRequest: {
        closingIssuesReferences: { nodes: [{ number: 1, repository: { nameWithOwner: REPO } }], pageInfo: { hasNextPage: false } },
        reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } },
      } } } };
    } else if (route.startsWith(`${root}/commits/${HEAD}/check-runs?`)) data = { check_runs: p.checks, total_count: 1 };
    else if (route.startsWith(`${root}/commits/${HEAD}/statuses?`)) data = [{ id: 601, context: 'external', state: 'success' }];
    else if (route.startsWith(`${root}/actions/runs?head_sha=`)) data = { workflow_runs: p.runs, total_count: 1 };
    else if (route.startsWith(`${root}/actions/runs?branch=`)) data = { workflow_runs: [{
      id: 999, name: 'Addressing comment on PR #22', head_sha: OTHER, head_branch: p.head.ref,
      head_repository: { full_name: REPO }, status: 'completed', created_at: stamp,
    }], total_count: 1 };
    else if (route.startsWith(`${root}/actions/runs/401/attempts/1/jobs?`)) data = { jobs: [{
      name: 'Validate', head_sha: HEAD, status: 'completed', conclusion: 'success',
    }], total_count: 1 };
    else if (route === `${root}/compare/${BASE}...${HEAD}`) data = { merge_base_commit: { sha: BASE } };
    else throw new Error(`Unexpected fixture route: ${route}`);
    return argv.includes('--include') ? response(data) : JSON.stringify(data);
  } });
  const s = await api.snapshot();
  assert.equal(s.prs[0].statuses[0].sha, HEAD); // actual REST statuses omit SHA
  assert.equal(s.prs[0].checks[0].workflowId, 1);
  assert.equal(s.prs[0].codingRuns[0].head_sha, OTHER);
  assert.deepEqual(s.tasks[0].prIds, [p.id]);
  assert.equal(forIssue(s, 1)[0].kind, 'merge');
  assert.ok(paths.some(p => p.includes('branch=copilot%2Fissue-1')));
});

test('adapter requires REST merged=true and verified master ancestry after merge', async () => {
  const api = new GitHub();
  let merged = false, relation = 'ahead';
  api.api = async route => {
    if (route.endsWith('/pulls/22')) return { merged, base: { ref: 'master' }, head: { sha: HEAD }, merge_commit_sha: OTHER };
    if (route.endsWith('/git/ref/heads/master')) return { object: { sha: BASE } };
    if (route.includes('/compare/')) return { status: relation };
    throw new Error('unexpected route');
  };
  assert.equal(await api.verifyMerge({ pr: 22, head: HEAD }), false);
  merged = true; relation = 'diverged';
  assert.equal(await api.verifyMerge({ pr: 22, head: HEAD }), false);
  relation = 'ahead';
  assert.equal(await api.verifyMerge({ pr: 22, head: HEAD }), true);
});

test('workflow blob proof distinguishes absent/unsafe definitions from incomplete tree reads', async () => {
  const api = new GitHub();
  api.api = async () => ({ truncated: false, tree: [] });
  assert.equal(await api.workflowBlob(HEAD), null);
  api.api = async () => ({ truncated: false, tree: [{ path: WORKFLOW, type: 'blob', mode: '120000', sha: OTHER }] });
  assert.equal(await api.workflowBlob(BASE), null);
  api.api = async () => ({ truncated: true, tree: [] });
  await assert.rejects(api.workflowBlob(OTHER), /truncated/);
});

test('GraphQL pagination or errors fail closed', async () => {
  const api = new GitHub({ invoke: async () => JSON.stringify({ errors: [{ message: 'no access' }] }) });
  await assert.rejects(api.graph(22), /metadata error/);
  api.invoke = async () => JSON.stringify({ data: { repository: { pullRequest: {
    closingIssuesReferences: { nodes: [], pageInfo: { hasNextPage: false } },
    reviewThreads: { nodes: [], pageInfo: { hasNextPage: true } },
  } } } });
  await assert.rejects(api.graph(22), /truncated/);
});

test('adapter bounded wall clock prevents calls after deadline', async () => {
  let clock = 0, calls = 0;
  const api = new GitHub({ now: () => clock, budgetMs: 10, invoke: async () => { calls++; return '{}'; } });
  clock = 11;
  await assert.rejects(api.api('user'), /budget exhausted/);
  assert.equal(calls, 0);
});

test('CLI defaults dry-run and rejects unknown/ambiguous arguments', () => {
  const dir = path.join(os.tmpdir(), 'external-ledger');
  assert.deepEqual(parseArgs(['run', '--state-dir', dir]), { stateDir: path.resolve(dir), apply: false });
  assert.equal(parseArgs(['run', '--apply', '--state-dir', dir]).apply, true);
  assert.throws(() => parseArgs(['run', '--state-dir', dir, '--apply', '--dry-run']));
  assert.throws(() => parseArgs(['run', '--state-dir', 'relative']));
  assert.throws(() => parseArgs(['run', '--unknown']));
});

test('successor prompt preserves scope, evidence honesty, and no routine gate', () => {
  const prompt = taskPrompt(16);
  for (const text of ['base', 'master', 'no production leaderboard writes', 'human/real-device', 'Do not merge', 'backlog-evidence']) assert.ok(prompt.includes(text), text);
});

test('same-second unchanged-head completion clears only a newly observed follow-up run', () => {
  const s = withPr(), state = emptyState();
  state.issues[1] = {
    workPendingHead: HEAD, workPendingAt: new Date(NOW + 750).toISOString(), workPendingRunIds: [10],
  };
  s.prs[0].codingRuns = [{ id: 10, status: 'completed', created_at: stamp }];
  observe(state, s, NOW + 1000);
  assert.equal(state.issues[1].workPendingHead, HEAD);
  s.prs[0].codingRuns.push({ id: 11, status: 'completed', created_at: stamp });
  observe(state, s, NOW + 2000);
  assert.equal(state.issues[1].workPendingHead, undefined);
  assert.equal(state.issues[1].workPendingRunIds, undefined);
});

test('preexisting completed run cannot clear a reservation even at the exact request timestamp', () => {
  const s = withPr(), state = emptyState();
  state.issues[1] = { workPendingHead: HEAD, workPendingAt: stamp, workPendingRunIds: [10] };
  s.prs[0].codingRuns = [{ id: 10, status: 'completed', created_at: stamp }];
  observe(state, s, NOW + 1000);
  assert.equal(state.issues[1].workPendingHead, HEAD);
});

for (const kind of ['evidence', 'repair']) test(`${kind} intent and reservation durably capture pre-request IDs from the fresh snapshot`, async t => {
  const dir = await temp(t), s = withPr();
  if (kind === 'evidence') s.prs[0].comments = [];
  else s.tasks[0].state = 'failed';
  s.prs[0].codingRuns = [{ id: 10, status: 'completed', created_at: stamp }];
  let reads = 0;
  const api = fake(s, {
    snapshot: async () => {
      const copy = clone(s);
      if (++reads > 1) copy.prs[0].codingRuns.push({ id: 11, status: 'completed', created_at: stamp });
      return copy;
    },
    execute: async action => {
      const saved = await loadState(dir);
      assert.equal(action.kind, kind);
      assert.deepEqual(action.preRequestRunIds, [10, 11]);
      assert.deepEqual(saved.inFlight.preRequestRunIds, [10, 11]);
      assert.deepEqual(saved.issues[1].workPendingRunIds, [10, 11]);
    },
  });
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW + 750, log: quiet });
});

test('legacy reservation without pre-request IDs cannot certify unchanged-head completion', () => {
  const s = withPr(), state = emptyState();
  state.issues[1] = { repairPendingHead: HEAD, lastRepairAt: stamp };
  s.prs[0].codingRuns = [{ id: 11, status: 'completed', created_at: new Date(NOW + 1000).toISOString() }];
  observe(state, s, NOW + 2000);
  assert.equal(state.issues[1].repairPendingHead, HEAD);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
  s.prs[0].head.sha = OTHER;
  observe(state, s, NOW + WAIT_MS + 2);
  assert.equal(state.issues[1].repairPendingHead, undefined);
});

test('recovered newer repair marker preserves its bounded wait despite an old checkpoint', () => {
  const s = withPr(), state = emptyState(), reason = 'task task-1 failed', reasonKey = `${HEAD}:${reason}`;
  s.tasks[0].state = 'failed';
  state.issues[1] = { repairs: 1, fingerprints: [reasonKey],
    lastRepairAt: new Date(NOW - WAIT_MS - 1000).toISOString() };
  s.prs[0].comments.push({ user: { login: 'operator' }, created_at: stamp,
    body: `<!-- backlog-dispatcher ${JSON.stringify({ id: 'new-repair', kind: 'repair', issue: 1, reasonKey })} -->` });
  assert.equal(issueLedger(s, state, 1).lastRepairAt, stamp);
  assert.equal(repairOrPark(s, state, s.prs[0], 1, reason, NOW), null);
  assert.equal(repairOrPark(s, state, s.prs[0], 1, reason, NOW + WAIT_MS + 1).kind, 'park');
  state.issues[1].lastRepairAt = new Date(NOW + 2000).toISOString();
  assert.equal(issueLedger(s, state, 1).lastRepairAt, state.issues[1].lastRepairAt);
});

test('newest failed terminal task drives repair fingerprints in either array order', () => {
  for (const reverse of [false, true]) {
    const s = withPr(), state = emptyState();
    const old = { id: 'old-failure', state: 'failed', prIds: [s.prs[0].id],
      created_at: new Date(NOW - 7200000).toISOString() };
    const recent = { id: 'new-failure', state: 'failed', prIds: [s.prs[0].id],
      created_at: new Date(NOW - 3600000).toISOString() };
    s.tasks = reverse ? [recent, old] : [old, recent];
    state.issues[1] = { repairs: 1, fingerprints: [`${HEAD}:task old-failure failed`],
      lastRepairAt: old.created_at };
    const action = forIssue(s, 1, state)[0];
    assert.equal(action?.kind, 'repair');
    assert.equal(action.reasonKey, `${HEAD}:task new-failure failed`);
    assert.equal(action.attempt, 2);
  }
});

test('same-state terminal histories with missing or tied timestamps fail closed', () => {
  for (const created of [undefined, stamp]) {
    for (const reverse of [false, true]) {
      const s = withPr();
      s.tasks = [
        { id: 'one', state: 'failed', prIds: [s.prs[0].id], created_at: stamp },
        { id: 'two', state: 'failed', prIds: [s.prs[0].id], created_at: created },
      ];
      if (reverse) s.tasks.reverse();
      const action = forIssue(s, 1)[0];
      assert.equal(action.kind, 'park');
      assert.match(action.reason, /ambiguous.*task histories/);
    }
  }
});

test('pending CI waits from the latest current-head rerun after an offline interval', () => {
  const s = withPr(), state = emptyState(), old = new Date(NOW - WAIT_MS - 1000).toISOString();
  s.prs[0].runs[0].status = 'queued'; s.prs[0].runs[0].run_attempt = 3;
  s.prs[0].runs[0].conclusion = null;
  state.issues[1] = { observedHead: HEAD, headSeenAt: old, repairs: 0,
    validationReruns: { [`${HEAD}:401:1`]: old, [`${HEAD}:401:2`]: stamp } };
  assert.equal(actions(s, state, NOW + 1000).length, 0);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
  state.issues[1].validationReruns = { [`${OTHER}:401:2`]: stamp };
  assert.equal(actions(s, state, NOW + 1000)[0].kind, 'park');
  assert.equal(state.issues[1].repairs, 0);
});

for (const [kind, change] of [
  ['update', s => { s.prs[0].includesBase = false; }],
  ['ready', s => { s.prs[0].draft = true; }],
  ['merge', () => {}],
  ['evidence', s => { s.prs[0].comments = []; }],
  ['repair', s => { s.tasks[0].state = 'failed'; }],
  ['rerun-validation', s => { s.prs[0].runs[0].conclusion = 'action_required'; }],
  ['review', s => { s.prs[0].reviews = []; }],
]) {
  test(`shared unknown-ownership hold precedes idle PR action ${kind}`, () => {
    for (const taskState of ['queued', 'in_progress']) {
      const s = withPr(); change(s);
      assert.equal(forIssue(s, 1)[0].kind, kind);
      s.tasks.push({ id: 'unknown-writer', state: taskState, prIds: [] });
      const result = plan(s, emptyState(), NOW);
      assert.equal(result.actions.length, 0);
      assert.ok(result.holds.some(h => h.issue === 1 && /ownership.*unknown/.test(h.reason)));
    }
  });
  test(`fresh unknown-ownership race prevents idle PR action ${kind}`, async t => {
    const dir = await temp(t), s = withPr(); change(s);
    let reads = 0;
    const api = fake(s, { snapshot: async () => {
      const copy = clone(s);
      if (++reads > 1) copy.tasks.push({ id: 'unknown-writer', state: 'in_progress', prIds: [] });
      return copy;
    } });
    const result = await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
    assert.equal(result.aborted, true);
    assert.equal(api.calls.length, 0);
    assert.equal((await loadState(dir)).inFlight, null);
  });
}

test('final idle ownership guard precedes branch update and repair gate results', () => {
  for (const overrides of [{ includesBase: false }, { mergeable: false }]) {
    const gate = mergeGate(pull(1, overrides), 1, BASE, { unknownActive: true });
    assert.equal(gate.ownershipHold, true);
    assert.equal(gate.update, undefined);
    assert.equal(gate.repair, undefined);
  }
});

test('ready-triggered same-head validation gets a durable full wait after offline 24h', async t => {
  const dir = await temp(t), s = withPr(1, { draft: true }), state = emptyState();
  state.issues[1] = { observedHead: HEAD, headSeenAt: new Date(NOW - 2 * WAIT_MS).toISOString() };
  await checkpoint(dir, state);
  let time = NOW;
  const api = fake(s);
  const invoke = () => runOnce({ stateDir: dir, apply: true, github: api, now: () => time, log: quiet });
  await invoke();
  assert.deepEqual(api.calls.map(a => a.kind), ['ready']);
  s.prs[0].draft = false;
  s.prs[0].runs.push({ ...s.prs[0].runs[0], id: 402, run_number: 21, status: 'queued', conclusion: null });
  time = NOW + 300000;
  assert.equal((await invoke()).actions.length, 0);
  const start = time;
  time = start + WAIT_MS - 1;
  s.prs[0].runs[1].status = 'in_progress';
  s.prs[0].runs[1].updated_at = new Date(time).toISOString();
  assert.equal((await invoke()).actions.length, 0);
  time = start + WAIT_MS + 1;
  await invoke();
  assert.deepEqual(api.calls.map(a => a.kind), ['ready', 'park']);
  assert.match(api.calls[1].reason, /validation infrastructure wait/);
});

test('trusted run and attempt observations renew once, independently of head age or trigger', async t => {
  const dir = await temp(t), s = withPr(), state = emptyState();
  const old = NOW - 2 * WAIT_MS;
  s.prs[0].runs[0].status = 'queued'; s.prs[0].runs[0].conclusion = null;
  observe(state, s, old);
  await checkpoint(dir, state);
  let ledger = await loadState(dir);
  s.prs[0].runs.push({ ...s.prs[0].runs[0], id: 402, run_number: 21 });
  observe(ledger, s, NOW);
  assert.equal(actions(s, ledger, NOW).length, 0);
  await checkpoint(dir, ledger);
  ledger = await loadState(dir);
  observe(ledger, s, NOW + WAIT_MS + 1);
  assert.equal(actions(s, ledger, NOW + WAIT_MS + 1)[0].kind, 'park');
  s.prs[0].runs[1].run_attempt = 2;
  observe(ledger, s, NOW + WAIT_MS + 2);
  assert.equal(actions(s, ledger, NOW + WAIT_MS + 2).length, 0);
  await checkpoint(dir, ledger);
  ledger = await loadState(dir);
  observe(ledger, s, NOW + 2 * WAIT_MS + 3);
  assert.equal(actions(s, ledger, NOW + 2 * WAIT_MS + 3)[0].kind, 'park');
});

test('older, untrusted, and regressed run observations cannot renew a pending CI clock', () => {
  const s = withPr(), state = emptyState();
  s.prs[0].runs[0].status = 'queued'; s.prs[0].runs[0].conclusion = null;
  const older = { ...s.prs[0].runs[0], id: 400, run_number: 19 };
  observe(state, s, NOW);
  s.prs[0].runs.push(older,
    { ...older, id: 900, run_number: 900, path: '.github/workflows/untrusted.yml' },
    { ...older, id: 901, run_number: 901, head_sha: OTHER },
    { ...older, id: 902, run_number: 902, event: 'push' },
    { ...older, id: 903, run_number: 903, head_branch: 'unrelated' });
  observe(state, s, NOW + WAIT_MS - 1);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
  s.prs[0].runs = [older]; // Temporary remote regression is not a new execution.
  observe(state, s, NOW + WAIT_MS + 2);
  assert.equal(actions(s, state, NOW + WAIT_MS + 2)[0].kind, 'park');
});

test('fresh validation run aborts stale timeout parking and checkpoints its observation', async t => {
  const dir = await temp(t), s = withPr(), state = emptyState();
  s.prs[0].runs[0].status = 'queued'; s.prs[0].runs[0].conclusion = null;
  observe(state, s, NOW - WAIT_MS - 1);
  await checkpoint(dir, state);
  let reads = 0;
  const newer = { ...s.prs[0].runs[0], id: 402, run_number: 21 };
  const api = fake(s, { snapshot: async () => {
    const copy = clone(s);
    if (++reads > 1) copy.prs[0].runs.push(newer);
    return copy;
  } });
  const result = await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.equal(result.aborted, true);
  assert.equal(api.calls.length, 0);
  s.prs[0].runs.push(newer);
  const saved = await loadState(dir);
  assert.equal(actions(s, saved, NOW + WAIT_MS - 1).length, 0);
  assert.equal(actions(s, saved, NOW + WAIT_MS + 1)[0].kind, 'park');
});

test('validation after an update or ordinary push uses the new head run clock, not its head observation', () => {
  const s = withPr(), state = emptyState(), old = NOW - 2 * WAIT_MS;
  observe(state, s, old);
  const p = s.prs[0];
  p.head.sha = OTHER;
  p.comments = [evidence(1, OTHER)];
  p.reviews[0].commit_id = OTHER;
  p.checks[0].head_sha = OTHER;
  const next = { ...p.runs[0], id: 402, run_number: 21, head_sha: OTHER,
    pull_requests: [{ number: p.number, head: { sha: OTHER } }], status: 'queued', conclusion: null };
  observe(state, s, old + 1000); // Head arrived before CI was visible.
  p.runs.push(next);
  observe(state, s, NOW); // Delayed validation appears after another offline interval.
  assert.equal(actions(s, state, NOW).length, 0);
  assert.equal(state.issues[1].validationObservations[HEAD].observedAt, new Date(old).toISOString());
  assert.equal(state.issues[1].validationObservations[OTHER].observedAt, stamp);
  observe(state, s, NOW + WAIT_MS - 1);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
});

for (const waiting of ['checks', 'statuses']) test(`pending ${waiting} share the selected validation run clock`, () => {
  const s = withPr(), state = emptyState();
  observe(state, s, NOW - 2 * WAIT_MS);
  s.prs[0].runs.push({ ...s.prs[0].runs[0], id: 402, run_number: 21 });
  if (waiting === 'checks') s.prs[0].checks[0].status = 'queued';
  else s.prs[0].statuses = [{ id: 1, context: 'other-check', sha: HEAD, state: 'pending' }];
  observe(state, s, NOW);
  assert.equal(actions(s, state, NOW).length, 0);
  observe(state, s, NOW + WAIT_MS - 1);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1)[0].kind, 'park');
});

test('untrusted or ambiguous execution identities cannot replace the persisted trusted clock', () => {
  for (const change of [
    r => { r.path = '.github/workflows/untrusted.yml'; },
    r => { r.name = 'Other workflow'; },
    r => { r.head_repository = { full_name: 'other/repo' }; },
    r => { r.head_branch = 'other-branch'; },
    r => { r.head_sha = OTHER; },
    r => { r.event = 'push'; },
    r => { r.workflow_id = 999; },
    r => { delete r.run_attempt; },
    r => { r.run_number = 20; }, // Same run number but different ID is ambiguous.
  ]) {
    const s = withPr(), state = emptyState();
    s.prs[0].runs[0].status = 'queued'; s.prs[0].runs[0].conclusion = null;
    observe(state, s, NOW);
    const before = clone(state.issues[1].validationObservations);
    const untrusted = { ...s.prs[0].runs[0], id: 999, run_number: 999 };
    change(untrusted);
    s.prs[0].runs.push(untrusted);
    observe(state, s, NOW + WAIT_MS - 1);
    assert.deepEqual(state.issues[1].validationObservations, before);
    assert.equal(ciGate(s.prs[0]).ok, false);
  }
});

test('persisted validation run identities and observation dates are schema-validated', async t => {
  const dir = await temp(t), state = emptyState(), s = withPr();
  observe(state, s, NOW);
  await checkpoint(dir, state);
  for (const change of [
    r => { r.runAttempt = 0; },
    r => { r.observedAt = 'not-a-date'; },
    r => { delete r.runId; },
  ]) {
    const invalid = clone(state);
    change(invalid.issues[1].validationObservations[HEAD]);
    await assert.rejects(checkpoint(dir, invalid), /Invalid validation observation/);
    assert.deepEqual(await loadState(dir), state);
  }
});

async function startStoppedRepair(t, taskState = 'failed', extraTasks = []) {
  const dir = await temp(t), s = withPr();
  Object.assign(s.tasks[0], { state: taskState, created_at: new Date(NOW - 1000).toISOString(),
    updated_at: stamp, session_count: 1 });
  s.tasks.push(...extraTasks);
  s.prs[0].codingRuns = [{ id: 10, status: 'completed', conclusion: 'success', created_at: stamp }];
  const api = fake(s);
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW + 750, log: quiet });
  assert.equal(api.calls[0].kind, 'repair');
  s.prs[0].comments.push({ user: { login: s.viewer }, created_at: stamp,
    body: `<!-- backlog-dispatcher ${JSON.stringify(api.calls[0])} -->` });
  const state = await loadState(dir);
  reconcile(state, s, quiet);
  return { dir, s, state, action: api.calls[0] };
}

function setRepairedHead(s, head) {
  const p = s.prs[0];
  p.head.sha = head;
  p.comments = [evidence(1, head), ...p.comments.filter(c => c.user?.login === s.viewer)];
  p.reviews[0].commit_id = head;
  p.checks[0].head_sha = head;
  p.runs[0].head_sha = head;
  p.runs[0].pull_requests[0].head.sha = head;
  p.workflowDefinition.headCommit = head;
}

function completedFollowup(s, conclusion = 'success') {
  // Run's source SHA can precede the repair's pushed commit; branch identity
  // and durable pre-request run IDs, not timestamps or head equality, correlate it.
  s.prs[0].codingRuns.push({ id: 11, status: 'completed', conclusion, created_at: stamp, head_sha: HEAD });
}

for (const taskState of ['failed', 'idle', 'waiting_for_user', 'timed_out', 'cancelled']) {
  for (const head of [HEAD, OTHER]) {
    test(`successful correlated follow-up supersedes ${taskState} REST task with ${head === HEAD ? 'unchanged' : 'changed'} head`, async t => {
      const { dir, s, state } = await startStoppedRepair(t, taskState);
      setRepairedHead(s, head);
      completedFollowup(s);
      observe(state, s, NOW + 2000);
      assert.equal(state.issues[1].workPendingHead, undefined);
      assert.equal(forIssue(s, 1, state)[0]?.kind, 'merge');
      assert.equal(state.issues[1].repairs, 1);
      await checkpoint(dir, state);
      const restored = await loadState(dir);
      observe(restored, s, NOW + WAIT_MS + 1);
      assert.equal(actions(s, restored, NOW + WAIT_MS + 1)[0]?.kind, 'merge');
      assert.equal(restored.issues[1].repairs, 1);
    });
  }
}

test('head change alone preserves pending correlation and cannot certify a successful repair', async t => {
  const { s, state } = await startStoppedRepair(t);
  setRepairedHead(s, OTHER);
  observe(state, s, NOW + 1000);
  assert.equal(state.issues[1].workPendingHead, HEAD);
  assert.equal(Object.keys(state.issues[1].supersededStoppedTasks ?? {}).length, 0);
  assert.equal(forIssue(s, 1, state).length, 0);
  assert.equal(actions(s, state, NOW + WAIT_MS + 1000)[0].kind, 'park');
  completedFollowup(s);
  observe(state, s, NOW + 2000);
  assert.equal(forIssue(s, 1, state)[0].kind, 'merge');
});

test('repair success supersedes all captured stopped histories, not just the latest one', async t => {
  const older = { id: 'older-stopped-task', state: 'idle', prIds: [1001], session_count: 1,
    created_at: new Date(NOW - 3000).toISOString(), updated_at: new Date(NOW - 2000).toISOString() };
  const { s, state } = await startStoppedRepair(t, 'failed', [older]);
  completedFollowup(s);
  observe(state, s, NOW + 2000);
  assert.equal(Object.keys(state.issues[1].supersededStoppedTasks ?? {}).length, 2);
  assert.equal(forIssue(s, 1, state)[0].kind, 'merge');
});

for (const revision of ['new task ID', 'updated timestamp', 'session count']) {
  test(`genuinely new stopped failure (${revision}) still requires repair on unchanged head`, async t => {
    const { s, state } = await startStoppedRepair(t);
    completedFollowup(s);
    observe(state, s, NOW + 2000);
    assert.equal(forIssue(s, 1, state)[0]?.kind, 'merge');
    if (revision === 'new task ID') s.tasks.push({ ...s.tasks[0], id: 'new-failure',
      created_at: new Date(NOW + 1000).toISOString(), updated_at: new Date(NOW + 1000).toISOString() });
    // Preserve sub-millisecond server revision precision, unlike Date.parse().
    else if (revision === 'updated timestamp') s.tasks[0].updated_at = '2026-10-22T12:00:00.000000001Z';
    else s.tasks[0].session_count++;
    observe(state, s, NOW + 3000);
    const action = forIssue(s, 1, state)[0];
    assert.equal(action?.kind, 'repair');
    assert.equal(action.attempt, 2);
  });
}

test('failure appearing during a successful follow-up is not part of the pre-request supersession set', async t => {
  const { s, state } = await startStoppedRepair(t);
  s.tasks.push({ ...s.tasks[0], id: 'new-during-followup', created_at: new Date(NOW + 1000).toISOString(),
    updated_at: new Date(NOW + 1000).toISOString() });
  completedFollowup(s);
  observe(state, s, NOW + 2000);
  const action = forIssue(s, 1, state)[0];
  assert.equal(action.kind, 'repair');
  assert.match(action.reason, /new-during-followup/);
});

for (const conclusion of ['failure', 'cancelled', undefined]) {
  test(`completed follow-up with ${conclusion ?? 'missing'} conclusion does not supersede stopped tasks`, async t => {
    const { s, state } = await startStoppedRepair(t);
    setRepairedHead(s, OTHER);
    completedFollowup(s);
    s.prs[0].codingRuns.at(-1).conclusion = conclusion;
    observe(state, s, NOW + 2000);
    assert.equal(Object.keys(state.issues[1].supersededStoppedTasks ?? {}).length, 0);
    assert.equal(forIssue(s, 1, state)[0].kind, 'repair');
  });
}

for (const head of [HEAD, OTHER]) {
  test(`failed correlated Actions execution blocks merge despite completed REST telemetry (${head === HEAD ? 'same' : 'changed'} head)`, async t => {
    const { s, state } = await startStoppedRepair(t);
    setRepairedHead(s, head);
    s.tasks[0].state = 'completed'; // REST cannot certify the failed follow-up.
    completedFollowup(s, 'failure');
    observe(state, s, NOW + 2000);
    assert.equal(Object.keys(state.issues[1].supersededStoppedTasks ?? {}).length, 0);
    assert.equal(forIssue(s, 1, state)[0]?.kind, 'repair');
  });
}

for (const mode of ['new run', 'new attempt']) {
  test(`later Actions failure (${mode}) remains actionable after successful stopped-task repair`, async t => {
    const { s, state } = await startStoppedRepair(t);
    completedFollowup(s);
    observe(state, s, NOW + 2000);
    assert.equal(forIssue(s, 1, state)[0]?.kind, 'merge');
    if (mode === 'new run') s.prs[0].codingRuns.push({
      id: 12, status: 'completed', conclusion: 'failure', created_at: stamp, head_sha: HEAD,
    });
    else Object.assign(s.prs[0].codingRuns.at(-1), { run_attempt: 2, conclusion: 'failure' });
    observe(state, s, NOW + 3000);
    const action = forIssue(s, 1, state)[0];
    assert.equal(action?.kind, 'repair');
    assert.equal(action.attempt, 2);
  });
}

test('final merge fence rejects a later failed Actions execution after a successful repair', async t => {
  const { dir, s, state } = await startStoppedRepair(t);
  completedFollowup(s);
  observe(state, s, NOW + 2000);
  await checkpoint(dir, state);
  const api = fake(s, { pull: async () => {
    const p = clone(s.prs[0]);
    p.codingRuns.push({ id: 12, status: 'completed', conclusion: 'failure', created_at: stamp });
    return p;
  } });
  const result = await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW + 3000, log: quiet });
  assert.equal(result.aborted, true);
  assert.equal(api.calls.length, 0);
});

test('stopped-task revisions and PR ownership are journaled before the follow-up request', async t => {
  const dir = await temp(t), s = withPr();
  Object.assign(s.tasks[0], { state: 'failed', created_at: stamp, updated_at: stamp, session_count: 1 });
  let inspected = false;
  const api = fake(s, { execute: async action => {
    const saved = await loadState(dir);
    assert.equal(saved.inFlight.status, 'prepared');
    assert.equal(action.preRequestStoppedTasks.length, 1);
    assert.match(action.preRequestStoppedTasks[0], /^task-1:[a-f0-9]{64}$/);
    assert.deepEqual(saved.inFlight.preRequestStoppedTasks, action.preRequestStoppedTasks);
    assert.deepEqual(saved.issues[1].workPendingStoppedTasks, action.preRequestStoppedTasks);
    assert.equal(saved.issues[1].workPendingPrId, s.prs[0].id);
    assert.equal(saved.inFlight.prId, s.prs[0].id);
    inspected = true;
  } });
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW, log: quiet });
  assert.equal(inspected, true);
});

test('a subsequent successful correlated retry acknowledges its earlier failed Actions run', async t => {
  const { dir, s, state } = await startStoppedRepair(t);
  completedFollowup(s, 'failure');
  observe(state, s, NOW + 2000);
  await checkpoint(dir, state);
  const api = fake(s);
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW + 3000, log: quiet });
  assert.equal(api.calls[0].kind, 'repair');
  assert.equal(api.calls[0].attempt, 2);
  s.prs[0].comments.push({ user: { login: s.viewer }, created_at: stamp,
    body: `<!-- backlog-dispatcher ${JSON.stringify(api.calls[0])} -->` });
  setRepairedHead(s, OTHER);
  s.prs[0].codingRuns.push({ id: 12, status: 'completed', conclusion: 'success', created_at: stamp });
  await runOnce({ stateDir: dir, apply: true, github: api, now: () => NOW + 4000, log: quiet });
  assert.deepEqual(api.calls.map(a => a.kind), ['repair', 'merge']);
  assert.equal((await loadState(dir)).issues[1].repairs, 2);
});

test('partial success cannot hide another correlated execution that is running or failed', async t => {
  const { s, state } = await startStoppedRepair(t);
  completedFollowup(s);
  s.prs[0].codingRuns.push({ id: 12, status: 'in_progress', conclusion: null, created_at: stamp });
  observe(state, s, NOW + 2000);
  assert.equal(state.issues[1].workPendingHead, HEAD);
  assert.equal(Object.keys(state.issues[1].supersededStoppedTasks ?? {}).length, 0);
  assert.equal(forIssue(s, 1, state).length, 0);
  Object.assign(s.prs[0].codingRuns.at(-1), { status: 'completed', conclusion: 'failure' });
  observe(state, s, NOW + 3000);
  assert.equal(Object.keys(state.issues[1].supersededStoppedTasks ?? {}).length, 0);
  assert.equal(forIssue(s, 1, state)[0].kind, 'repair');
});

test('missing stopped-task revision metadata cannot inherit historical supersession', async t => {
  const { s, state } = await startStoppedRepair(t);
  completedFollowup(s);
  observe(state, s, NOW + 2000);
  delete s.tasks[0].updated_at;
  assert.equal(forIssue(s, 1, state)[0].kind, 'repair');
});

test('malformed supersession proof fails ledger validation', async t => {
  const { dir, s, state } = await startStoppedRepair(t);
  completedFollowup(s);
  observe(state, s, NOW + 2000);
  await checkpoint(dir, state);
  const invalid = clone(state), revision = Object.keys(invalid.issues[1].supersededStoppedTasks)[0];
  invalid.issues[1].supersededStoppedTasks[revision].runIds = [];
  await assert.rejects(checkpoint(dir, invalid), /Invalid stopped-task supersession/);
  assert.deepEqual(await loadState(dir), state);
});

test('a completed task cannot hide a new failure revision of a superseded older task', async t => {
  const { s, state } = await startStoppedRepair(t);
  completedFollowup(s);
  observe(state, s, NOW + 2000);
  s.tasks.push({ ...s.tasks[0], id: 'later-created-completed', state: 'completed',
    created_at: new Date(NOW + 1000).toISOString(), updated_at: new Date(NOW + 2000).toISOString() });
  s.tasks[0].updated_at = new Date(NOW + 3000).toISOString();
  s.tasks[0].session_count++;
  const action = forIssue(s, 1, state)[0];
  assert.equal(action.kind, 'repair');
  assert.match(action.reason, /task-1/);
});
