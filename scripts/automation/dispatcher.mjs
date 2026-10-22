import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { GitHub } from './github.mjs';
import { ISSUES, BASE, REPO, plan, associatedIssue, isCoder, isSha, mergeGate, pendingWork, validationKey, trustedValidationRun } from './policy.mjs';

export const emptyState = () => ({ version: 1, repo: REPO, base: BASE, issues: {}, inFlight: null });
const logDefault = event => console.log(JSON.stringify(event));
const stateFile = dir => path.join(dir, 'state.json');
const validRunIds = ids => Array.isArray(ids) && ids.every(id => Number.isSafeInteger(id) && id > 0) &&
  new Set(ids).size === ids.length;

export function validateState(state) {
  const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (state?.version !== 1 || state.repo !== REPO || state.base !== BASE ||
    !Object.hasOwn(state, 'inFlight') || !state.issues || Array.isArray(state.issues) ||
    typeof state.issues !== 'object') throw new Error('Invalid/incompatible ledger; restore a known checkpoint');
  for (const [n, e] of Object.entries(state.issues)) {
    if (!ISSUES.includes(Number(n)) || !e || typeof e !== 'object' || Array.isArray(e) ||
      (e.repairs !== undefined && (!Number.isSafeInteger(e.repairs) || e.repairs < 0)) ||
      (e.fingerprints !== undefined && (!Array.isArray(e.fingerprints) || e.fingerprints.some(f => typeof f !== 'string'))) ||
      (e.parked !== undefined && typeof e.parked !== 'boolean')) throw new Error('Invalid issue ledger');
    for (const key of ['resumeAfter', 'lastRepairAt', 'dispatchedAt', 'headSeenAt', 'assignedSeenAt', 'workPendingAt']) {
      if (e[key] !== undefined && !date(e[key])) throw new Error(`Invalid ledger date: ${key}`);
    }
    for (const key of ['repairPendingHead', 'observedHead', 'workPendingHead']) {
      if (e[key] !== undefined && !isSha(e[key])) throw new Error(`Invalid ledger SHA: ${key}`);
    }
    if (e.workPendingRunIds !== undefined && !validRunIds(e.workPendingRunIds)) throw new Error('Invalid pending run IDs');
    if (e.validationObservations !== undefined) {
      const observations = e.validationObservations;
      if (!observations || typeof observations !== 'object' || Array.isArray(observations) ||
        Object.entries(observations).some(([head, r]) => !isSha(head) || !r || typeof r !== 'object' ||
          Array.isArray(r) || !date(r.observedAt) || ['workflowId', 'runId', 'runNumber', 'runAttempt']
            .some(k => !Number.isSafeInteger(r[k]) || r[k] < 1))) throw new Error('Invalid validation observation');
    }
    for (const key of ['reviews', 'updates', 'evidenceRequests', 'validationReruns']) {
      if (e[key] !== undefined && (!e[key] || typeof e[key] !== 'object' || Array.isArray(e[key]) ||
        Object.values(e[key]).some(value => !date(value)))) throw new Error(`Invalid ledger reservations: ${key}`);
    }
  }
  const a = state.inFlight;
  if (a !== null && (!a || typeof a !== 'object' || Array.isArray(a))) throw new Error('Invalid mutation journal');
  if (a?.preRequestRunIds !== undefined && !validRunIds(a.preRequestRunIds)) throw new Error('Invalid journal run IDs');
  if (a && (!ISSUES.includes(a.issue) || typeof a.id !== 'string' || !a.id || !date(a.createdAt) ||
    !['prepared', 'sent'].includes(a.status) ||
    !['dispatch', 'repair', 'evidence', 'rerun-validation', 'park', 'review', 'ready', 'update', 'merge', 'close'].includes(a.kind) ||
    (!['dispatch', 'park'].includes(a.kind) && (!isSha(a.head) || !Number.isSafeInteger(a.pr) || a.pr < 1)) ||
    (['update', 'merge', 'ready', 'rerun-validation'].includes(a.kind) && !isSha(a.base)) ||
    (a.kind === 'rerun-validation' && (!Number.isSafeInteger(a.runId) || a.runId < 1 ||
      !Number.isSafeInteger(a.runAttempt) || a.runAttempt < 1 || !isSha(a.baseBlob) || a.baseBlob !== a.headBlob)))) throw new Error('Invalid mutation journal');
  return state;
}

