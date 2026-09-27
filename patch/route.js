(function(){
'use strict';
const CELL = 5;
const ALONG = 250;
const TIME = 1000;
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
    target: Number.isFinite(target) ? Math.max(1, Math.min(100, target)) : 90,
    radius: Number.isFinite(radius) ? Math.max(1, Math.min(200, radius)) : 35,
    teams: Number.isFinite(teams) ? Math.max(1, Math.min(6, Math.round(teams))) : 1,
  };
}

function hits(monster, x, y, radius){
  const dx = monster.x - x, dy = monster.y - y;
  return dx * dx + dy * dy <= radius * radius;
}

function spawnGain(got, spawns, x, y, radius){
  let added = 0;
  for (let i = 0; i < spawns.length; i++) if (!got[i] && hits(spawns[i], x, y, radius)) added++;
  return added;
}

function spawnPaint(got, spawns, x, y, radius){
  let added = 0;
  for (let i = 0; i < spawns.length; i++){
    if (got[i] || !hits(spawns[i], x, y, radius)) continue;
    got[i] = 1;
    added++;
  }
  return added;
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

function heapPush(heap, i, d){
  heap.push(i, d);
  let n = heap.length / 2 - 1;
  while (n > 0){
    const p = (n - 1) >> 1;
    if (heap[p * 2 + 1] <= d) break;
    heap[n * 2] = heap[p * 2];
    heap[n * 2 + 1] = heap[p * 2 + 1];
    n = p;
  }
  heap[n * 2] = i;
  heap[n * 2 + 1] = d;
}

function heapPop(heap){
  const i = heap[0], d = heap[1];
  const li = heap[heap.length - 2], ld = heap.pop(), _ = heap.pop();
  if (!heap.length) return [i, d];
  let n = 0;
  heap[0] = li;
  heap[1] = ld;
  for (;;){
    let best = n;
    const l = n * 2 + 1, r = l + 1;
    if (l < heap.length / 2 && heap[l * 2 + 1] < heap[best * 2 + 1]) best = l;
    if (r < heap.length / 2 && heap[r * 2 + 1] < heap[best * 2 + 1]) best = r;
    if (best === n) break;
    const si = heap[n * 2], sd = heap[n * 2 + 1];
    heap[n * 2] = heap[best * 2];
    heap[n * 2 + 1] = heap[best * 2 + 1];
    heap[best * 2] = si;
    heap[best * 2 + 1] = sd;
    n = best;
  }
  return [i, d];
}

function paintBar(grid, cw, ch, cell, reach){
  const cx = cell % cw, cy = (cell / cw) | 0;
  const lim = Math.ceil(reach), r2 = reach * reach;
  for (let dy = -lim; dy <= lim; dy++){
    for (let dx = -lim; dx <= lim; dx++){
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx, y = cy + dy;
      if (!inside(cw, ch, x, y)) continue;
      grid[y * cw + x] = 1;
    }
  }
}

function markHot(hot, spawns, got, floor, cw, ch, radius){
  hot.fill(0);
  const lim = Math.ceil(radius / CELL), r2 = radius * radius;
  for (let i = 0; i < spawns.length; i++){
    if (got[i]) continue;
    const sx = spawns[i].x, sy = spawns[i].y;
    const cx = sx / CELL | 0, cy = sy / CELL | 0;
    for (let dy = -lim; dy <= lim; dy++){
      for (let dx = -lim; dx <= lim; dx++){
        const x = cx + dx, y = cy + dy;
        if (!inside(cw, ch, x, y)) continue;
        const cell = y * cw + x;
        if (!floor[cell] || hot[cell]) continue;
        const px = x * CELL + CELL / 2 - sx, py = y * CELL + CELL / 2 - sy;
        if (px * px + py * py <= r2) hot[cell] = 1;
      }
    }
  }
}

function clearanceOf(floor, cw, ch){
  const dist = new Uint16Array(cw * ch);
  const queue = [];
  for (let y = 0; y < ch; y++){
    for (let x = 0; x < cw; x++){
      const i = y * cw + x;
      if (!floor[i]) continue;
      let edge = false;
      for (const [dx, dy] of N4){
        const nx = x + dx, ny = y + dy;
        if (!inside(cw, ch, nx, ny) || !floor[ny * cw + nx]){ edge = true; break; }
      }
      if (edge){ dist[i] = 1; queue.push(i); }
    }
  }
  for (let q = 0; q < queue.length; q++){
    const i = queue[q], x = i % cw, y = (i / cw) | 0;
    for (const [dx, dy] of N4){
      const nx = x + dx, ny = y + dy;
      if (!inside(cw, ch, nx, ny)) continue;
      const v = ny * cw + nx;
      if (!floor[v] || dist[v]) continue;
      dist[v] = dist[i] + 1;
      queue.push(v);
    }
  }
  return dist;
}

function shortest(floor, w, h, start, trail, exempt, hot, clearance){
  const n = w * h;
  const dist = new Float64Array(n);
  const hops = new Int32Array(n);
  dist.fill(Infinity);
  const prev = new Int32Array(n);
  prev.fill(-1);
  const si = start.y * w + start.x;
  dist[si] = 0;
  const heap = [];
  heapPush(heap, si, 0);
  while (heap.length){
    const [u, d] = heapPop(heap);
    if (d !== dist[u]) continue;
    const x = u % w, y = (u / w) | 0;
    for (const [dx, dy] of N4){
      const nx = x + dx, ny = y + dy;
      if (!inside(w, h, nx, ny)) continue;
      const v = ny * w + nx;
      if (!floor[v]) continue;
      const time = trail[v] && !exempt[v] ? ALONG : hot[v] ? 0 : 1;
      const room = clearance[v];
      const center = room <= 1 ? 8 : room === 2 ? 3 : 0;
      const nd = d + time * TIME + 1 + center;
      if (nd < dist[v]){
        dist[v] = nd;
        hops[v] = hops[u] + 1;
        prev[v] = u;
        heapPush(heap, v, nd);
      }
    }
  }
  return { dist, prev, hops };
}

function pathFrom(prev, w, start, goal){
  const cells = [];
  let i = goal;
  const stop = start.y * w + start.x;
  while (i !== stop){
    if (prev[i] < 0) return null;
    cells.push(i);
    i = prev[i];
    if (cells.length > prev.length) return null;
  }
  cells.reverse();
  return cells;
}

function spawnSpots(got, spawns, floor, cw, ch, stride){
  const seen = new Uint8Array(cw * ch);
  const list = [];
  let n = 0;
  for (let i = 0; i < spawns.length; i++){
    if (got[i]) continue;
    const x = Math.max(0, Math.min(cw - 1, spawns[i].x / CELL | 0));
    const y = Math.max(0, Math.min(ch - 1, spawns[i].y / CELL | 0));
    let cell = y * cw + x;
    if (!floor[cell]) continue;
    if (seen[cell]) continue;
    seen[cell] = 1;
    if (n++ % stride === 0) list.push(cell);
  }
  if (!list.length){
    for (let i = 0; i < spawns.length; i++){
      if (got[i]) continue;
      const x = Math.max(0, Math.min(cw - 1, spawns[i].x / CELL | 0));
      const y = Math.max(0, Math.min(ch - 1, spawns[i].y / CELL | 0));
      if (floor[y * cw + x]){ list.push(y * cw + x); break; }
    }
  }
  return list;
}

function simplify(points){
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const eps = 0.8;
  while (stack.length){
    const [a, b] = stack.pop();
    const from = points[a], to = points[b];
    const dx = to.x - from.x, dy = to.y - from.y, span = dx * dx + dy * dy;
    let best = -1, bestDist = eps * eps;
    for (let i = a + 1; i < b; i++){
      const px = points[i].x - from.x, py = points[i].y - from.y;
      const dist = span === 0 ? px * px + py * py : (px * dy - py * dx) ** 2 / span;
      if (dist > bestDist){ bestDist = dist; best = i; }
    }
    if (best >= 0){ keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

function simplifyRuns(points){
  if (points.length < 2) return points;
  const out = [];
  let start = 0;
  for (let i = 1; i <= points.length; i++){
    if (i < points.length && !!points[i].retrace === !!points[start].retrace) continue;
    const run = points.slice(start, i);
    if (start > 0) run.unshift({ x: points[start - 1].x, y: points[start - 1].y, retrace: points[start].retrace });
    const simple = simplify(run);
    if (out.length) simple.shift();
    out.push(...simple);
    start = i;
  }
  return out;
}

function plan(layout, entrance, boss, spawns, targetPct, radiusSubtiles, teamCount){
  const width = layout.width, height = layout.height;
  const bytes = Uint8Array.from(atob(layout.mask), c => c.charCodeAt(0));
  let floorCount = 0;
  const cw = Math.ceil(width / CELL), ch = Math.ceil(height / CELL);
  const count = new Uint16Array(cw * ch);
  for (let y = 0; y < height; y++){
    for (let x = 0; x < width; x++){
      const i = y * width + x;
      if (!(bytes[i >> 3] & (1 << (i & 7)))) continue;
      floorCount++;
      count[(y / CELL | 0) * cw + (x / CELL | 0)]++;
    }
  }
  if (!floorCount || !entrance) return [];
  const floor = new Uint8Array(cw * ch);
  for (let i = 0; i < floor.length; i++) if (count[i] >= 3) floor[i] = 1;
  if (!spawns.length) return [];
  const radius = radiusSubtiles;
  const goal = Math.ceil(spawns.length * targetPct / 100);
  const snap = (point) => {
    if (!point) return -1;
    const x = Math.max(0, Math.min(cw - 1, point.x / CELL | 0));
    const y = Math.max(0, Math.min(ch - 1, point.y / CELL | 0));
    if (floor[y * cw + x]) return y * cw + x;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < floor.length; i++){
      if (!floor[i]) continue;
      const d = (i % cw - x) ** 2 + ((i / cw | 0) - y) ** 2;
      if (d < bestD){ bestD = d; best = i; }
    }
    return best;
  };
  let here = snap(entrance);
  if (here < 0) return [];
  const centerOf = cell => ({ x: (cell % cw) * CELL + CELL / 2, y: ((cell / cw) | 0) * CELL + CELL / 2 });
  const clearance = clearanceOf(floor, cw, ch);
  const standFor = monster => {
    const lim = Math.ceil(radius / CELL);
    const cx = monster.x / CELL | 0, cy = monster.y / CELL | 0;
    let best = -1, bestClear = -1, bestD = Infinity;
    for (let dy = -lim; dy <= lim; dy++){
      for (let dx = -lim; dx <= lim; dx++){
        const x = cx + dx, y = cy + dy;
        if (!inside(cw, ch, x, y) || !floor[y * cw + x]) continue;
        const at = centerOf(y * cw + x);
        if (!hits(monster, at.x, at.y, radius)) continue;
        const room = clearance[y * cw + x];
        const d = dx * dx + dy * dy;
        if (room > bestClear || (room === bestClear && d < bestD)){ best = y * cw + x; bestClear = room; bestD = d; }
      }
    }
    return best;
  };
  const stands = [];
  const seenStand = new Uint8Array(floor.length);
  for (const monster of spawns){
    const stand = standFor(monster);
    if (stand < 0 || seenStand[stand]) continue;
    seenStand[stand] = 1;
    stands.push(stand);
  }
  const claimed = new Uint8Array(spawns.length);
  let have = spawnGain(claimed, spawns, centerOf(here).x, centerOf(here).y, radius);
  for (let i = 0; i < spawns.length; i++) if (hits(spawns[i], centerOf(here).x, centerOf(here).y, radius)) claimed[i] = 1;
  const chosen = [];
  while (have < goal && stands.length){
    let bestI = -1, bestN = 0, bestClear = -1;
    for (let i = 0; i < stands.length; i++){
      const at = centerOf(stands[i]);
      let n = 0;
      for (let m = 0; m < spawns.length; m++) if (!claimed[m] && hits(spawns[m], at.x, at.y, radius)) n++;
      const room = clearance[stands[i]];
      if (n > bestN || (n === bestN && n > 0 && room > bestClear)){ bestN = n; bestI = i; bestClear = room; }
    }
    if (bestN <= 0) break;
    const cell = stands.splice(bestI, 1)[0];
    chosen.push(cell);
    const at = centerOf(cell);
    for (let m = 0; m < spawns.length; m++) if (!claimed[m] && hits(spawns[m], at.x, at.y, radius)){ claimed[m] = 1; have++; }
  }
  const nodes = [here, ...chosen];
  const blank = new Uint8Array(floor.length);
  const always = new Uint8Array(floor.length);
  always.fill(1);
  const reachFrom = nodes.map(cell => shortest(floor, cw, ch, { x: cell % cw, y: (cell / cw) | 0 }, blank, blank, always, clearance));
  const link = (a, b) => {
    if (a === b) return 0;
    const dist = reachFrom[a].dist[nodes[b]];
    if (!Number.isFinite(dist)) return 1e9;
    return reachFrom[a].hops[nodes[b]] || 1e9;
  };
  const tourLength = order => order.reduce((sum, stop, index) => sum + link(index === 0 ? 0 : order[index - 1], stop), 0);
  const twoOpt = order => {
    for (let guard = 0; guard < 40; guard++){
      let bestDelta = 0, bi = -1, bj = -1;
      for (let i = 0; i < order.length; i++){
        for (let j = i + 1; j < order.length; j++){
          const prev = i === 0 ? 0 : order[i - 1];
          const next = j + 1 < order.length ? order[j + 1] : -1;
          const before = link(prev, order[i]) + (next < 0 ? 0 : link(order[j], next));
          const after = link(prev, order[j]) + (next < 0 ? 0 : link(order[i], next));
          if (after - before < bestDelta){ bestDelta = after - before; bi = i; bj = j; }
        }
      }
      if (bi < 0) break;
      const reversed = order.slice(bi, bj + 1).reverse();
      order.splice(bi, bj - bi + 1, ...reversed);
    }
  };
  const tours = [];
  for (let team = 0; team < teamCount; team++) tours.push({ order: [] });
  const used = new Uint8Array(nodes.length);
  used[0] = 1;
  while (used.some((flag, index) => index > 0 && !flag)){
    let owner = 0, least = Infinity;
    for (let i = 0; i < tours.length; i++){
      const len = tourLength(tours[i].order);
      if (len < least){ least = len; owner = i; }
    }
    const tour = tours[owner];
    let bestAdd = Infinity, bestStop = -1, bestAt = 0;
    for (let stop = 1; stop < nodes.length; stop++){
      if (used[stop] || link(0, stop) >= 1e9) continue;
      for (let at = 0; at <= tour.order.length; at++){
        const prev = at === 0 ? 0 : tour.order[at - 1];
        const next = at === tour.order.length ? -1 : tour.order[at];
        const add = link(prev, stop) + (next < 0 ? 0 : link(stop, next) - link(prev, next));
        if (add < bestAdd){ bestAdd = add; bestStop = stop; bestAt = at; }
      }
    }
    if (bestStop < 0) break;
    tour.order.splice(bestAt, 0, bestStop);
    used[bestStop] = 1;
  }
  for (const tour of tours) twoOpt(tour.order);
  for (let pass = 0; pass < 24 && tours.length > 1; pass++){
    let longI = 0, shortI = 0;
    for (let i = 0; i < tours.length; i++){
      if (tourLength(tours[i].order) > tourLength(tours[longI].order)) longI = i;
      if (tourLength(tours[i].order) < tourLength(tours[shortI].order)) shortI = i;
    }
    const longLen = tourLength(tours[longI].order), shortLen = tourLength(tours[shortI].order);
    if (longLen <= shortLen * 1.1 || tours[longI].order.length < 2) break;
    let choice = null, bestImbalance = longLen - shortLen;
    for (let s = 0; s < tours[longI].order.length; s++){
      const stop = tours[longI].order[s];
      const without = tours[longI].order.filter((_, index) => index !== s);
      const newLong = tourLength(without);
      let bestAt = 0, bestAdd = Infinity;
      for (let at = 0; at <= tours[shortI].order.length; at++){
        const prev = at === 0 ? 0 : tours[shortI].order[at - 1];
        const next = at === tours[shortI].order.length ? -1 : tours[shortI].order[at];
        const add = link(prev, stop) + (next < 0 ? 0 : link(stop, next) - link(prev, next));
        if (add < bestAdd){ bestAdd = add; bestAt = at; }
      }
      const imbalance = Math.abs(newLong - (shortLen + bestAdd));
      if (imbalance < bestImbalance){ bestImbalance = imbalance; choice = { without, stop, bestAt }; }
    }
    if (!choice) break;
    tours[longI].order = choice.without;
    tours[shortI].order.splice(choice.bestAt, 0, choice.stop);
    twoOpt(tours[longI].order);
    twoOpt(tours[shortI].order);
  }
  const got = new Uint8Array(spawns.length);
  const walked = new Uint8Array(floor.length);
  const trail = new Uint8Array(floor.length);
  const exempt = new Uint8Array(floor.length);
  const hot = new Uint8Array(floor.length);
  const reach = radius / CELL;
  let covered = spawnPaint(got, spawns, centerOf(here).x, centerOf(here).y, radius);
  walked[here] = 1;
  paintBar(trail, cw, ch, here, reach);
  const runners = tours.map(tour => ({ stops: tour.order.slice(), next: 0, hereNode: 0, here, cells: [here], retraces: [false], steps: 0 }));
  const cellsBetween = (fromNode, toNode) => pathFrom(reachFrom[fromNode].prev, cw, { x: nodes[fromNode] % cw, y: (nodes[fromNode] / cw) | 0 }, nodes[toNode]) || [];
  let backs = 0, steps = 0, stop = 'done';
  let guard = 0;
  while (runners.some(runner => runner.next < runner.stops.length) && guard++ < 800){
    let mover = null, least = Infinity;
    for (const runner of runners){
      if (runner.next >= runner.stops.length || runner.steps > least) continue;
      least = runner.steps;
      mover = runner;
    }
    if (!mover) break;
    const targetNode = mover.stops[mover.next++];
    const target = nodes[targetNode];
    if (target === mover.here) continue;
    exempt.fill(0);
    paintBar(exempt, cw, ch, mover.here, reach);
    const legCells = cellsBetween(mover.hereNode, targetNode);
    if (!legCells.length){ stop = 'no-path'; continue; }
    for (const cell of legCells){
      steps++;
      if (walked[cell]) backs++;
      mover.retraces.push(!!(trail[cell] && !exempt[cell]));
      walked[cell] = 1;
      mover.cells.push(cell);
      const at = centerOf(cell);
      covered += spawnPaint(got, spawns, at.x, at.y, radius);
    }
    for (const cell of legCells) paintBar(trail, cw, ch, cell, reach);
    mover.steps += legCells.length;
    mover.here = target;
    mover.hereNode = targetNode;
    if (covered >= goal) break;
  }
  const routes = runners.map(runner => simplifyRuns(runner.cells.map((cell, index) => ({
    x: (cell % cw) * CELL + CELL / 2,
    y: ((cell / cw) | 0) * CELL + CELL / 2,
    retrace: runner.retraces[index],
  })))).filter(route => route.length > 1);
  const points = routes[0] ? routes[0] : [];
  points.teams = routes;
  points.covered = spawns.length ? covered / spawns.length : 0;
  points.backtrack = steps ? backs / steps : 0;
  points.stop = covered >= goal ? 'done' : stop;
  points.spawns = spawns.length;
  return points;
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
