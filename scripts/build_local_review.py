#!/usr/bin/env python3
"""Build a LOCAL-ONLY review website for Cammelot (not for public deploy).

Renders blog posts T5/T6 + the A/B results into a single styled, readable HTML
dashboard at local_review/index.html, and copies the figures it references.
Serve with: python -m http.server 8787 --bind 127.0.0.1  (from repo root)
Open:       http://127.0.0.1:8787/local_review/
Simulation: http://127.0.0.1:8787/site/world.html
"""
import io, os, json, shutil
import markdown

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'local_review')
ASSETS = os.path.join(OUT, 'assets')
os.makedirs(ASSETS, exist_ok=True)

SOCIAL = os.path.join(ROOT, '00_Project_Strategy', 'social')
T5 = os.path.join(SOCIAL, 'series2_tech_post5_living_patient_agent.md')
T6 = os.path.join(SOCIAL, 'series2_tech_post6_chipsoft_dependency.md')
T7 = os.path.join(SOCIAL, 'series2_tech_post7_living_agents_active_brain.md')
CMP = os.path.join(ROOT, 'scripts', 'output', 'persona_ab_comparison.json')
FIGDATA = os.path.join(ROOT, 'scripts', 'output', 'persona_ab_figure_data.txt')


def read(p):
    with io.open(p, 'r', encoding='utf-8') as f:
        return f.read()


def md2html(text):
    return markdown.markdown(text, extensions=['tables', 'fenced_code', 'toc', 'sane_lists'])


# ── copy referenced figures ──
for src in ['world_town_screenshot.png', 'living_patient_stages.svg']:
    s = os.path.join(ROOT, 'scripts', 'output', src)
    if os.path.exists(s):
        shutil.copy2(s, os.path.join(ASSETS, src))

# ── results summary computed live from the JSON ──
j = json.loads(read(CMP))
c = j['cells']


def mean(cell, m):
    return c[cell][m]['mean']


def pct(a, b):
    return round((b - a) / abs(a) * 100, 1) if a else None


D = j['contrasts']['IST_vs_SOLL_ON']['data']   # IST vs SOLL, personalities ON = Cammelot's baseline reality
sd_ist, sd_soll = mean('IST_on', 'system_deaths'), mean('SOLL_on', 'system_deaths')
td_ist, td_soll = mean('IST_on', 'total_deaths'), mean('SOLL_on', 'total_deaths')
pa_soll = mean('SOLL_on', 'proactive_alerts')
bo_ist, bo_soll = mean('IST_on', 'avg_burnout'), mean('SOLL_on', 'avg_burnout')
keten_pct = pct(mean('IST_on', 'ketenzorg_interventions'), mean('SOLL_on', 'ketenzorg_interventions'))

soll_rows = [
    ('Preventable (system) deaths', mean('IST_on', 'system_deaths'), mean('SOLL_on', 'system_deaths'),
     D['system_deaths']),
    ('Avg GP burnout', mean('IST_on', 'avg_burnout'), mean('SOLL_on', 'avg_burnout'),
     D['avg_burnout']),
    ('Peak GP burnout', mean('IST_on', 'peak_burnout'), mean('SOLL_on', 'peak_burnout'),
     D['peak_burnout']),
    ('Chronic-care (ketenzorg)', mean('IST_on', 'ketenzorg_interventions'), mean('SOLL_on', 'ketenzorg_interventions'),
     D['ketenzorg_interventions']),
    ('Proactive alerts', mean('IST_on', 'proactive_alerts'), mean('SOLL_on', 'proactive_alerts'),
     D['proactive_alerts']),
    ('Admin waste (€)', mean('IST_on', 'admin_waste_eur'), mean('SOLL_on', 'admin_waste_eur'),
     D['admin_waste_eur']),
]

