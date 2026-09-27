(function(){
'use strict';
const CELL = 5;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const cache = new Map();

function inside(w, h, x, y){
  return x >= 0 && y >= 0 && x < w && y < h;
}
function readNumber(id){
  if (typeof document === 'undefined') return NaN;
  return Number(document.getElementById(id)?.value);
}
function settings(){
  const target = readNumber('clearTarget');
  const radius = readNumber('clearRadius');
  const teams = readNumber('clearTeams');
  return {
    target: Number.isFinite(target) ? Math.max(1, Math.min(100, target)) : 95,
    radius: Number.isFinite(radius) ? Math.max(1, Math.min(200, radius)) : 25,
    teams: Number.isFinite(teams) ? Math.max(1, Math.min(6, Math.round(teams))) : 1,
  };
}
function hits(monster, x, y, radius){
  const dx = monster.x - x, dy = monster.y - y;
  return dx * dx + dy * dy <= radius * radius;
}
function normalizeSpawns(spawns){
  const out = [];
  if (!spawns) return out;
  for (const spawn of spawns){
    if (Array.isArray(spawn)) out.push({ x: spawn[0], y: spawn[1] });
    else if (spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.y)) out.push({ x: spawn.x, y: spawn.y });
  }
  return out;
}
function spawnKey(spawns){
  let hash = spawns.length;
  const step = Math.max(1, spawns.length >> 3);
  for (let i = 0; i < spawns.length; i += step) hash = Math.imul(hash ^ (spawns[i].x | 0), 0x9e3779b9) ^ (spawns[i].y | 0);
  return hash >>> 0;
}
function idx(w, x, y){ return y * w + x; }

function clearanceOf(floor, cw, ch){
  const dist = new Uint16Array(cw * ch);
  const queue = [];
  for (let y = 0; y < ch; y++){
    for (let x = 0; x < cw; x++){
      const i = idx(cw, x, y);
      if (!floor[i]) continue;
      let edge = x === 0 || y === 0 || x === cw - 1 || y === ch - 1;
      if (!edge){
        for (const [dx, dy] of N4) if (!floor[idx(cw, x + dx, y + dy)]){ edge = true; break; }
      }
      if (edge){ dist[i] = 1; queue.push(i); }
    }
  }
  for (let q = 0; q < queue.length; q++){
    const i = queue[q], x = i % cw, y = (i / cw) | 0;
    for (const [dx, dy] of N4){
      const nx = x + dx, ny = y + dy;
      if (!inside(cw, ch, nx, ny)) continue;
      const v = idx(cw, nx, ny);
      if (!floor[v] || dist[v]) continue;
      dist[v] = dist[i] + 1;
      queue.push(v);
    }
  }
  return dist;
}

function keepComponent(floor, cw, ch, seed){
  const seen = new Uint8Array(cw * ch);
  const queue = [seed];
  seen[seed] = 1;
  for (let q = 0; q < queue.length; q++){
    const i = queue[q], x = i % cw, y = (i / cw) | 0;
    for (const [dx, dy] of N4){
      const nx = x + dx, ny = y + dy;
      if (!inside(cw, ch, nx, ny)) continue;
      const v = idx(cw, nx, ny);
      if (!floor[v] || seen[v]) continue;
      seen[v] = 1;
      queue.push(v);
    }
  }
  for (let i = 0; i < floor.length; i++) if (!seen[i]) floor[i] = 0;
}

function zhangSuen(src, w, h){
  const g = Uint8Array.from(src);
  let changed = true;
  while (changed){
    changed = false;
    for (let step = 0; step < 2; step++){
      const drop = [];
      for (let y = 1; y < h - 1; y++){
        for (let x = 1; x < w - 1; x++){
          const i = idx(w, x, y);
          if (!g[i]) continue;
          const p2 = g[i - w], p3 = g[i - w + 1], p4 = g[i + 1], p5 = g[i + w + 1];
          const p6 = g[i + w], p7 = g[i + w - 1], p8 = g[i - 1], p9 = g[i - w - 1];
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let turns = 0;
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) turns++;
          if (turns !== 1) continue;
          if (step === 0){
            if (p2 * p4 * p6 || p4 * p6 * p8) continue;
          } else if (p2 * p4 * p8 || p2 * p6 * p8) continue;
          drop.push(i);
        }
      }
      if (drop.length) changed = true;
      for (const i of drop) g[i] = 0;
    }
  }
  return g;
}

function neighbors(mask, w, h, i){
  const x = i % w, y = (i / w) | 0, out = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]){
    const nx = x + dx, ny = y + dy;
    if (!inside(w, h, nx, ny)) continue;
    const v = idx(w, nx, ny);
    if (mask[v]) out.push(v);
  }
  return out;
}

