"""Apply the PD2 Calculators look, the shared site nav and the boss/entrance markers to a simulator build.

The live simulator.bin is a gzipped single-page build. This script takes an
unpatched build, patches it, writes ../simulator.bin and bumps the ?v= cache
version in ../index.html.

    python patch/patch.py                 # base = simulator.bin at commit cba29b1 (last unpatched build)
    python patch/patch.py path/to/new.bin  # base = a fresh build from the simulator source
    python patch/patch.py --html out.html  # also write the patched page for inspection

Every replacement must match exactly, so a changed build fails loudly instead of
half-applying. Inputs, all in this folder:
    theme.css, corners.css   stylesheet (corner ornaments copied from the IAS Calculator)
    skin.js                  life/mana globes, stone texture and embers (from the IAS Calculator)
    markers.json, markers.js boss and entrance positions and their drawing; rebuild markers.json with markers.py
    route.js                 walking clear drawn on the same map, from the entrance through the corridors to the boss
"""
import argparse, gzip, hashlib, re, subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
BASE_COMMIT = 'cba29b1'

ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
ap.add_argument('base', nargs='?', help=f'unpatched build (.bin); default: simulator.bin at {BASE_COMMIT}')
ap.add_argument('--html', help='also write the patched, uncompressed page here')
args = ap.parse_args()

def read(name): return (HERE / name).read_text(encoding='utf-8')
base = Path(args.base).read_bytes() if args.base else subprocess.run(
    ['git', 'show', f'{BASE_COMMIT}:simulator.bin'], cwd=REPO, capture_output=True, check=True).stdout
s = gzip.decompress(base).decode('utf-8')
theme = read('theme.css') + '\n' + read('corners.css') + '\n'
theme += '.sort-button,.mob-toggle,.linkish{box-shadow:none!important;text-shadow:none!important;filter:none!important;font-family:inherit!important;letter-spacing:0!important;transform:none!important}\n'
theme += '.tabs button{width:auto}\n'
# Tristram panels: a stone sheet with gold and soot edges, no gilded corners
theme += '.card{background:color-mix(in srgb,var(--tri-panel) 95%,transparent);border:1px solid var(--tri-line);box-shadow:inset 0 4px 0 var(--tri-gold),inset 0 -4px 0 var(--tri-shadow),0 14px 40px rgba(0,0,0,.55)}.card::before{display:none}\n'
skin = read('skin.js')

def rep(text, old, new, count=1, where=''):
    n = text.count(old)
    if n != count:
        raise SystemExit(f'{where}: expected {count} of {old!r}, found {n}')
    return text.replace(old, new)

# ---- split: head+body markup | main script (data + code) | the rest
first_script = s.index('<script>')
markup, rest = s[:first_script], s[first_script:]
main_end = rest.index('</script>') + len('</script>')
main_script, tail = rest[:main_end], rest[main_end:]

# ---- head
markup = rep(markup, '<title>PD2 · Spawn research lab</title>',
    '<title>PD2 Spawn Simulator</title>\n<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Almendra:ital,wght@0,400;0,700;1,400&family=Silkscreen:wght@400;700&family=IBM+Plex+Mono:wght@400;500&display=swap">', where='title')
a = markup.index('<style>') + len('<style>')
b = markup.index('</style>', a)
markup = markup[:a] + theme + markup[b:]
# the Tristram theme shared with the other tools, after the tool's own sheet
b = markup.index('</style>', a) + len('</style>')
markup = markup[:b] + ('\n<link rel="stylesheet" href="https://roofooevazan.github.io/assets/tristram.css">'
    '\n<link rel="stylesheet" href="https://roofooevazan.github.io/assets/tristram-tools.css">') + markup[b:]
markup = rep(markup, '<body>', '<body class="tri">', where='body')

# ---- header markup
# shared site nav (hub assets/site-nav.js) replaces the old per-tool rf-sitebar
m = re.search(r'<!--rf-sitebar-->.*?<!--/rf-sitebar-->', markup, re.S)
if not m: raise SystemExit('rf-sitebar not found')
markup = markup[:m.start()] + ('<script src="https://roofooevazan.github.io/assets/site-nav.js"></script>\n'
    '<canvas id="embers" aria-hidden="true"></canvas>') + markup[m.end():]
if not re.search(r'<body[^>]*>\s*<script src="https://roofooevazan.github.io/assets/site-nav.js">', markup):
    raise SystemExit('site nav is not the first thing in <body>')