export async function loadState(dir) {
  try { return validateState(JSON.parse(await readFile(stateFile(dir), 'utf8'))); }
  catch (error) { if (error.code === 'ENOENT') return emptyState(); throw error; }
}

export async function checkpoint(dir, state) {
  validateState(state);
  const temp = path.join(dir, `state.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temp, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`);
    await handle.sync();
    await handle.close(); handle = null;
    await rename(temp, stateFile(dir));
    // Directory fsync is supported on POSIX, not Windows. File sync + same-volume
    // atomic rename is used there. Never delete the previous checkpoint first.
    if (process.platform !== 'win32') {
      const directory = await open(dir, 'r');
      try { await directory.sync(); } finally { await directory.close(); }
    }
  } finally {
    if (handle) await handle.close();
    await rm(temp, { force: true });
  }
}

export async function acquireLock(dir) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const lock = path.join(dir, 'dispatcher.lock');
  try { await mkdir(lock); }
  catch (error) {
    if (error.code === 'EEXIST') throw Object.assign(new Error('Dispatcher lock exists; overlapping or crashed invocation. Never automatically steal it.'), { code: 'LOCKED' });
    throw error;
  }
  // If writing owner metadata fails, preserve the lock: fail closed.
  const handle = await open(path.join(lock, 'owner.json'), 'wx', 0o600);
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    await handle.sync();
  } finally { await handle.close(); }
  return () => rm(lock, { recursive: true });
}

function entry(state, n) { return state.issues[n] ??= {}; }
function hasMarker(comments, action, viewer) {
  return comments.some(c => c.user?.login === viewer && [...String(c.body).matchAll(/<!-- backlog-dispatcher ([^\r\n]+) -->/g)].some(m => {
    try { const marker = JSON.parse(m[1]); return marker.id === action.id && marker.issue === action.issue && marker.kind === action.kind; }
    catch { return false; }
  }));
}

export function observe(state, snapshot, now) {
  for (const i of snapshot.issues) {
    const p = snapshot.prs.find(p => associatedIssue(p) === i.number && p.state === 'open');
    if (!p && !state.issues[i.number] && !i.assignees.some(isCoder)) continue;
    const e = entry(state, i.number);
    if (i.assignees.some(isCoder)) e.assignedSeenAt ??= new Date(now).toISOString();
    if (p && e.observedHead !== p.head.sha) {
      e.observedHead = p.head.sha;
      e.headSeenAt = new Date(now).toISOString();
    }
    if (p) {
      const selected = trustedValidationRun(p);
      if (selected.ok) {
        const run = selected.run, previous = e.validationObservations?.[p.head.sha];
        // Only a genuinely newer run/attempt of the same workflow advances
        // this head's clock. Status/timestamp churn and regressed reads do not.
        if (!previous || (previous.workflowId === run.workflow_id &&
          ((run.run_number > previous.runNumber && run.id !== previous.runId) ||
            (run.id === previous.runId && run.run_number === previous.runNumber && run.run_attempt > previous.runAttempt)))) {
          (e.validationObservations ??= {})[p.head.sha] = {
            workflowId: run.workflow_id, runId: run.id, runNumber: run.run_number,
            runAttempt: run.run_attempt, observedAt: new Date(now).toISOString(),
          };
        }
      }
    }
    const pending = pendingWork(e);
    // Actions timestamps have second precision. Identity, not timestamp
    // rounding, distinguishes a new execution from a pre-request completed run.
    // Legacy reservations without a baseline cannot prove unchanged-head work.
    if (pending.head && (i.state === 'closed' ||
      (p && (p.head.sha !== pending.head || (validRunIds(e.workPendingRunIds) && p.codingRuns?.some(r =>
        r.status === 'completed' && Number.isSafeInteger(r.id) && r.id > 0 && !e.workPendingRunIds.includes(r.id))))))) {
      delete e.repairPendingHead;
      delete e.workPendingHead;
      delete e.workPendingAt;
      delete e.workPendingRunIds;
    }
  }
}