function euler(mask, w, h, start){
  const adj = new Map();
  for (let i = 0; i < mask.length; i++) if (mask[i]) adj.set(i, neighbors(mask, w, h, i));
  const odds = [];
  for (const [node, list] of adj) if (list.length % 2 === 1) odds.push(node);
  const unique = node => [...new Set(adj.get(node) || [])];
  while (odds.length > 1){
    const a = odds.pop();
    let best = 0, bestD = Infinity;
    for (let k = 0; k < odds.length; k++){
      const b = odds[k];
      const d = (a % w - b % w) ** 2 + ((a / w | 0) - (b / w | 0)) ** 2;
      if (d < bestD){ bestD = d; best = k; }
    }
    const b = odds.splice(best, 1)[0];
    const prev = new Map([[a, -1]]);
    const queue = [a];
    for (let q = 0; q < queue.length && !prev.has(b); q++){
      for (const v of unique(queue[q])){
        if (prev.has(v)) continue;
        prev.set(v, queue[q]);
        queue.push(v);
      }
    }
    if (!prev.has(b)) continue;
    for (let c = b; prev.get(c) >= 0; c = prev.get(c)){
      const p = prev.get(c);
      adj.get(p).push(c);
      adj.get(c).push(p);
    }
  }
  const stack = [start];
  const trail = [];
  while (stack.length){
    const u = stack[stack.length - 1];
    const list = adj.get(u);
    if (list && list.length){
      const v = list.pop();
      const back = adj.get(v);
      const at = back ? back.indexOf(u) : -1;
      if (at >= 0) back.splice(at, 1);
      stack.push(v);
    } else {
      trail.push(stack.pop());
    }
  }
  trail.reverse();
  return trail;
}

function orthogonal(points){
  const out = [];
  for (let i = 0; i < points.length; i++){
    const cur = points[i];
    const prev = out[out.length - 1];
    if (!prev){ out.push(cur); continue; }
    if (prev.x !== cur.x && prev.y !== cur.y){
      out.push({ x: cur.x, y: prev.y, retrace: cur.retrace });
    }
    if (prev.x !== cur.x || prev.y !== cur.y) out.push(cur);
  }
  const slim = [out[0]];
  for (let i = 1; i < out.length - 1; i++){
    const a = slim[slim.length - 1], b = out[i], c = out[i + 1];
    const straight = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
    if (!straight || !!a.retrace !== !!b.retrace || !!b.retrace !== !!c.retrace) slim.push(b);
  }
  if (out.length > 1) slim.push(out[out.length - 1]);
  return destair(slim.filter(Boolean));
}

function destair(points){
  if (!points || points.length < 4) return points;
  const out = [];
  let i = 0;
  while (i < points.length){
    let j = i;
    while (j < points.length - 1){
      const dx = Math.abs(points[j + 1].x - points[j].x);
      const dy = Math.abs(points[j + 1].y - points[j].y);
      if (Math.min(dx, dy) > 0.01 || Math.max(dx, dy) > CELL + 0.01) break;
      j++;
    }
    if (j - i >= 3){
      const a = points[i], b = points[j];
      const ys = [], xs = [];
      for (let k = i; k <= j; k++){ xs.push(points[k].x); ys.push(points[k].y); }
      xs.sort((p, q) => p - q);
      ys.sort((p, q) => p - q);
      const horiz = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
      if (horiz){
        const y = ys[ys.length >> 1];
        out.push({ x: a.x, y, retrace: a.retrace });
        out.push({ x: b.x, y, retrace: b.retrace });
        if (b.y !== y) out.push({ x: b.x, y: b.y, retrace: b.retrace });
      } else {
        const x = xs[xs.length >> 1];
        out.push({ x, y: a.y, retrace: a.retrace });
        out.push({ x, y: b.y, retrace: b.retrace });
        if (b.x !== x) out.push({ x: b.x, y: b.y, retrace: b.retrace });
      }
      i = j + 1;
    } else {
      out.push(points[i]);
      i++;
    }
  }
  const slim = [];
  for (const point of out){
    const prev = slim[slim.length - 1];
    if (!prev || prev.x !== point.x || prev.y !== point.y) slim.push(point);
  }
  return slim;
}

