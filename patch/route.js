(function(){
'use strict';
const N8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function inside(w, h, x, y) {
  return x >= 0 && y >= 0 && x < w && y < h;
}

function neighborsOf(grid, w, h, x, y) {
  const out = [];
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (inside(w, h, nx, ny) && grid[ny * w + nx]) out.push([nx, ny]);
  }
  return out;
}

function zhangSuen(grid, w, h) {
  const g = Uint8Array.from(grid);
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      const drop = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!g[i]) continue;
          const p2 = g[i - w];
          const p3 = g[i - w + 1];
          const p4 = g[i + 1];
          const p5 = g[i + w + 1];
          const p6 = g[i + w];
          const p7 = g[i + w - 1];
          const p8 = g[i - 1];
          const p9 = g[i - w - 1];
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let turns = 0;
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) turns++;
          if (turns !== 1) continue;
          if (step === 0) {
            if (p2 && p4 && p6) continue;
            if (p4 && p6 && p8) continue;
          } else if ((p2 && p4 && p8) || (p2 && p6 && p8)) continue;
          drop.push(i);
        }
      }
      for (const i of drop) g[i] = 0;
      if (drop.length) changed = true;
    }
  }
  return g;
}

function skeletonize(floor, w, h) {
  const W = w + 2;
  const H = h + 2;
  const padded = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) padded.set(floor.subarray(y * w, (y + 1) * w), (y + 1) * W + 1);
  const thin = zhangSuen(padded, W, H);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) out.set(thin.subarray((y + 1) * W + 1, (y + 1) * W + 1 + w), y * w);
  return out;
}

function nearest(mask, w, h, point, goal) {
  if (!point || !inside(w, h, point.x, point.y)) return null;
  const seen = new Uint8Array(w * h);
  const prev = new Int32Array(w * h).fill(-1);
  const queue = [point.x, point.y];
  seen[point.y * w + point.x] = 1;
  let found = -1;
  for (let q = 0; q < queue.length && found < 0; q += 2) {
    const x = queue[q];
    const y = queue[q + 1];
    const i = y * w + x;
    if (goal(x, y)) {
      found = i;
      break;
    }
    for (const [dx, dy] of N8) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(w, h, nx, ny)) continue;
      const ni = ny * w + nx;
      if (seen[ni] || !mask[ni]) continue;
      seen[ni] = 1;
      prev[ni] = i;
      queue.push(nx, ny);
    }
  }
  if (found < 0 && goal(point.x, point.y)) found = point.y * w + point.x;
  if (found < 0) return null;
  const path = [];
  for (let i = found; i >= 0; i = prev[i]) path.push({ x: i % w, y: Math.floor(i / w) });
  path.reverse();
  return path;
}

function nearestAny(w, h, point, goal) {
  if (!point || !inside(w, h, point.x, point.y)) return null;
  if (goal(point.x, point.y)) return { x: point.x, y: point.y };
  const seen = new Uint8Array(w * h);
  const queue = [point.x, point.y];
  seen[point.y * w + point.x] = 1;
  for (let q = 0; q < queue.length; q += 2) {
    for (const [dx, dy] of N8) {
      const x = queue[q] + dx;
      const y = queue[q + 1] + dy;
      if (!inside(w, h, x, y)) continue;
      const i = y * w + x;
      if (seen[i]) continue;
      seen[i] = 1;
      if (goal(x, y)) return { x, y };
      queue.push(x, y);
    }
  }
  return null;
}

function componentOf(grid, w, h, seed) {
  const keep = new Uint8Array(w * h);
  const queue = [seed.x, seed.y];
  keep[seed.y * w + seed.x] = 1;
  for (let q = 0; q < queue.length; q += 2) {
    for (const [nx, ny] of neighborsOf(grid, w, h, queue[q], queue[q + 1])) {
      const ni = ny * w + nx;
      if (keep[ni]) continue;
      keep[ni] = 1;
      queue.push(nx, ny);
    }
  }
  return keep;
}

