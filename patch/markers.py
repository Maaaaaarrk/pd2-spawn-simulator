"""Boss and entrance positions for every simulator layout, read from the installed DS1 presets.

DS1 object coordinates are subtiles, the same units as the simulator's map grid.
Type 1 objects are monster presets (MonPreset.txt row within the DS1's act);
the entrance is the map's waypoint-style portal object, falling back to the
recorded arrival point (the last exclusion center) when a map has none.

Needs the installed PD2 data, ds1edit's obj.txt and the map_compare tools (paths below).

    python patch/markers.py              # layouts from simulator.bin at the patch base commit
    python patch/markers.py new.bin      # layouts from another unpatched build
Writes markers.json next to this script; then run patch.py.
"""
import csv, glob, gzip, hashlib, json, os, re, struct, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE_COMMIT = 'cba29b1'

MAP_COMPARE = 'C:/Users/shawn/Documents/PD2/Map Making/Act0 Palette/map_compare'
DATA = 'C:/Program Files/Diablo II/ProjectD2/data'
EXTRACT = 'C:/Users/shawn/Documents/PD2/Map Making/MPQ Editor/Extract/data'
OBJ_TXT = 'C:/Users/shawn/Documents/PD2/D2_modding_tools-main/win_ds1edit/Data/obj.txt'
sys.path.insert(0, MAP_COMPARE)
from formats import read_ds1

def tsv(name):
    with open(f'{DATA}/global/excel/{name}', encoding='latin1') as f:
        return list(csv.DictReader(f, delimiter='\t'))

def tbl(path):
    b = open(path, 'rb').read()
    n, hsz = struct.unpack_from('<HI', b, 2)
    out = {}
    for i in range(hsz):
        used, _, _, ko, so, _ = struct.unpack_from('<BHIIIH', b, 21 + 2 * n + i * 17)
        if used:
            out[b[ko:b.index(0, ko)].decode('utf-8', 'replace')] = b[so:b.index(0, so)].decode('utf-8', 'replace')
    return out

strings = {}
for p in (f'{EXTRACT}/local/lng/eng/patchstring.tbl', f'{DATA}/local/lng/eng/patchstring.tbl'):
    if os.path.exists(p): strings.update(tbl(p))
clean = lambda s: re.sub(r'ÿc.', '', s).strip()

presets = {}
for r in tsv('MonPreset.txt'):
    if r['Act']: presets.setdefault(int(r['Act']), []).append(r['Place'])
monstats = {r['Id'].lower(): r for r in tsv('MonStats.txt') if r.get('Id')}
supers = {r['Superunique'].lower(): r for r in tsv('SuperUniques.txt') if r.get('Superunique')}
objects = {}
with open(OBJ_TXT, encoding='latin1') as f:
    for r in list(csv.reader(f, delimiter='\t'))[1:]:
        try: objects[(int(r[0]), int(r[1]), int(r[2]))] = r[3]
        except (ValueError, IndexError): pass

def boss_of(place):
    key = place.lower()
    if key in monstats and (monstats[key].get('boss') == '1' or 'boss' in key):
        ns = monstats[key]['NameStr']
        return clean(strings.get(ns, place))
    if key in supers and 'boss' in key:
        return clean(strings.get(supers[key]['Name'], place))
    return None

ds1_by_hash = {hashlib.sha256(open(p, 'rb').read()).hexdigest(): p
               for p in glob.glob(f'{DATA}/global/tiles/**/*.ds1', recursive=True)}

base = Path(sys.argv[1]).read_bytes() if len(sys.argv) > 1 else subprocess.run(
    ['git', 'show', f'{BASE_COMMIT}:simulator.bin'], cwd=HERE.parent, capture_output=True, check=True).stdout
page = gzip.decompress(base).decode('utf-8')
layouts = json.JSONDecoder().raw_decode(page, page.index('const DATA=') + len('const DATA='))[0]['layouts']
out = {}
for l in layouts:
    d = read_ds1(ds1_by_hash[l['hash']])
    bosses, entrance = [], None
    for o in d.objects:
        if o['type'] == 1:
            ids = presets.get(d.act, [])
            place = ids[o['id']] if o['id'] < len(ids) else None
            name = place and boss_of(place)
            if name: bosses.append({'x': o['x'], 'y': o['y'], 'id': place, 'name': name})
        elif entrance is None and 'waypoint' in objects.get((d.act, 2, o['id']), '').lower():
            entrance = {'x': o['x'], 'y': o['y'], 'source': 'portal'}
    if entrance is None and l['exclusion_centers']:
        x, y = l['exclusion_centers'][-1]
        entrance = {'x': x, 'y': y, 'source': 'arrival'}
    for p in bosses + ([entrance] if entrance else []):
        assert 0 <= p['x'] < l['width'] and 0 <= p['y'] < l['height'], (l['filename'], p)
    out[l['id']] = {'boss': bosses, 'entrance': entrance}

(HERE / 'markers.json').write_text(json.dumps(out, separators=(',', ':')), encoding='utf-8')
print(len(out), 'layouts;', sum(1 for v in out.values() if v['boss']), 'with a boss;',
      sum(1 for v in out.values() if v['entrance'] and v['entrance']['source'] == 'portal'), 'portal entrances;',
      sum(1 for v in out.values() if v['entrance'] and v['entrance']['source'] == 'arrival'), 'arrival-point entrances')
for l in layouts:
    v = out[l['id']]
    if len(v['boss']) != 1: print('  boss count', len(v['boss']), l['name'], l['filename'], [b['id'] for b in v['boss']])