// Reconcile a prepared/sent request from authoritative remote data before ever
// considering another mutation. An uncertain non-idempotent request is not retried.
export function reconcile(state, snapshot, log) {
  const a = state.inFlight;
  if (!a) return;
  const e = entry(state, a.issue);
  const i = snapshot.issues.find(i => i.number === a.issue);
  const p = snapshot.prs.find(p => p.number === a.pr);
  let seen = false;
  switch (a.kind) {
    case 'dispatch': seen = i.assignees.some(isCoder) || snapshot.prs.some(p => associatedIssue(p) === a.issue); break;
    case 'repair':
    case 'evidence': seen = hasMarker(p?.comments ?? [], a, snapshot.viewer); break;
    case 'park': seen = hasMarker(i.comments ?? [], a, snapshot.viewer); break;
    case 'review':
      // The pre-call ledger reserves this head even if gh timed out. Never
      // duplicate a review request just because the requested-reviewer UI cleared.
      seen = true; break;
    case 'update':
      // Asynchronous update-branch can return before the new head is visible.
      // Its head/base reservation prevents duplicates; timeout parks it later.
      seen = true; break;
    case 'rerun-validation':
      // Preserve the reservation after uncertain response. A later snapshot
      // must observe the new attempt/checks; never repeat this attempt blindly.
      seen = true; break;
    case 'ready': seen = p?.draft === false; break;
    case 'merge': seen = p?.merged === true && p.mergeInBase === true; break;
    case 'close': seen = i.state === 'closed' && i.state_reason === 'completed'; break;
  }
  if (!seen) {
    if (a.kind === 'park') {
      e.parked = true;
      e.visibilityUncertain = true;
      log({ level: 'error', event: 'parking-notification-unconfirmed', issue: a.issue, operation: a.id });
    } else {
      e.needsPark = `Uncertain ${a.kind} outcome (${a.id}); remote re-read did not confirm it. No automatic repeat.`;
    }
  }
  log({ level: seen ? 'info' : 'error', event: 'reconciled', issue: a.issue, kind: a.kind, confirmed: seen, operation: a.id });
  state.inFlight = null;
}

function prepare(state, action, now, snapshot) {
  const a = { ...action, id: randomUUID(), createdAt: new Date(now).toISOString(), status: 'prepared' };
  if (['repair', 'evidence'].includes(a.kind)) {
    const p = snapshot.prs.find(p => p.number === a.pr && p.head.sha === a.head);
    const ids = p?.codingRuns?.map(r => r.id);
    if (!validRunIds(ids)) throw new Error('Missing/invalid pre-request coding run IDs');
    a.preRequestRunIds = [...ids].sort((x, y) => x - y);
  }
  const e = entry(state, a.issue);
  if (a.kind === 'dispatch') e.dispatchedAt = a.createdAt;
  if (a.kind === 'repair') {
    e.repairs = a.attempt;
    e.fingerprints = [...new Set([...(e.fingerprints ?? []), a.reasonKey])];
    e.lastRepairAt = a.createdAt;
  }
  if (a.kind === 'evidence') (e.evidenceRequests ??= {})[a.head] = a.createdAt;
  if (a.kind === 'rerun-validation') (e.validationReruns ??= {})[validationKey(a)] = a.createdAt;
  if (['repair', 'evidence'].includes(a.kind)) {
    e.workPendingHead = a.head;
    e.workPendingAt = a.createdAt;
    e.workPendingRunIds = [...a.preRequestRunIds];
    delete e.repairPendingHead;
  }
  if (a.kind === 'review') (e.reviews ??= {})[`${a.head}:${a.evidenceRevision}`] = a.createdAt;
  if (a.kind === 'update') (e.updates ??= {})[`${a.head}:${a.base}`] = a.createdAt;
  if (a.kind === 'park') { e.parked = true; delete e.needsPark; }
  state.inFlight = a;
  return a;
}

function decide(snapshot, state, now) {
  const result = plan(snapshot, state, now);
  const notifications = Object.entries(state.issues).filter(([, e]) => e.needsPark).map(([n, e]) =>
    ({ kind: 'park', issue: Number(n), reason: e.needsPark }));
  result.actions.unshift(...notifications);
  return result;
}

const sameAction = (a, b) => ['kind', 'issue', 'pr', 'head', 'base', 'reason', 'reasonKey',
  'runId', 'runAttempt', 'workflowId', 'baseBlob', 'headBlob', 'evidenceRevision'].every(k => a[k] === b[k]);