soll_html = ''
for label, ist, soll, ct in soll_rows:
    p = pct(ist, soll)
    pstr = ('new' if ist == 0 else ('+%s%%' % p if p > 0 else '%s%%' % p))
    sig = 'sig' if ct['welch']['significant'] else 'ns'
    siglabel = 'significant' if ct['welch']['significant'] else 'n.s.'
    soll_html += (
        '<tr><td>%s</td><td>%s</td><td>%s</td><td class="%s">%s</td>'
        '<td>d=%s</td><td><span class="badge %s">%s</span></td></tr>'
        % (label, ist, soll, ('up' if (p or 0) > 0 else 'down'), pstr,
           ct['cohen_d'], sig, siglabel))

deaths_sig = ('statistically distinguishable' if D['system_deaths']['welch']['significant']
              else 'not statistically distinguishable at N=45 (underpowered by design)')

figdata = read(FIGDATA)

meta = j['config']

POSTS = {
    'post7': ('The Living Patient — the active brain (concept)', md2html(read(T7))),
    'post5': ('The Persona Layer', md2html(read(T5))),
    'post6': ('Chipsoft & the Dependency Problem', md2html(read(T6))),
}

html = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="data:,">
<title>Cammelot — Local Review (private)</title>
<style>
:root{ --bg:#0f1220; --panel:#171b2e; --ink:#e8ebf6; --muted:#9aa3c4; --line:#2a3052;
       --accent:#5b8cff; --good:#37d39a; --bad:#ff6b6b; --warn:#ffcf5c; }
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:16px/1.65 "Space Grotesk",-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;}
header{position:sticky;top:0;z-index:10;background:rgba(15,18,32,.92);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:14px 22px;
  display:flex;gap:18px;align-items:center;flex-wrap:wrap}
header b{font-size:18px;letter-spacing:.3px}
header .priv{font-size:12px;color:var(--warn);border:1px solid var(--warn);
  border-radius:999px;padding:2px 10px}
nav a{color:var(--muted);text-decoration:none;margin-right:14px;font-size:14px}
nav a:hover{color:var(--ink)}
main{max-width:880px;margin:0 auto;padding:28px 22px 80px}
section{background:var(--panel);border:1px solid var(--line);border-radius:14px;
  padding:26px 30px;margin:22px 0;box-shadow:0 8px 30px rgba(0,0,0,.25)}