m = re.search(r'<main>\s*<div class="eyebrow">Project Diablo II · Experimental model</div><h1>Spawn research lab</h1>\s*(<p>.*?</p>)', markup, re.S)
if not m: raise SystemExit('header not found')
markup = markup[:m.start()] + ('<main>\n<header class="page-head">'
    '<div class="title-row"><canvas class="globe" data-kind="life" aria-hidden="true"></canvas><h1>PD2 Spawn Simulator</h1><canvas class="globe" data-kind="mana" aria-hidden="true"></canvas></div>'
    '<p class="eyebrow">Spawn research lab · experimental model</p>' + m.group(1) +
    '<div class="rune-rule" aria-hidden="true"></div></header>') + markup[m.end():]

# ---- walking clear: target percent and the radius the group clears around the route
markup = rep(markup, '<label>Map<select id="map"></select></label><label>Layout<select id="layout"></select></label>',
    '<label>Map<select id="map"></select></label><label>Layout<select id="layout"></select></label>'
    '<label>Spawn clear (%)<input id="clearTarget" type="number" min="1" max="100" step="1" value="95"></label>'
    '<label>Group size (subtiles)<input id="clearRadius" type="number" min="1" max="200" step="1" value="25"></label>'
    '<label>Clear teams<input id="clearTeams" type="number" min="1" max="6" step="1" value="1"></label>', where='clear controls')

# ---- boss and entrance markers (markers.py reads them from the installed DS1 presets)
markup = rep(markup, '<canvas id="terrain" tabindex="0" aria-label="Map terrain with illustrative monster pack placement"></canvas>',
    '<canvas id="terrain" tabindex="0" aria-label="Map terrain with illustrative monster pack placement, the clear route, the entrance portal and the map boss"></canvas>'
    '<p id="mapMarkerLegend" class="map-legend" role="note"></p>', where='legend')
markup += ('<script>window.PD2MapMarkers=' + read('markers.json') + ';</script>\n'
           '<script>' + read('route.js') + '\n' + read('markers.js') + '</script>\n')

# ---- workspace / developer style blocks
for old, new in [
    ('.tabs button[aria-selected=true]{background:#7de0c0;color:#081019}',
     '.tabs{gap:10px!important}.tabs button[aria-selected=true]{color:var(--tri-accent-fg);background:var(--tri-accent);border-color:var(--tri-accent);box-shadow:none}'),
    ('#balanceChart{width:100%;height:auto;background:#0d1924;border-radius:8px}', '#balanceChart{width:100%;height:auto;background:#0c0a08;border:1px solid var(--edge);border-radius:0}'),
    ('.tab-note{padding:12px;background:#0d1924;border-radius:8px}', '.tab-note{padding:12px}'),
    ('background:#0a1823;border:1px solid #29485a;border-radius:8px', 'background:rgba(0,0,0,.5);border:1px solid #2e261a;border-color:var(--edge);border-radius:0'),
    ('.mob-summary-row:focus{background:#172c3b;', '.mob-summary-row:focus{background:#241e16;'),
    ('color:#eaf7ff;text-align:left', 'color:var(--ink);text-align:left'),
    ('.mob-detail-row>td{padding:0;background:#091722;', '.mob-detail-row>td{padding:0;background:#0c0a08;'),
    ('#devPanel code{color:#bceee0;', '#devPanel code{color:var(--gold-hi);'),
    ('#devPanel pre{background:#09141e;padding:16px;border-radius:8px;', '#devPanel pre{background:rgba(0,0,0,.6);border:1px solid var(--edge);padding:16px;border-radius:0;color:#d8d2c2;'),
    ('font:12px/1.6 ui-monospace,Consolas,monospace', 'font:12px/1.6 var(--mono)'),
]:
    markup = rep(markup, old, new, where='styles')