function buildGraph(grid, w, h, pinned) {
  const index = new Int32Array(w * h).fill(-1);
  const nodes = [];
  const mark = (x, y) => {
    const i = y * w + x;
    if (index[i] >= 0) return index[i];
    index[i] = nodes.length;
    nodes.push({ x, y });
    return index[i];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grid[y * w + x]) continue;
      if (pinned[y * w + x] || neighborsOf(grid, w, h, x, y).length !== 2) mark(x, y);
    }
  }
  if (!nodes.length) {
    for (let i = 0; i < grid.length; i++) {
      if (grid[i]) {
        mark(i % w, Math.floor(i / w));
        break;
      }
    }
  }
  const adj = nodes.map(() => []);
  let nextId = 0;
  const usedStep = new Set();
  const stepKey = (x1, y1, x2, y2) => {
    const a = y1 * w + x1;
    const b = y2 * w + x2;
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  };
  const add = (from, to, pixels) => {
    const id = nextId++;
    const back = pixels.slice().reverse();
    if (from === to) {
      adj[from].push({ id, from, to, pixels });
      adj[from].push({ id, from, to, pixels: back });
    } else {
      adj[from].push({ id, from, to, pixels });
      adj[to].push({ id, from: to, to: from, pixels: back });
    }
  };
  for (let a = 0; a < nodes.length; a++) {
    const { x: ax, y: ay } = nodes[a];
    for (const [nx, ny] of neighborsOf(grid, w, h, ax, ay)) {
      if (usedStep.has(stepKey(ax, ay, nx, ny))) continue;
      let px = ax;
      let py = ay;
      let cx = nx;
      let cy = ny;
      const pixels = [];
      let broken = false;
      while (index[cy * w + cx] < 0) {
        pixels.push({ x: cx, y: cy });
        const next = neighborsOf(grid, w, h, cx, cy).filter(([x, y]) => x !== px || y !== py);
        if (next.length !== 1) {
          broken = true;
          break;
        }
        px = cx;
        py = cy;
        cx = next[0][0];
        cy = next[0][1];
      }
      if (broken) continue;
      const b = index[cy * w + cx];
      pixels.push({ x: cx, y: cy });
      let sx = ax;
      let sy = ay;
      for (const point of pixels) {
        usedStep.add(stepKey(sx, sy, point.x, point.y));
        sx = point.x;
        sy = point.y;
      }
      add(a, b, pixels);
    }
  }
  return { nodes, adj, nextId: () => nextId++ };
}

function shortest(adj, src) {
  const dist = new Float64Array(adj.length).fill(Infinity);
  const prevEdge = new Int32Array(adj.length).fill(-1);
  const prevNode = new Int32Array(adj.length).fill(-1);
  dist[src] = 0;
  const heap = [[0, src]];
  while (heap.length) {
    let best = 0;
    for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[best][0]) best = i;
    const [d, u] = heap.splice(best, 1)[0];
    if (d !== dist[u]) continue;
    for (let k = 0; k < adj[u].length; k++) {
      const edge = adj[u][k];
      const nd = d + Math.max(1, edge.pixels.length);
      if (nd < dist[edge.to]) {
        dist[edge.to] = nd;
        prevNode[edge.to] = u;
        prevEdge[edge.to] = k;
        heap.push([nd, edge.to]);
      }
    }
  }
  return { dist, prevEdge, prevNode };
}

function pathEdges(adj, tree, from, to) {
  const edges = [];
  let node = to;
  while (node !== from) {
    const via = tree.prevNode[node];
    if (via < 0) return null;
    edges.push(adj[via][tree.prevEdge[node]]);
    node = via;
  }
  edges.reverse();
  return edges;
}

function matchPairs(cost) {
  const n = cost.length;
  if (n === 0) return { pairs: [], exact: true };
  if (n > 22) return { pairs: greedyPairs(cost), exact: false };
  const states = 1 << n;
  const dp = new Float64Array(states).fill(Infinity);
  const choice = new Int16Array(states);
  dp[0] = 0;
  for (let mask = 0; mask < states; mask++) {
    if (dp[mask] === Infinity) continue;
    let i = 0;
    while (i < n && mask & (1 << i)) i++;
    if (i === n) continue;
    for (let j = i + 1; j < n; j++) {
      if (mask & (1 << j)) continue;
      const next = mask | (1 << i) | (1 << j);
      const value = dp[mask] + cost[i][j];
      if (value < dp[next]) {
        dp[next] = value;
        choice[next] = j;
      }
    }
  }
  if (dp[states - 1] === Infinity) return { pairs: greedyPairs(cost), exact: false };
  const pairs = [];
  let mask = states - 1;
  while (mask) {
    let i = 0;
    while ((mask & (1 << i)) === 0) i++;
    const j = choice[mask];
    pairs.push([i, j]);
    mask ^= (1 << i) | (1 << j);
  }
  return { pairs, exact: true };
}