h1{font-size:30px;margin:.2em 0 .4em}
h2{font-size:24px;border-bottom:1px solid var(--line);padding-bottom:8px;margin-top:1.6em}
h3{font-size:19px;color:#cdd5f7}
a{color:var(--accent)}
code{background:#0b0e1c;border:1px solid var(--line);border-radius:5px;padding:1px 5px;font-size:13px}
pre{background:#0b0e1c;border:1px solid var(--line);border-radius:10px;padding:14px 16px;
  overflow:auto;font-size:12.5px;line-height:1.5}
table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px}
th,td{border:1px solid var(--line);padding:8px 10px;text-align:left}
th{background:#0b0e1c;color:var(--muted)}
.badge{font-size:11px;border-radius:999px;padding:2px 9px;font-weight:600}
.badge.sig{background:rgba(55,211,154,.15);color:var(--good);border:1px solid var(--good)}
.badge.ns{background:rgba(154,163,196,.12);color:var(--muted);border:1px solid var(--line)}
.up{color:var(--good)} .down{color:var(--bad)}
.kpi{display:flex;gap:16px;flex-wrap:wrap;margin:18px 0}
.kpi .card{flex:1;min-width:190px;background:#0b0e1c;border:1px solid var(--line);
  border-radius:12px;padding:16px 18px}
.kpi .big{font-size:26px;font-weight:700}
.kpi .lbl{color:var(--muted);font-size:13px;margin-top:4px}
.hl{background:rgba(91,140,255,.10);border-left:3px solid var(--accent);
  padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0}
.cta{display:inline-block;background:var(--accent);color:#06122e;font-weight:700;
  text-decoration:none;padding:10px 18px;border-radius:10px;margin:6px 8px 6px 0}
img{max-width:100%;border:1px solid var(--line);border-radius:10px}
.muted{color:var(--muted);font-size:13px}
.post{display:none} .post.active{display:block}
.tabbar{display:flex;gap:10px;margin:6px 0 0}
.tabbar button{background:#0b0e1c;color:var(--muted);border:1px solid var(--line);
  border-radius:9px;padding:8px 14px;cursor:pointer;font:inherit;font-size:14px}
.tabbar button.active{color:var(--ink);border-color:var(--accent)}
</style></head>
<body>
<header>
  <b>Cammelot</b><span class="priv">PRIVATE · local only · not published</span>
  <nav>
    <a href="#summary">Results</a>
    <a href="#posts">Blog posts</a>
    <a href="#figdata">Raw figure data</a>
    <a href="replay.html">▶ Run replay</a>
  </nav>
</header>
<main>

<section id="summary">
  <h1>Results review</h1>
  <p class="muted">IST vs SOLL · __RUNS__ runs × __CYCLES__ cycles · Big Five personalities <b>ON</b> (Cammelot's baseline reality) · generated __DATE__ · source <code>persona_ab_comparison.json</code></p>

  <div class="hl">
    <h3 style="margin-top:0">Headline — the SOLL overhaul moves the system from reactive to proactive</h3>
    With personalities on as the baseline, switching from <b>IST</b> (today's broken system) to
    <b>SOLL</b> (the AI-native overhaul) takes proactive interventions from <b>0 to ~__PA_SOLL__ per run</b>
    (Cohen's d = __PA_D__), lifts chronic-care (ketenzorg) by <b>+__KETEN_PCT__%</b>, and cuts average GP
    burnout by <b>~__BO_PCT_ABS__%</b>. Mortality is __DEATHS_SIG__ — read the death counts as mechanism, not body count.
  </div>

  <div class="kpi">
    <div class="card"><div class="big">0 → __PA_SOLL__</div><div class="lbl">Proactive AI alerts per run (IST→SOLL) · d=__PA_D__</div></div>
    <div class="card"><div class="big">__BO_IST__ → __BO_SOLL__</div><div class="lbl">Avg GP burnout (IST→SOLL) · __BO_PCT__%</div></div>
    <div class="card"><div class="big">__SD_IST__ → __SD_SOLL__</div><div class="lbl">Preventable deaths (IST→SOLL) · n.s. at N=45</div></div>
  </div>

  <h3>IST → SOLL (personalities ON): does the AI-native overhaul help?</h3>
  <table>
    <thead><tr><th>Metric</th><th>IST</th><th>SOLL</th><th>Δ vs IST</th><th>Effect</th><th>Significance</th></tr></thead>
    <tbody>__SOLL_ROWS__</tbody>
  </table>
  <p class="muted">Personalities are ON in both arms — this is purely IST vs SOLL, not a personality comparison.
  Admin waste and most of burnout are partly <em>by construction</em> (admin input 30%→5%); proactive alerts
  and ketenzorg uptake are emergent. N=45 — mortality comparisons are underpowered by design and not statistically
  distinguishable here.</p>

  <h3>Watch one run play back</h3>
  <img src="assets/world_town_screenshot.png" alt="Cammelot town simulation screenshot">
  <p>A lightweight scrubber replay of a single recorded run (IST and SOLL) — agent health over time,
  deaths as they happen, and the end-of-run counters. Far faster than the live engine.</p>
  <p><a class="cta" href="replay.html">▶ Open the run replay</a></p>
</section>

<section id="posts">
  <h2>Blog posts (draft — not published)</h2>
  <div class="tabbar">
    <button data-tab="post7" class="active">T7 · Living Patient (concept)</button>
    <button data-tab="post5">T5 · Persona Layer</button>
    <button data-tab="post6">T6 · Chipsoft / Dependency</button>
  </div>
  <div id="post7" class="post active markdown">__POST7__</div>
  <div id="post5" class="post markdown">__POST5__</div>
  <div id="post6" class="post markdown">__POST6__</div>
</section>

<section id="figdata">
  <h2>Raw figure data</h2>
  <pre>__FIGDATA__</pre>
</section>

</main>
<script>
document.querySelectorAll('.tabbar button').forEach(function(b){
  b.addEventListener('click', function(){
    document.querySelectorAll('.tabbar button').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.post').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById(b.dataset.tab).classList.add('active');
    window.scrollTo({top: document.getElementById('posts').offsetTop-70, behavior:'smooth'});
  });
});
</script>
</body></html>"""

import html as _h
repl = {
    '__RUNS__': str(meta['runs']), '__CYCLES__': str(meta['cycles']), '__DATE__': meta['date'][:10],
    '__PA_SOLL__': str(round(pa_soll)), '__PA_D__': str(D['proactive_alerts']['cohen_d']),
    '__KETEN_PCT__': str(round(keten_pct)),
    '__BO_IST__': str(bo_ist), '__BO_SOLL__': str(bo_soll), '__BO_PCT__': str(pct(bo_ist, bo_soll)),
    '__BO_PCT_ABS__': str(abs(pct(bo_ist, bo_soll))),
    '__SD_IST__': str(sd_ist), '__SD_SOLL__': str(sd_soll),
    '__DEATHS_SIG__': deaths_sig,
    '__SOLL_ROWS__': soll_html,
    '__POST5__': POSTS['post5'][1], '__POST6__': POSTS['post6'][1],
    '__POST7__': POSTS['post7'][1],
    '__FIGDATA__': _h.escape(figdata),
}
for k, v in repl.items():
    html = html.replace(k, v)

# ── slim replay data (one IST + one SOLL recorded run) ──
def slim_replay(path):
    r = json.loads(read(path))
    return {
        'total_deaths': r.get('total_deaths', 0),
        'system_deaths': r.get('system_deaths', 0),
        'natural_deaths': r.get('natural_deaths', 0),
        'proactive_alerts': r.get('proactive_alerts', 0),
        'ketenzorg': r.get('ketenzorg_interventions', 0),
        'er_admissions': r.get('er_admissions', 0),
        'avg_burnout': round(sum(g['avg'] for g in r.get('gp_avg_burnout', [])) / max(1, len(r.get('gp_avg_burnout', []))), 1),
        'frames': max((len(s['hp_timeline']) for s in r.get('agent_stories', [])), default=0),
        'cycles_per_frame': 30,
        'agents': [
            {
                'name': s['name'], 'age': s['age'],
                'persona': s.get('persona_label'),
                'bigFive': s.get('bigFive'),
                'conditions': [cc.split(' (')[0] for cc in s.get('conditions', [])][:3],
                'codes': [cc.split('(')[-1].split('/')[0] for cc in s.get('conditions', []) if '(' in cc][:4],
                'outcome': s['outcome'], 'hp': s['hp_timeline'],
                'state': s.get('state_timeline'),
            }
            for s in r.get('agent_stories', [])
        ],
        'deaths': [
            {'name': d['name'], 'age': d['age'],
             'cycle': (d['cycle'] if isinstance(d['cycle'], int) else None),
             'cause': d.get('cause', 'unknown')}
            for d in r.get('death_reports', [])
        ],
    }

replay = {
    'IST': slim_replay(os.path.join(ROOT, 'scripts', 'output', 'replay_ist.json')),
    'SOLL': slim_replay(os.path.join(ROOT, 'scripts', 'output', 'replay_soll.json')),
}
with io.open(os.path.join(ASSETS, 'replay_data.json'), 'w', encoding='utf-8') as f:
    json.dump(replay, f, ensure_ascii=False)

replay_html = read(os.path.join(ROOT, 'scripts', 'replay_template.html'))
with io.open(os.path.join(OUT, 'replay.html'), 'w', encoding='utf-8') as f:
    f.write(replay_html)

with io.open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8') as f:
    f.write(html)
print('Wrote', os.path.join(OUT, 'index.html'))
print('Wrote', os.path.join(OUT, 'replay.html'))
print('Copied assets to', ASSETS)