# ---- main code (skip the embedded data lines)
lines = main_script.split('\n')
code_swaps = [
    ("ctx.fillStyle='#081019'", "ctx.fillStyle='#0c0a08'"),
    ("'rgba(125,224,192,.24)'", "'rgba(199,179,119,.24)'"),
    ("role==='unique'?'#ffd36a':'#e6f7ff'", "role==='unique'?'#e6d39a':'#f4efe4'"),
    ("im.data[i*4]=mask[i]?40:8;im.data[i*4+1]=mask[i]?65:16;im.data[i*4+2]=mask[i]?79:25", "im.data[i*4]=mask[i]?54:12;im.data[i*4+1]=mask[i]?45:10;im.data[i*4+2]=mask[i]?33:8"),
    ("stroke:'#a6bbc7'", "stroke:'#8f8775'"),
    ("fill:'#245345',stroke:'#7de0c0'", "fill:'#3a2f1f',stroke:'#c7b377'"),
    ("fill:'#7de0c0'", "fill:'#c7b377'"),
    ("stroke:'#e7f0f4'", "stroke:'#dcd6c6'"),
    ("stroke:'#304754'", "stroke:'#3b3122'"),
    ("fill:'#abc1cb'", "fill:'#8f8775'"),
    ("fill:'#78dfbb'", "fill:'#c7b377'"),
]
hits = {k: 0 for k, _ in code_swaps}
for i, line in enumerate(lines):
    if len(line) > 5000: continue
    for old, new in code_swaps:
        if old in line:
            hits[old] += line.count(old); line = line.replace(old, new)
    lines[i] = line
draw_end = "role==='unique'?'#e6d39a':'#f4efe4';ctx.lineWidth=1;ctx.stroke()}}}"
n = sum(l.count(draw_end) for l in lines if len(l) <= 5000)
if n != 1: raise SystemExit(f'map draw end found {n} times')
lines = [l.replace(draw_end, draw_end[:-1] + 'window.drawMapMarkers&&drawMapMarkers(ctx,m,ox,oy,scale,points)}') if len(l) <= 5000 else l for l in lines]
missing = [k for k, v in hits.items() if not v]
if missing: raise SystemExit(f'main code swaps not found: {missing}')
main_script = '\n'.join(lines)

# ---- loot mini game (its own script, after the drop data)
loot_at = tail.index('/* "Clear the map" loot run')
pre, loot = tail[:loot_at], tail[loot_at:]
for old, new in [
    ('#0d1924', '#0c0a08'), ('#081019', '#0c0a08'), ('#172c3b', '#241e16'), ('#0a1620', '#15120e'), ('#3a5a6e', '#5a4a33'),
    ('#51687a', '#4a4034'), ('#8fb2c4', '#a89c86'), ('#c9d6de', '#dcd6c6'),
    ('#c7a46a', '#c7b377'), ('#3fd06a', '#34c759'), ('#f4ea6a', '#e8d95c'), ('#8a8aff', '#8c8cff'),
    ('.q-normal,.q-superior{color:#e7f0f4}', '.q-normal,.q-superior{color:#dcd6c6}'), ('.q-low{color:#8a96a0}', '.q-low{color:#6f685b}'),
    ('.q-gold{color:#f6c975}', '.q-gold{color:#e6d39a}'), ('.q-potion{color:#a6bbc7}', '.q-potion{color:#8f8775}'),
    ('linear-gradient(90deg,#b3372e,#f6c975)', 'linear-gradient(90deg,#b3372e,#e6d39a)'),
    ('  ctx.globalAlpha = 1;\n  if (!last) return;', '  ctx.globalAlpha = 1;\n  if (window.drawMapMarkers) drawMapMarkers(ctx, m, ox, oy, scale, mobs);\n  if (!last) return;'),
]:
    if old not in loot: raise SystemExit(f'loot: {old!r} not found')
    loot = loot.replace(old, new)
tail = pre + loot

# ---- globes, stone texture and embers
tail = rep(tail, '</body></html>', '<script>\n' + skin + '</script>\n</body></html>', where='skin')

out = (markup + main_script + tail).encode('utf-8')
if args.html: Path(args.html).write_bytes(out)
gz = gzip.compress(out, compresslevel=9, mtime=0)
(REPO / 'simulator.bin').write_bytes(gz)
version = hashlib.sha256(gz).hexdigest()[:12]
index = (REPO / 'index.html').read_text(encoding='utf-8')
index, n = re.subn(r'simulator\.bin\?v=[0-9a-f]+', 'simulator.bin?v=' + version, index)
if n != 1: raise SystemExit(f'index.html: expected one simulator.bin?v=, found {n}')
(REPO / 'index.html').write_text(index, encoding='utf-8', newline='')
print(f'simulator.bin: {len(out):,} bytes of HTML, {len(gz):,} gzipped, v={version}')