function greedyPairs(cost) {
  const n = cost.length;
  const order = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) order.push([cost[i][j], i, j]);
  order.sort((a, b) => a[0] - b[0]);
  const used = new Uint8Array(n);
  const pairs = [];
  for (const [, i, j] of order) {
    if (used[i] || used[j]) continue;
    used[i] = 1;
    used[j] = 1;
    pairs.push([i, j]);
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let a = 0; a < pairs.length; a++) {
      for (let b = a + 1; b < pairs.length; b++) {
        const [a0, a1] = pairs[a];
        const [b0, b1] = pairs[b];
        const now = cost[a0][a1] + cost[b0][b1];
        const swap = cost[a0][b0] + cost[a1][b1];
        const cross = cost[a0][b1] + cost[a1][b0];
        if (swap < now && swap <= cross) {
          pairs[a] = [a0, b0];
          pairs[b] = [a1, b1];
          improved = true;
        } else if (cross < now) {
          pairs[a] = [a0, b1];
          pairs[b] = [a1, b0];
          improved = true;
        }
      }
    }
  }
  return pairs;
}

function duplicate(adj, edges, idOf) {
  for (const edge of edges) {
    const id = idOf();
    const forward = edge.pixels;
    const back = forward.slice().reverse();
    if (edge.from === edge.to) {
      adj[edge.from].push({ id, from: edge.from, to: edge.to, pixels: forward });
      adj[edge.from].push({ id, from: edge.from, to: edge.to, pixels: back });
    } else {
      adj[edge.from].push({ id, from: edge.from, to: edge.to, pixels: forward });
      adj[edge.to].push({ id, from: edge.to, to: edge.from, pixels: back });
    }
  }
}

function euler(adj, start) {
  const cursor = adj.map(() => 0);
  const used = new Set();
  const stack = [start];
  const edges = [null];
  const trail = [];
  while (stack.length) {
    const u = stack[stack.length - 1];
    const list = adj[u];
    let stepped = false;
    while (cursor[u] < list.length) {
      const edge = list[cursor[u]++];
      if (used.has(edge.id)) continue;
      used.add(edge.id);
      stack.push(edge.to);
      edges.push(edge);
      stepped = true;
      break;
    }
    if (!stepped) {
      trail.push(edges.pop());
      stack.pop();
    }
  }
  trail.pop();
  trail.reverse();
  return { trail, used: used.size };
}

function edgeCount(adj) {
  const ids = new Set();
  for (const list of adj) for (const edge of list) ids.add(edge.id);
  return ids.size;
}

