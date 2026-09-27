(function(){
'use strict';
const CELL = 5;
const BACKTRACK = 4;
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
  return {
    target: Number.isFinite(target) ? Math.max(1, Math.min(100, target)) : 90,
    radius: Number.isFinite(radius) ? Math.max(1, Math.min(80, radius)) : 15,
  };
}

function diskOffsets(radius){
  const reach = Math.ceil(radius);
  const r2 = radius * radius;
  const offsets = [[0, 0]];
  for (let dy = -reach; dy <= reach; dy++){
    for (let dx = -reach; dx <= reach; dx++){
      if (!dx && !dy) continue;
      if (dx * dx + dy * dy <= r2 + 1e-6) offsets.push([dx, dy]);
    }
  }
  return offsets;
}

function gain(cleared, floor, w, h, x, y, offsets){
  let added = 0;
  for (const [dx, dy] of offsets){
    const nx = x + dx, ny = y + dy;
    if (!inside(w, h, nx, ny)) continue;
    const i = ny * w + nx;
    if (floor[i] && !cleared[i]) added++;
  }
  return added;
}

function paint(cleared, floor, w, h, x, y, offsets){
  let added = 0;
  for (const [dx, dy] of offsets){
    const nx = x + dx, ny = y + dy;
    if (!inside(w, h, nx, ny)) continue;
    const i = ny * w + nx;
    if (!floor[i] || cleared[i]) continue;
    cleared[i] = 1;
    added++;
  }
  return added;
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

function shortest(floor, w, h, start, walked){
  const n = w * h;
  const dist = new Float32Array(n);
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
      const nd = d + (walked[v] ? BACKTRACK : 1);
      if (nd < dist[v]){
        dist[v] = nd;
        prev[v] = u;
        heapPush(heap, v, nd);
      }
    }
  }
  return { dist, prev };
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

function openSpots(cleared, floor, stride, bossAt){
  const list = [];
  let seen = 0;
  for (let i = 0; i < floor.length; i++){
    if (!floor[i] || cleared[i]) continue;
    if (seen++ % stride === 0) list.push(i);
  }
  if (!list.length){
    for (let i = 0; i < floor.length; i++) if (floor[i] && !cleared[i]){ list.push(i); break; }
  }
  if (bossAt >= 0 && !cleared[bossAt] && !list.includes(bossAt)) list.push(bossAt);
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

function plan(layout, entrance, boss, targetPct, radiusSubtiles){
  const width = layout.width, height = layout.height;
  const bytes = Uint8Array.from(atob(layout.mask), c => c.charCodeAt(0));
  const raw = new Uint8Array(width * height);
  let floorCount = 0;
  const cw = Math.ceil(width / CELL), ch = Math.ceil(height / CELL);
  const count = new Uint16Array(cw * ch);
  for (let y = 0; y < height; y++){
    for (let x = 0; x < width; x++){
      if (!(bytes[(y * width + x) >> 3] & (1 << ((y * width + x) & 7)))) continue;
      raw[y * width + x] = 1;
      floorCount++;
      count[(y / CELL | 0) * cw + (x / CELL | 0)]++;
    }
  }
  if (!floorCount || !entrance) return [];
  const floor = new Uint8Array(cw * ch);
  let coarseCount = 0;
  for (let i = 0; i < floor.length; i++) if (count[i] >= 3){ floor[i] = 1; coarseCount++; }
  const radius = radiusSubtiles / CELL;
  const offsets = diskOffsets(radius);
  const goal = Math.ceil(coarseCount * targetPct / 100);
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
  const bossAt = snap(boss);
  if (here < 0) return [];
  const cleared = new Uint8Array(floor.length);
  const walked = new Uint8Array(floor.length);
  let covered = paint(cleared, floor, cw, ch, here % cw, (here / cw) | 0, offsets);
  walked[here] = 1;
  const cells = [here];
  let backs = 0, steps = 0;
  const stride = Math.max(1, Math.round(Math.max(radius, 1)));
  const horizon = Math.max(8, radius * 2);
  let stop = 'legs';
  for (let leg = 0; leg < 500 && (covered < goal || (bossAt >= 0 && !cleared[bossAt])); leg++){
    const search = shortest(floor, cw, ch, { x: here % cw, y: (here / cw) | 0 }, walked);
    const needBoss = bossAt >= 0 && !cleared[bossAt] && covered >= goal;
    let best = -1, bestScore = 0;
    const pool = needBoss ? [bossAt] : openSpots(cleared, floor, stride, bossAt);
    let reachable = 0;
    for (const spot of pool){
      const dist = search.dist[spot];
      if (!Number.isFinite(dist) || dist === 0) continue;
      reachable++;
      const added = gain(cleared, floor, cw, ch, spot % cw, (spot / cw) | 0, offsets);
      if (!added && spot !== bossAt) continue;
      const worth = added + (spot === bossAt && !cleared[bossAt] ? coarseCount * 0.05 : 0);
      const score = worth / (1 + Math.abs(dist - horizon));
      if (score > bestScore){ bestScore = score; best = spot; }
    }
    if (best < 0){ stop = 'no-candidate:' + pool.length + ':' + reachable; break; }
    const legCells = pathFrom(search.prev, cw, { x: here % cw, y: (here / cw) | 0 }, best);
    if (!legCells){ stop = 'no-path'; break; }
    for (const cell of legCells){
      steps++;
      if (walked[cell]) backs++;
      walked[cell] = 1;
      cells.push(cell);
      covered += paint(cleared, floor, cw, ch, cell % cw, (cell / cw) | 0, offsets);
    }
    here = best;
  }
  const points = simplify(cells.map(cell => ({
    x: (cell % cw) * CELL + CELL / 2,
    y: ((cell / cw) | 0) * CELL + CELL / 2,
  })));
  points.covered = coarseCount ? covered / coarseCount : 0;
  points.backtrack = steps ? backs / steps : 0;
  points.stop = covered >= goal && (bossAt < 0 || cleared[bossAt]) ? 'done' : stop;
  return points;
}

window.PD2ClearSettings = settings;
window.PD2ClearRoute = function(layout, entrance, boss){
  if (!layout || !layout.id || !layout.mask || layout.custom_geometry) return [];
  const choice = settings();
  const key = layout.id + ':' + choice.target + ':' + choice.radius;
  if (cache.has(key)) return cache.get(key);
  let points = [];
  try { points = plan(layout, entrance, boss, choice.target, choice.radius); }
  catch (error) { points = []; }
  cache.set(key, points);
  return points;
};
})();
