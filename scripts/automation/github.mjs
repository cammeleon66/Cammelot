import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { REPO, BASE, ISSUES, WORKFLOW, REVIEWER, CODER, isSha, isCoder, isCodingRun, closingRefs, taskPrompt } from './policy.mjs';

const ROOT = `repos/${REPO}`;
const MAX_PAGES = 10;
const MAX_OUTPUT = 16 * 1024 * 1024;
const required = (condition, message) => { if (!condition) throw new Error(message); };

// No shell, cmd.exe, interpolation, or token extraction. gh.exe uses the logged-in
// user's existing credential store; request bodies travel over stdin, not argv.
export function invokeGh(args, input, { timeout = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'gh.exe' : 'gh', args, {
      shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1', GH_PAGER: '', PAGER: '' },
    });
    const stdout = [], stderr = [];
    let size = 0, failure;
    const timer = setTimeout(() => { failure = new Error('gh subprocess timeout (outcome may be unknown)'); child.kill(); }, timeout);
    const collect = target => chunk => {
      size += chunk.length;
      if (size > MAX_OUTPUT) { failure = new Error('gh response exceeded bounded output'); child.kill(); }
      else target.push(chunk);
    };
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.stdin.on('error', () => {}); // EPIPE is reflected in process exit.
    child.on('close', code => {
      clearTimeout(timer);
      if (failure) reject(failure);
      // Do not log stderr: authentication errors could contain sensitive values.
      else if (code !== 0) reject(new Error(`gh failed (exit ${code}); remote outcome must be reconciled`));
      else resolve(Buffer.concat(stdout).toString('utf8'));
    });
    child.stdin.end(input === undefined ? undefined : JSON.stringify(input));
  });
}

async function mapBounded(values, fn) {
  const result = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, values.length) }, async () => {
    while (cursor < values.length) { const i = cursor++; result[i] = await fn(values[i]); }
  }));
  return result;
}

export class GitHub {
  constructor({ invoke = invokeGh, allowWrites = false, now = () => performance.now(), budgetMs = 240_000 } = {}) {
    this.invoke = invoke;
    this.allowWrites = allowWrites;
    this.now = now;
    this.deadline = now() + budgetMs;
    this.calls = 0;
    this.workflowBlobs = new Map();
  }

  async gh(args, input, mutation = false) {
    if (mutation && !this.allowWrites) throw new Error('Remote mutations disabled');
    if (this.now() >= this.deadline || ++this.calls > 1200) throw new Error('Bounded invocation budget exhausted');
    return this.invoke(args, input, { timeout: Math.min(30_000, this.deadline - this.now()) });
  }

  async api(path, { method = 'GET', body, withHeaders = false } = {}) {
    // GraphQL POST is query-only. All other non-GET requests require apply.
    const queryOnly = path === 'graphql' && body?.query?.trimStart().startsWith('query ');
    const args = ['api', '--method', method, path, '-H', 'Accept: application/vnd.github+json',
      '-H', 'X-GitHub-Api-Version: 2022-11-28'];
    if (body !== undefined) args.push('--input', '-');
    if (withHeaders) args.push('--include');
    let text = await this.gh(args, body, method !== 'GET' && !queryOnly);
    const headers = {};
    if (withHeaders) {
      const split = text.search(/\r?\n\r?\n/);
      required(split >= 0 && /^HTTP\/[\d.]+\s+2\d\d\b/.test(text), 'Missing successful response headers');
      const rawHeaders = text.slice(0, split);
      text = text.slice(split).replace(/^\r?\n\r?\n/, '');
      for (const line of rawHeaders.split(/\r?\n/).slice(1)) {
        const colon = line.indexOf(':');
        required(colon > 0, 'Malformed response header');
        const key = line.slice(0, colon).toLowerCase();
        headers[key] = [headers[key], line.slice(colon + 1).trim()].filter(Boolean).join(', ');
      }
    }
    let data;
    try { data = text.trim() ? JSON.parse(text) : null; } catch { throw new Error('Invalid JSON from gh'); }
    return withHeaders ? { data, headers } : data;
  }