function plan(layout, entrance, boss, spawns, targetPct, radius, teamCount){
  const width = layout.width, height = layout.height;
  const raw = Uint8Array.from(atob(layout.mask), c => c.charCodeAt(0));
  const cw = Math.ceil(width / CELL), ch = Math.ceil(height / CELL);
  const count = new Uint16Array(cw * ch);
  for (let y = 0; y < height; y++){
    for (let x = 0; x < width; x++){
      const i = y * width + x;
      if (raw[i >> 3] & (1 << (i & 7))) count[(y / CELL | 0) * cw + (x / CELL | 0)]++;
    }
  }
  const floor = new Uint8Array(cw * ch);
  for (let i = 0; i < floor.length; i++) if (count[i] >= 1) floor[i] = 1;
  const snap = point => {
    if (!point) return -1;
    const x = Math.max(0, Math.min(cw - 1, point.x / CELL | 0));
    const y = Math.max(0, Math.min(ch - 1, point.y / CELL | 0));
    if (floor[idx(cw, x, y)]) return idx(cw, x, y);
    let best = -1, bestD = Infinity;
    for (let i = 0; i < floor.length; i++){
      if (!floor[i]) continue;
      const d = (i % cw - x) ** 2 + ((i / cw | 0) - y) ** 2;
      if (d < bestD){ bestD = d; best = i; }
    }
    return best;
  };
  const here = snap(entrance);
  if (here < 0) return [];
  keepComponent(floor, cw, ch, here);
  const clearance = clearanceOf(floor, cw, ch);
  const reach = Math.max(1, Math.round(radius / CELL));
  const lane = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++){
    for (let x = 0; x < cw; x++){
      const i = idx(cw, x, y);
      if (!floor[i]) continue;
      const c = clearance[i];
      let lower = false, greater = false;
      for (const [dx, dy] of N4){
        const nx = x + dx, ny = y + dy;
        const other = inside(cw, ch, nx, ny) && floor[idx(cw, nx, ny)] ? clearance[idx(cw, nx, ny)] : 0;
        if (other < c) lower = true;
        if (other > c) greater = true;
      }
      const ridge = !greater && lower;
      const ring = c === reach && lower;
      if (ridge || ring) lane[i] = 1;
    }
  }
  const thin = zhangSuen(lane, cw, ch);
  for (let i = 0; i < thin.length; i++) if (thin[i] && !lane[i]) thin[i] = 0;
  const owner = new Int32Array(thin.length).fill(-1);
  let compCount = 0;
  for (let i = 0; i < thin.length; i++){
    if (!thin[i] || owner[i] >= 0) continue;
    const id = compCount++;
    const queue = [i];
    owner[i] = id;
    for (let q = 0; q < queue.length; q++){
      for (const v of neighbors(thin, cw, ch, queue[q])){
        if (owner[v] >= 0) continue;
        owner[v] = id;
        queue.push(v);
      }
    }
  }
  const link = Uint8Array.from(thin);
  const stitched = new Uint8Array(compCount);
  const join = new Int32Array(cw * ch).fill(-1);
  const jq = [here];
  join[here] = here;
  for (let q = 0; q < jq.length; q++){
    const i = jq[q], x = i % cw, y = (i / cw) | 0;
    if (link[i] && owner[i] >= 0 && !stitched[owner[i]]){
      stitched[owner[i]] = 1;
      for (let c = join[i]; c !== here && c >= 0 && !link[c]; c = join[c]) link[c] = 1;
      link[here] = 1;
    }
    for (const [dx, dy] of N4){
      const nx = x + dx, ny = y + dy;
      if (!inside(cw, ch, nx, ny)) continue;
      const v = idx(cw, nx, ny);
      if (!floor[v] || join[v] >= 0) continue;
      join[v] = i;
      jq.push(v);
    }
  }
  const trail = euler(link, cw, ch, here);
  if (trail.length < 2) return [];
  const center = cell => ({ x: (cell % cw) * CELL + CELL / 2, y: ((cell / cw) | 0) * CELL + CELL / 2 });
  const walked = new Uint8Array(cw * ch);
  const points = [];
  for (let i = 0; i < trail.length; i++){
    const cell = trail[i];
    const retrace = false;
    walked[cell] = 1;
    const at = center(cell);
    points.push({ x: at.x, y: at.y, retrace });
  }
  const stroke = orthogonal(points);
  const r2 = radius * radius;
  let hit = 0;
  for (const monster of spawns){
    let ok = false;
    for (let i = 1; i < stroke.length && !ok; i++){
      const ax = stroke[i - 1].x, ay = stroke[i - 1].y, bx = stroke[i].x, by = stroke[i].y;
      const dx = bx - ax, dy = by - ay, span = dx * dx + dy * dy;
      const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((monster.x - ax) * dx + (monster.y - ay) * dy) / span));
      const px = ax + t * dx - monster.x, py = ay + t * dy - monster.y;
      if (px * px + py * py <= r2) ok = true;
    }
    if (ok) hit++;
  }
  const piece = Math.max(1, Math.ceil((stroke.length - 1) / teamCount));
  const routes = [];
  for (let t = 0; t < teamCount; t++){
    const a = t * piece;
    const b = Math.min(stroke.length - 1, (t + 1) * piece);
    if (a >= stroke.length - 1) break;
    const path = stroke.slice(a, b + 1).map((point, index) => ({ x: point.x, y: point.y, retrace: index === 0 ? false : point.retrace }));
    if (path.length > 1) routes.push(path);
  }
  const out = routes[0] ? routes[0] : [];
  out.teams = routes;
  out.covered = spawns.length ? hit / spawns.length : 0;
  out.backtrack = points.filter(point => point.retrace).length / Math.max(1, points.length);
  out.spawns = spawns.length;
  return out;
}

window.PD2ClearSettings = settings;
window.PD2ClearRoute = function(layout, entrance, boss, spawns){
  if (!layout || !layout.id || !layout.mask || layout.custom_geometry) return [];
  const monsters = normalizeSpawns(spawns);
  if (!monsters.length) return [];
  const choice = settings();
  const key = layout.id + ':' + choice.target + ':' + choice.radius + ':' + choice.teams + ':' + spawnKey(monsters);
  if (cache.has(key)) return cache.get(key);
  let points = [];
  try { points = plan(layout, entrance, boss, monsters, choice.target, choice.radius, choice.teams); }
  catch (error) { points = []; }
  cache.set(key, points);
  return points;
};
})();