export async function runOnce({ stateDir, apply = false, github, now = () => Date.now(), log = logDefault }) {
  if (!stateDir || !path.isAbsolute(stateDir)) throw new Error('--state-dir must be an absolute external directory');
  const adapter = github ?? new GitHub({ allowWrites: apply });
  let release;
  try {
    if (apply) release = await acquireLock(stateDir);
    const state = await loadState(stateDir);
    const snapshot = await adapter.snapshot();
    reconcile(state, snapshot, log); // In-memory only in dry-run.
    observe(state, snapshot, now());
    if (apply) await checkpoint(stateDir, state);
    const result = decide(snapshot, state, now());
    log({ level: 'info', event: 'plan', apply, ...result });
    const candidate = result.actions[0];
    if (!apply || !candidate) return result;

    // Re-read all scheduling, dependency, task, check, review, and association
    // metadata before mutation. No decisions from an old scheduler invocation.
    const fresh = await adapter.snapshot();
    observe(state, fresh, now());
    await checkpoint(stateDir, state); // Preserve new run clocks even if this action is aborted.
    const freshPlan = decide(fresh, state, now());
    if (!freshPlan.actions.some(a => sameAction(a, candidate))) {
      log({ level: 'warn', event: 'changed-before-action', issue: candidate.issue, kind: candidate.kind });
      return { ...result, aborted: true };
    }
    if (candidate.kind === 'merge') {
      const base = await adapter.base();
      const p = await adapter.pull(candidate.pr, base);
      const gate = mergeGate(p, candidate.issue, base, { unknownActive: freshPlan.unknownActive });
      // Last lightweight read immediately before the guarded merge. GitHub
      // match-head-commit makes source-head races fail server-side too.
      const last = await adapter.api(`repos/${REPO}/pulls/${candidate.pr}`);
      const lastBase = await adapter.base();
      if (!gate.ok || p.draft || base !== candidate.base || lastBase !== base ||
        p.head.sha !== candidate.head || last.head?.sha !== candidate.head ||
        last.base?.ref !== BASE || last.state !== 'open') {
        log({ level: 'warn', event: 'merge-fence-changed', issue: candidate.issue });
        return { ...result, aborted: true };
      }
    }
    const action = prepare(state, candidate, now(), fresh);
    await checkpoint(stateDir, state); // Durable intent BEFORE subprocess.
    try {
      await adapter.execute(action);
      if (action.kind === 'merge' && await adapter.verifyMerge(action) !== true) {
        throw new Error('Merge response not verified as merged into master; journal retained');
      }
      state.inFlight.status = 'sent';
      await checkpoint(stateDir, state);
      log({ level: 'info', event: 'mutation-sent', issue: action.issue, kind: action.kind, operation: action.id });
      // Deliberately verify on the next run, including merge ancestry, before
      // issue closure or any new dispatch. One logical mutation per invocation.
      return { ...result, executed: action };
    } catch (error) {
      log({ level: 'error', event: 'mutation-outcome-uncertain', issue: action.issue, kind: action.kind, operation: action.id });
      throw error;
    }
  } finally { if (release) await release(); }
}

export function parseArgs(args) {
  if (args[0] !== 'run') throw new Error('Usage: node dispatcher.mjs run --state-dir ABSOLUTE_PATH [--dry-run | --apply]');
  let stateDir, apply = false, mode;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--state-dir' && !stateDir && args[i + 1]) stateDir = args[++i];
    else if (['--dry-run', '--apply'].includes(args[i]) && !mode) { mode = args[i]; apply = mode === '--apply'; }
    else throw new Error(`Unknown/duplicate argument: ${args[i]}`);
  }
  if (!stateDir || !path.isAbsolute(stateDir)) throw new Error('--state-dir must be an absolute external directory');
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const relative = path.relative(repo, path.resolve(stateDir));
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('State must be outside the installed repository/copy');
  }
  return { stateDir: path.resolve(stateDir), apply };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await runOnce(parseArgs(process.argv.slice(2))); }
  catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'dispatcher-failed', message: error.message, code: error.code ?? 'FAILED' }));
    process.exitCode = error.code === 'LOCKED' ? 75 : 1;
  }
}