function simplify(points, epsilon) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const from = points[a];
    const to = points[b];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const span = dx * dx + dy * dy;
    let best = -1;
    let bestDist = epsilon * epsilon;
    for (let i = a + 1; i < b; i++) {
      const px = points[i].x - from.x;
      const py = points[i].y - from.y;
      const dist = span === 0 ? px * px + py * py : (px * dy - py * dx) ** 2 / span;
      if (dist > bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

function dedupe(points) {
  const out = [];
  for (const point of points) {
    const prev = out[out.length - 1];
    if (!prev || prev.x !== point.x || prev.y !== point.y) out.push(point);
  }
  return out;
}

function coverageRoute(floor, width, height, start, boss) {
  const entrance = nearestAny(width, height, start, (x, y) => floor[y * width + x] === 1);
  if (!entrance) return { points: [], exact: true };
  const thin = skeletonize(floor, width, height);
  for (let i = 0; i < thin.length; i++) if (thin[i] && !floor[i]) thin[i] = 0;
  const approach = nearest(floor, width, height, entrance, (x, y) => thin[y * width + x] === 1);
  if (!approach) return { points: [entrance], exact: true };
  const startSk = approach[approach.length - 1];
  const bossFloor = boss ? nearestAny(width, height, boss, (x, y) => floor[y * width + x] === 1) : null;
  const retreat = bossFloor ? nearest(floor, width, height, bossFloor, (x, y) => thin[y * width + x] === 1) : null;
  const bossSk = retreat ? retreat[retreat.length - 1] : null;
  const joined = bossSk ? nearest(thin, width, height, startSk, (x, y) => x === bossSk.x && y === bossSk.y) : null;
  const pinned = new Uint8Array(width * height);
  pinned[startSk.y * width + startSk.x] = 1;
  if (joined) pinned[bossSk.y * width + bossSk.x] = 1;
  const keep = componentOf(thin, width, height, startSk);
  for (let i = 0; i < thin.length; i++) if (!keep[i]) thin[i] = 0;
  const { nodes, adj, nextId } = buildGraph(thin, width, height, pinned);
  const startId = nodes.findIndex((node) => node.x === startSk.x && node.y === startSk.y);
  const bossId = joined ? nodes.findIndex((node) => node.x === bossSk.x && node.y === bossSk.y) : -1;
  if (startId < 0) return { points: dedupe(approach), exact: true };
  const odds = [];
  for (let i = 0; i < adj.length; i++) if (adj[i].length % 2 === 1) odds.push(i);
  const open = bossId >= 0 && bossId !== startId;
  const extras = odds.slice();
  const toggle = (id) => {
    const at = extras.indexOf(id);
    if (at >= 0) extras.splice(at, 1);
    else extras.push(id);
  };
  if (open) {
    toggle(startId);
    toggle(bossId);
  }
  const trees = new Map();
  const cost = extras.map(() => new Float64Array(extras.length));
  for (let i = 0; i < extras.length; i++) {
    trees.set(extras[i], shortest(adj, extras[i]));
    for (let j = 0; j < extras.length; j++) cost[i][j] = trees.get(extras[i]).dist[extras[j]];
  }
  const matched = matchPairs(cost);
  for (const [i, j] of matched.pairs) {
    const edges = pathEdges(adj, trees.get(extras[i]), extras[i], extras[j]);
    if (!edges) throw new Error('corridor matching left two dead ends disconnected');
    duplicate(adj, edges, nextId);
  }
  const { trail, used } = euler(adj, startId);
  const total = edgeCount(adj);
  if (used !== total) throw new Error(`route covered ${used} of ${total} corridors`);
  const points = approach.slice(0, -1);
  points.push(nodes[startId]);
  for (const edge of trail) for (const pixel of edge.pixels) points.push(pixel);
  if (open) points.push(...retreat.slice(0, -1).reverse());
  return { points: simplify(dedupe(points), 0.75), exact: matched.exact, start: entrance, boss: bossFloor };
}


const CELL = 5;
const routeCache = new Map();

function coarsen(floor, width, height) {
  const cw = Math.ceil(width / CELL);
  const ch = Math.ceil(height / CELL);
  const count = new Uint16Array(cw * ch);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (floor[y * width + x]) count[(y / CELL | 0) * cw + (x / CELL | 0)]++;
    }
  }
  const grid = new Uint8Array(cw * ch);
  for (let i = 0; i < grid.length; i++) if (count[i] >= 3) grid[i] = 1;
  return { grid, cw, ch };
}

function cropGrid(grid, cw, ch, extra) {
  let minX = cw, minY = ch, maxX = -1, maxY = -1;
  const cover = (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (grid[y * cw + x]) cover(x, y);
  for (const point of extra) {
    if (point && point.x >= 0 && point.y >= 0 && point.x < cw && point.y < ch) cover(point.x, point.y);
  }
  if (maxX < 0) return null;
  const width = maxX - minX + 1, height = maxY - minY + 1;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) out[y * width + x] = grid[(y + minY) * cw + (x + minX)];
  return { grid: out, width, height, minX, minY };
}

function clearRoute(layout, entrance, boss) {
  if (!layout || !layout.mask || layout.custom_geometry || !entrance) return [];
  const width = layout.width, height = layout.height;
  const bytes = Uint8Array.from(atob(layout.mask), c => c.charCodeAt(0));
  const floor = new Uint8Array(width * height);
  for (let i = 0; i < floor.length; i++) if (bytes[i >> 3] & (1 << (i & 7))) floor[i] = 1;
  const coarse = coarsen(floor, width, height);
  const start = { x: entrance.x / CELL | 0, y: entrance.y / CELL | 0 };
  const end = boss ? { x: boss.x / CELL | 0, y: boss.y / CELL | 0 } : null;
  const cropped = cropGrid(coarse.grid, coarse.cw, coarse.ch, [start, end]);
  if (!cropped) return [];
  const shift = point => point ? { x: point.x - cropped.minX, y: point.y - cropped.minY } : null;
  const route = coverageRoute(cropped.grid, cropped.width, cropped.height, shift(start), shift(end));
  return route.points.map(point => ({
    x: (point.x + cropped.minX) * CELL + CELL / 2,
    y: (point.y + cropped.minY) * CELL + CELL / 2,
  }));
}

window.PD2ClearRoute = function(layout, entrance, boss) {
  if (!layout || !layout.id) return [];
  if (routeCache.has(layout.id)) return routeCache.get(layout.id);
  let points = [];
  try { points = clearRoute(layout, entrance, boss); }
  catch (error) { points = []; }
  routeCache.set(layout.id, points);
  return points;
};
})();