  async pages(path, key) {
    const result = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const requestPath = `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`;
      const { data, headers } = await this.api(requestPath, { withHeaders: true });
      const rows = key ? data?.[key] : data;
      required(Array.isArray(rows), `Missing collection ${key ?? path}`);
      const next = headers.link?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
      if (next) {
        const target = new URL(next), expected = new URL(`https://api.github.com/${requestPath}`);
        required(target.origin === expected.origin && target.pathname === expected.pathname &&
          target.searchParams.get('page') === String(page + 1) && target.searchParams.get('per_page') === '100',
        'Unsupported/unsafe pagination link');
      }
      required(!data?.next_cursor && !data?.next_page_token && !data?.next && !data?.has_more, 'Unsupported cursor pagination');
      if (data?.total_count !== undefined) required(Number.isSafeInteger(data.total_count) && data.total_count <= MAX_PAGES * 100, 'Collection exceeds bounded pagination');
      result.push(...rows);
      if (rows.length < 100 && !next) {
        if (data?.total_count !== undefined) required(result.length === data.total_count, 'Truncated/inconsistent collection');
        if (result.every(r => r?.id !== undefined)) required(new Set(result.map(r => r.id)).size === result.length, 'Duplicate/inconsistent paginated IDs');
        return result;
      }
    }
    throw new Error('Pagination bound reached; refusing incomplete metadata');
  }

  async mergedPull(number, baseSha) {
    // Completed issues need only identity/scope/ancestry proof for dependency
    // readiness, not every historical CI run/review on every five-minute poll.
    const p = await this.api(`${ROOT}/pulls/${number}`);
    required(p?.number === number && typeof p.merged === 'boolean', 'Missing historical PR metadata');
    const files = await this.pages(`${ROOT}/pulls/${number}/files`);
    required(files.length === p.changed_files, 'Incomplete historical file list');
    let mergeInBase = false;
    if (p.merged) {
      required(isSha(p.merge_commit_sha), 'Missing historical merge SHA');
      const comparison = await this.api(`${ROOT}/compare/${p.merge_commit_sha}...${baseSha}`);
      required(['ahead', 'behind', 'identical', 'diverged'].includes(comparison?.status), 'Missing historical merge ancestry');
      mergeInBase = ['ahead', 'identical'].includes(comparison.status);
    }
    return { ...p, files, mergeInBase };
  }

  async base() {
    const ref = await this.api(`${ROOT}/git/ref/heads/${BASE}`);
    required(isSha(ref?.object?.sha), 'Missing master SHA');
    return ref.object.sha;
  }

  async workflowBlob(commit) {
    required(isSha(commit), 'Workflow definition requires an immutable commit');
    if (!this.workflowBlobs.has(commit)) {
      this.workflowBlobs.set(commit, this.api(`${ROOT}/git/trees/${commit}?recursive=1`).then(tree => {
        required(Array.isArray(tree?.tree) && tree.truncated === false, 'Missing/truncated workflow tree metadata');
        const matches = tree.tree.filter(file => file.path === WORKFLOW);
        required(matches.length <= 1, 'Ambiguous workflow tree path');
        const file = matches[0];
        // A verified absent/nonregular definition is a per-PR authorization
        // hold, not a global metadata failure that blocks unrelated issues.
        if (!file || file.type !== 'blob' || !['100644', '100755'].includes(file.mode)) return null;
        required(isSha(file.sha), 'Missing trusted workflow blob SHA');
        return file.sha;
      }));
    }
    return this.workflowBlobs.get(commit);
  }

  async graph(number) {
    const response = await this.api('graphql', { method: 'POST', body: {
      query: `query BacklogPR($number:Int!) {
        repository(owner:"cammeleon66",name:"Cammelot") {
          pullRequest(number:$number) {
            closingIssuesReferences(first:100) { nodes { number repository { nameWithOwner } } pageInfo { hasNextPage } }
            reviewThreads(first:100) { nodes { isResolved } pageInfo { hasNextPage } }
          }
        }
      }`,
      variables: { number },
    } });
    required(!response.errors, 'GraphQL metadata error');
    const p = response.data?.repository?.pullRequest;
    for (const name of ['closingIssuesReferences', 'reviewThreads']) {
      required(Array.isArray(p?.[name]?.nodes) && p[name].pageInfo?.hasNextPage === false, 'Missing/truncated PR graph metadata');
    }
    required(p.reviewThreads.nodes.every(t => typeof t.isResolved === 'boolean'), 'Missing review thread resolution metadata');
    required(p.closingIssuesReferences.nodes.every(i => Number.isSafeInteger(i.number) && typeof i.repository?.nameWithOwner === 'string'), 'Missing closing reference identity');
    return { closingRefs: p.closingIssuesReferences.nodes.map(n => ({ number: n.number, repo: n.repository.nameWithOwner })),
      threads: p.reviewThreads.nodes };
  }

  async pull(number, baseSha) {
    required(Number.isSafeInteger(number) && number > 0, 'Invalid PR number');
    const p = await this.api(`${ROOT}/pulls/${number}`);
    required(p?.number === number && isSha(p.head?.sha) && typeof p.merged === 'boolean' &&
      typeof p.draft === 'boolean' && typeof p.updated_at === 'string' &&
      typeof p.head.ref === 'string' && typeof p.base?.ref === 'string' &&
      typeof p.base?.repo?.full_name === 'string' && typeof p.user?.login === 'string' &&
      Array.isArray(p.requested_reviewers), 'Incomplete PR metadata');
    const sha = p.head.sha;
    const [graph, files, reviews, reviewComments, comments, checks, statuses, runs, comparison, branchRuns, baseBlob, headBlob] = await Promise.all([
      this.graph(number),
      this.pages(`${ROOT}/pulls/${number}/files`),
      this.pages(`${ROOT}/pulls/${number}/reviews`),
      this.pages(`${ROOT}/pulls/${number}/comments`),
      this.pages(`${ROOT}/issues/${number}/comments`),
      this.pages(`${ROOT}/commits/${sha}/check-runs?filter=all`, 'check_runs'),
      this.pages(`${ROOT}/commits/${sha}/statuses`),
      this.pages(`${ROOT}/actions/runs?head_sha=${sha}`, 'workflow_runs'),
      this.api(`${ROOT}/compare/${baseSha}...${sha}`),
      this.pages(`${ROOT}/actions/runs?branch=${encodeURIComponent(p.head.ref)}`, 'workflow_runs'),
      this.workflowBlob(baseSha), this.workflowBlob(sha),
    ]);
    required(files.length === p.changed_files, 'Incomplete PR file list');
    required(files.every(f => typeof f.filename === 'string'), 'Missing changed file path');
    for (const c of comments) required(Number.isSafeInteger(c.id) && typeof c.body === 'string' &&
      typeof c.user?.login === 'string' && Number.isFinite(Date.parse(c.created_at)), 'Incomplete PR comment metadata');
    required(isSha(comparison?.merge_base_commit?.sha), 'Missing base comparison');
    for (const r of reviews) required(Number.isSafeInteger(r.id) && r.user?.login && typeof r.state === 'string' && isSha(r.commit_id), 'Incomplete review');
    for (const c of checks) {
      required(c.name && c.status && isSha(c.head_sha) && Number.isSafeInteger(c.app?.id), 'Incomplete check');
      if (c.app.slug === 'github-actions') {
        const identities = new Set(runs.filter(r => r.check_suite_id === c.check_suite?.id).map(r => r.workflow_id));
        required(identities.size === 1 && Number.isSafeInteger([...identities][0]), 'Missing/ambiguous check workflow identity');
        c.workflowId = [...identities][0];
      }
    }
    // REST status objects omit sha; the commit-scoped request is authoritative.
    for (const s of statuses) {
      required(s.context && s.state && Number.isSafeInteger(s.id), 'Incomplete status');
      s.sha = sha;
    }
    // Exact trusted workflow + source SHA. Never accept "zero checks".
    for (const r of runs.filter(r => r.path === WORKFLOW && r.head_sha === sha)) {
      required(Number.isSafeInteger(r.id) && Number.isSafeInteger(r.run_number) && Number.isSafeInteger(r.run_attempt), 'Incomplete workflow run');
      const jobs = await this.pages(`${ROOT}/actions/runs/${r.id}/attempts/${r.run_attempt}/jobs`, 'jobs');
      r.validateJob = jobs.some(j => j.name === 'Validate' && j.head_sha === sha && j.status === 'completed' && j.conclusion === 'success');
    }
    let mergeInBase = false;
    if (p.merged) {
      required(isSha(p.merge_commit_sha), 'Missing merge commit');
      const ancestry = await this.api(`${ROOT}/compare/${p.merge_commit_sha}...${baseSha}`);
      required(['ahead', 'behind', 'identical', 'diverged'].includes(ancestry?.status), 'Missing merge ancestry');
      mergeInBase = ['ahead', 'identical'].includes(ancestry.status);
    }
    const codingRuns = branchRuns.filter(isCodingRun);
    for (const r of codingRuns) required(Number.isSafeInteger(r.id) && r.head_branch === p.head.ref &&
      Number.isFinite(Date.parse(r.created_at)) &&
      r.head_repository?.full_name?.toLowerCase() === REPO.toLowerCase(), 'Missing branch coding run identity');
    return { ...p, ...graph, files, reviews, reviewComments, comments, checks, statuses, runs, codingRuns,
      workflowDefinition: { baseCommit: baseSha, headCommit: sha, baseBlob, headBlob },
      baseChecked: baseSha, includesBase: comparison.merge_base_commit.sha === baseSha, mergeInBase,
      reviewRequested: (p.requested_reviewers ?? []).some(u => u.login === REVIEWER || u.login === 'Copilot') };
  }

  async snapshot() {
    const [user, baseSha, tasks, pulls] = await Promise.all([
      this.api('user'), this.base(),
      this.pages(`agents/repos/${REPO}/tasks`, 'tasks'),
      this.pages(`${ROOT}/pulls?state=all&sort=created&direction=asc`),
    ]);
    required(typeof user?.login === 'string', 'Missing authenticated viewer');
    for (const t of tasks) {
      required((typeof t.id === 'string' || Number.isSafeInteger(t.id)) && typeof t.state === 'string' && Array.isArray(t.artifacts), 'Incomplete task metadata');
      t.prIds = t.artifacts.filter(a => a.provider === 'github' && a.type === 'pull').map(a => {
        required(Number.isSafeInteger(a.data?.id), 'Invalid task PR artifact ID');
        return a.data.id;
      });
    }
    required(new Set(tasks.map(t => String(t.id))).size === tasks.length, 'Duplicate/inconsistent task pagination');
    const issues = await mapBounded(ISSUES, async n => {
      const [i, blockers, comments] = await Promise.all([
        this.api(`${ROOT}/issues/${n}`), this.pages(`${ROOT}/issues/${n}/dependencies/blocked_by`),
        this.pages(`${ROOT}/issues/${n}/comments`),
      ]);
      required(i?.number === n && !i.pull_request && ['open', 'closed'].includes(i.state) &&
        Array.isArray(i.assignees) && Array.isArray(i.labels) && typeof i.updated_at === 'string', `Incomplete issue #${n}`);
      for (const b of blockers) required(Number.isSafeInteger(b.number) && typeof b.repository_url === 'string', 'Incomplete blocker metadata');
      return { ...i, blockers, comments };
    });
    // Unrelated human/bootstrap PRs are never actionable. Open coding PRs still
    // count as resource consumers even when their association is unknown.
    const candidates = pulls.filter(p => (isCoder(p.user) && p.state === 'open') ||
      closingRefs(p.body).some(r => ISSUES.includes(r.number) && r.repo.toLowerCase() === REPO.toLowerCase()));
    const prs = await mapBounded(candidates, p => {
      const refs = closingRefs(p.body);
      const finished = refs.length === 1 && issues.some(i => i.number === refs[0].number && i.state === 'closed');
      return p.state === 'closed' && finished ? this.mergedPull(p.number, baseSha) : this.pull(p.number, baseSha);
    });
    return { viewer: user.login, baseSha, tasks, issues, prs };
  }

  async comment(number, body) {
    return this.api(`${ROOT}/issues/${number}/comments`, { method: 'POST', body: { body } });
  }

  async verifyMerge(action) {
    const p = await this.api(`${ROOT}/pulls/${action.pr}`);
    if (p?.merged !== true || p.base?.ref !== BASE || p.head?.sha !== action.head || !isSha(p.merge_commit_sha)) return false;
    const currentBase = await this.base();
    const comparison = await this.api(`${ROOT}/compare/${p.merge_commit_sha}...${currentBase}`);
    return ['ahead', 'identical'].includes(comparison?.status);
  }

  async execute(action) {
    required(ISSUES.includes(action.issue), 'Mutation outside allowlist');
    const n = action.pr;
    if (n !== undefined) required(Number.isSafeInteger(n) && n > 0, 'Invalid PR number');
    const marker = `<!-- backlog-dispatcher ${JSON.stringify({
      id: action.id, kind: action.kind, issue: action.issue, head: action.head, reasonKey: action.reasonKey,
    })} -->`;
    switch (action.kind) {
      case 'dispatch':
        return this.api(`${ROOT}/issues/${action.issue}/assignees`, { method: 'POST', body: {
          assignees: [CODER],
          agent_assignment: { target_repo: REPO, base_branch: BASE, custom_instructions: taskPrompt(action.issue) },
        } });
      case 'review':
        return this.gh(['pr', 'edit', String(n), '--repo', REPO, '--add-reviewer', '@copilot'], undefined, true);
      case 'rerun-validation':
        required(Number.isSafeInteger(action.runId) && action.runId > 0 && isSha(action.head) &&
          isSha(action.baseBlob) && action.baseBlob === action.headBlob, 'Invalid guarded validation rerun');
        return this.api(`${ROOT}/actions/runs/${action.runId}/rerun`, { method: 'POST', body: {} });
      case 'evidence':
        return this.comment(n, `@copilot Administrative current-head acceptance re-attestation for issue #${action.issue}, source head ${action.head}.
This is an evidence request, not a failed-code repair. If master was merged into this branch, re-check the current source SHA and honestly refresh the acceptance evidence for that SHA. Post the marker as a PR comment; do not create unnecessary code commits, weaken tests, or fabricate results. Report any genuine gap rather than claiming success. Do not merge or close the issue.
${taskPrompt(action.issue)}
${marker}`);
      case 'repair':
        return this.comment(n, `@copilot Bounded repair ${action.attempt}/3 for issue #${action.issue}, source head ${action.head}.
Reason: ${action.reason}.
Inspect the current PR review threads and checks: https://github.com/${REPO}/pull/${n}/files and https://github.com/${REPO}/pull/${n}/checks .
Fix substantive findings, verify with tests, and resolve ONLY genuinely addressed threads with a reason and the fixing commit. Never blanket-resolve/dismiss threads or fabricate evidence. Latest positive independent review and zero open findings are required. If review assessment is unclear, seek a fresh independent review after changes; never write an approval on the reviewer's behalf.
${taskPrompt(action.issue)}
${marker}`);
      case 'park':
        return this.comment(action.issue, `AUTOMATION PARKED — issue #${action.issue}
${action.reason}
No completion is claimed. Other independent work may continue. Restore missing evidence or fix the failure, then use the documented local recovery procedure.
${marker}`);
      case 'update':
        return this.api(`${ROOT}/pulls/${n}/update-branch`, { method: 'PUT', body: { expected_head_sha: action.head } });
      case 'ready':
        return this.gh(['pr', 'ready', String(n), '--repo', REPO], undefined, true);
      case 'merge':
        required(isSha(action.head), 'Invalid merge head');
        return this.gh(['pr', 'merge', String(n), '--repo', REPO, '--squash', '--match-head-commit', action.head], undefined, true);
      case 'close':
        return this.api(`${ROOT}/issues/${action.issue}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
      default: throw new Error('Unknown action');
    }
  }
}
