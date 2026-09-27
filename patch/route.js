(function(){
'use strict';
const CELL = 5;
const BEAM = 5;
const BRANCH = 5;
const PACK_GEO = 1000;
const DIAG = 7071;
const ORTH = 5000;
const BALANCE = 1.12;
const MOVES = [[1, 0, ORTH], [-1, 0, ORTH], [0, 1, ORTH], [0, -1, ORTH], [1, 1, DIAG], [1, -1, DIAG], [-1, 1, DIAG], [-1, -1, DIAG]];
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

function spawnPaint(got, spawns, x, y, radius){
  let added = 0;
  const r2 = radius * radius;
  for (let i = 0; i < spawns.length; i++){
    if (got[i]) continue;
    const dx = spawns[i].x - x, dy = spawns[i].y - y;
    if (dx * dx + dy * dy > r2) continue;
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

function heapLess(h, a, b){
  const ao = a << 2, bo = b << 2;
  const at = h[ao + 1], bt = h[bo + 1];
  if (at !== bt) return at < bt;
  const ag = h[ao + 2], bg = h[bo + 2];
  if (ag !== bg) return ag < bg;
  return h[ao + 3] < h[bo + 3];
}

function heapPush(h, node, t, g, n){
  let i = h.length >> 2;
  h.push(node, t, g, n);
  while (i > 0){
    const p = (i - 1) >> 1;
    if (!heapLess(h, i, p)) break;
    const io = i << 2, po = p << 2;
    const sn = h[po], st = h[po + 1], sg = h[po + 2], su = h[po + 3];
    h[po] = h[io]; h[po + 1] = h[io + 1]; h[po + 2] = h[io + 2]; h[po + 3] = h[io + 3];
    h[io] = sn; h[io + 1] = st; h[io + 2] = sg; h[io + 3] = su;
    i = p;
  }
}

function heapPop(h){
  const node = h[0], t = h[1], g = h[2], n = h[3];
  const nu = h.pop(), ng = h.pop(), nt = h.pop(), nn = h.pop();
  if (!h.length) return [node, t, g, n];
  h[0] = nn; h[1] = nt; h[2] = ng; h[3] = nu;
  let i = 0;
  const count = h.length >> 2;
  for (;;){
    let b = i;
    const l = i * 2 + 1, r = l + 1;
    if (l < count && heapLess(h, l, b)) b = l;
    if (r < count && heapLess(h, r, b)) b = r;
    if (b === i) break;
    const io = i << 2, bo = b << 2;
    const sn = h[io], st = h[io + 1], sg = h[io + 2], su = h[io + 3];
    h[io] = h[bo]; h[io + 1] = h[bo + 1]; h[io + 2] = h[bo + 2]; h[io + 3] = h[bo + 3];
    h[bo] = sn; h[bo + 1] = st; h[bo + 2] = sg; h[bo + 3] = su;
    i = b;
  }
  return [node, t, g, n];
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

function clearanceOf(floor, cw, ch){
  const dist = new Uint16Array(cw * ch);
  const queue = [];
  for (let y = 0; y < ch; y++){
    for (let x = 0; x < cw; x++){
      const i = y * cw + x;
      if (!floor[i]) continue;
      let edge = false;
      for (let k = 0; k < 4; k++){
        const nx = x + MOVES[k][0], ny = y + MOVES[k][1];
        if (!inside(cw, ch, nx, ny) || !floor[ny * cw + nx]){ edge = true; break; }
      }
      if (edge){ dist[i] = 1; queue.push(i); }
    }
  }
  for (let q = 0; q < queue.length; q++){
    const i = queue[q], x = i % cw, y = (i / cw) | 0;
    for (let k = 0; k < 4; k++){
      const nx = x + MOVES[k][0], ny = y + MOVES[k][1];
      if (!inside(cw, ch, nx, ny)) continue;
      const v = ny * cw + nx;
      if (!floor[v] || dist[v]) continue;
      dist[v] = dist[i] + 1;
      queue.push(v);
    }
  }
  return dist;
}

function simplify(points){
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const eps = 0.4;
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

function plan(layout, entrance, boss, spawns, targetPct, radius, teamCount){
  const width = layout.width, height = layout.height;
  const bytes = Uint8Array.from(atob(layout.mask), c => c.charCodeAt(0));
  const cw = Math.ceil(width / CELL), ch = Math.ceil(height / CELL);
  const count = new Uint16Array(cw * ch);
  let floorCount = 0;
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
  const n = cw * ch;
  const centerOf = cell => ({ x: (cell % cw) * CELL + CELL / 2, y: ((cell / cw) | 0) * CELL + CELL / 2 });
  const snap = point => {
    if (!point) return -1;
    const x = Math.max(0, Math.min(cw - 1, point.x / CELL | 0));
    const y = Math.max(0, Math.min(ch - 1, point.y / CELL | 0));
    if (floor[y * cw + x]) return y * cw + x;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < n; i++){
      if (!floor[i]) continue;
      const d = (i % cw - x) ** 2 + ((i / cw | 0) - y) ** 2;
      if (d < bestD){ bestD = d; best = i; }
    }
    return best;
  };
  const here = snap(entrance);
  if (here < 0) return [];
  const seenReach = new Uint8Array(n);
  const parentEnt = new Int32Array(n);
  const depthEnt = new Int32Array(n);
  parentEnt.fill(-1);
  const stack = [here];
  seenReach[here] = 1;
  for (let q = 0; q < stack.length; q++){
    const i = stack[q], x = i % cw, y = (i / cw) | 0;
    for (let k = 0; k < 4; k++){
      const nx = x + MOVES[k][0], ny = y + MOVES[k][1];
      if (!inside(cw, ch, nx, ny)) continue;
      const v = ny * cw + nx;
      if (seenReach[v] || !floor[v]) continue;
      seenReach[v] = 1;
      parentEnt[v] = i;
      depthEnt[v] = depthEnt[i] + 1;
      stack.push(v);
    }
  }
  const LOG = 12;
  const up = Array.from({ length: LOG }, () => new Int32Array(n).fill(-1));
  for (let i = 0; i < n; i++) up[0][i] = parentEnt[i];
  for (let k = 1; k < LOG; k++){
    for (let i = 0; i < n; i++){
      const mid = up[k - 1][i];
      up[k][i] = mid >= 0 ? up[k - 1][mid] : -1;
    }
  }
  const lift = (cell, dist) => {
    for (let k = 0; dist > 0 && cell >= 0; k++, dist >>= 1) if (dist & 1) cell = up[k][cell];
    return cell;
  };
  const lca = (a, b) => {
    if (a < 0 || b < 0) return -1;
    if (depthEnt[a] < depthEnt[b]){ const s = a; a = b; b = s; }
    a = lift(a, depthEnt[a] - depthEnt[b]);
    if (a === b) return a;
    for (let k = LOG - 1; k >= 0; k--){
      if (up[k][a] !== up[k][b]){ a = up[k][a]; b = up[k][b]; }
    }
    return parentEnt[a];
  };
  const passedBy = (teamCell, standCell) => {
    if (teamCell < 0 || standCell < 0) return false;
    if (depthEnt[teamCell] <= depthEnt[standCell] + 8) return false;
    const fork = lca(teamCell, standCell);
    return fork >= 0 && depthEnt[fork] + 8 < depthEnt[teamCell];
  };
  const behindOf = state => {
    if (state.covered >= goal) return 0;
    let nBehind = 0;
    for (let m = 0; m < spawnN; m++){
      const s = stand[m];
      if (s < 0 || state.got[m]) continue;
      let waiting = false;
      for (let t = 0; t < teamCount; t++) if (!passedBy(state.pos[t], s)){ waiting = true; break; }
      if (!waiting) nBehind++;
    }
    return nBehind;
  };
  for (let i = 0; i < n; i++) if (!seenReach[i]) floor[i] = 0;
  const clearance = clearanceOf(floor, cw, ch);
  const reach = radius / CELL;
  const spawnN = spawns.length;
  const covStart = new Int32Array(spawnN + 1);
  const covTmp = new Array(spawnN);
  const stand = new Int32Array(spawnN);
  stand.fill(-1);
  const lim = Math.ceil(radius / CELL);
  let covTotal = 0;
  for (let m = 0; m < spawnN; m++){
    const list = [];
    const sx = spawns[m].x, sy = spawns[m].y;
    const cx = sx / CELL | 0, cy = sy / CELL | 0;
    let best = -1, bestClear = -1, bestD = Infinity;
    for (let dy = -lim; dy <= lim; dy++){
      for (let dx = -lim; dx <= lim; dx++){
        const x = cx + dx, y = cy + dy;
        if (!inside(cw, ch, x, y)) continue;
        const cell = y * cw + x;
        if (!floor[cell]) continue;
        const at = centerOf(cell);
        const px = at.x - sx, py = at.y - sy;
        if (px * px + py * py > radius * radius) continue;
        list.push(cell);
        const room = clearance[cell];
        const d = px * px + py * py;
        if (room > bestClear || (room === bestClear && d < bestD)){ best = cell; bestClear = room; bestD = d; }
      }
    }
    covTmp[m] = list;
    covTotal += list.length;
    stand[m] = best;
  }
  const covCells = new Int32Array(covTotal);
  let cursor = 0;
  for (let m = 0; m < spawnN; m++){
    covStart[m] = cursor;
    const list = covTmp[m];
    for (let i = 0; i < list.length; i++) covCells[cursor++] = list[i];
  }
  covStart[spawnN] = cursor;

  const got0 = new Uint8Array(spawnN);
  const origin = centerOf(here);
  let covered0 = spawnPaint(got0, spawns, origin.x, origin.y, radius);
  let possible = covered0;
  for (let m = 0; m < spawnN; m++) if (!got0[m] && stand[m] >= 0) possible++;
  const goal = Math.min(Math.ceil(spawnN * targetPct / 100), possible);
  if (goal <= 0) return [];

  const timeOf = new Int32Array(n);
  const geoOf = new Int32Array(n);
  const nudgeOf = new Int32Array(n);
  const prev = new Int32Array(n);
  const seen = new Int32Array(n);
  const settled = new Int32Array(n);
  const hot = new Uint8Array(n);
  const mouthAt = new Int32Array(n);
  const freshAt = new Int32Array(n);
  let gen = 1, mouthGen = 1, freshGen = 1;
  const hotMark = monsterGot => {
    hot.fill(0);
    for (let m = 0; m < spawnN; m++){
      if (monsterGot[m]) continue;
      for (let k = covStart[m]; k < covStart[m + 1]; k++) hot[covCells[k]] = 1;
    }
  };
  const exemptAt = (cell, tip) => {
    const dx = (cell % cw) - (tip % cw);
    const dy = ((cell / cw) | 0) - ((tip / cw) | 0);
    return dx * dx + dy * dy <= reach * reach;
  };
  const nudgeOfCell = cell => {
    const room = clearance[cell];
    if (room >= 4) return 0;
    if (room === 3) return 1;
    if (room === 2) return 2;
    return 4;
  };
  const searchFrom = (start, trail) => {
    gen++;
    if (gen > 0x6fffffff){ seen.fill(0); settled.fill(0); gen = 1; }
    timeOf[start] = 0;
    geoOf[start] = 0;
    nudgeOf[start] = 0;
    prev[start] = -1;
    seen[start] = gen;
    const heap = [];
    const foundMouths = searchFrom.mouths;
    foundMouths.length = 0;
    mouthGen++;
    if (mouthGen > 0x6fffffff){ mouthAt.fill(0); mouthGen = 1; }
    let firstTime = Infinity, firstGeo = Infinity, mouthCount = 0;
    heapPush(heap, start, 0, 0, 0);
    while (heap.length){
      const [node, t, g, nud] = heapPop(heap);
      if (seen[node] !== gen) continue;
      if (t !== timeOf[node] || g !== geoOf[node] || nud !== nudgeOf[node]) continue;
      if (settled[node] === gen) continue;
      if (mouthCount >= 1 && t > firstTime + 140 && g > firstGeo) break;
      if (mouthCount >= BRANCH) break;
      settled[node] = gen;
      if (freshAt[node] === freshGen){
        let on = false;
        for (let c = prev[node], guard = 0; c !== start && c >= 0 && guard < n; c = prev[c], guard++){
          if (mouthAt[c] === mouthGen){ on = true; break; }
        }
        if (!on && mouthAt[node] !== mouthGen){
          mouthAt[node] = mouthGen;
          foundMouths.push(node);
          mouthCount++;
          if (t < firstTime || (t === firstTime && g < firstGeo)){ firstTime = t; firstGeo = g; }
          if (mouthCount >= BRANCH) break;
        }
      }
      const x = node % cw, y = (node / cw) | 0;
      const baseT = timeOf[node], baseG = geoOf[node], baseN = nudgeOf[node];
      for (let k = 0; k < MOVES.length; k++){
        const dx = MOVES[k][0], dy = MOVES[k][1], milli = MOVES[k][2];
        const nx = x + dx, ny = y + dy;
        if (!inside(cw, ch, nx, ny)) continue;
        const v = ny * cw + nx;
        if (!floor[v]) continue;
        if (dx && dy && (!floor[y * cw + nx] || !floor[ny * cw + x])) continue;
        const stepT = trail[v] && !exemptAt(v, start) ? 250 : hot[v] ? 0 : 1;
        const nt = baseT + stepT;
        const ng = baseG + milli;
        const nn = baseN + nudgeOfCell(v);
        if (seen[v] === gen){
          const ot = timeOf[v], og = geoOf[v], on = nudgeOf[v];
          if (nt > ot || (nt === ot && ng > og) || (nt === ot && ng === og && nn >= on)) continue;
        }
        seen[v] = gen;
        timeOf[v] = nt;
        geoOf[v] = ng;
        nudgeOf[v] = nn;
        prev[v] = node;
        heapPush(heap, v, nt, ng, nn);
      }
    }
  };
  searchFrom.mouths = [];
  const pathTo = (start, target) => {
    const rev = [];
    for (let c = target, guard = 0; c !== start; c = prev[c], guard++){
      if (c < 0 || seen[c] !== gen || guard > n) return null;
      rev.push(c);
    }
    rev.reverse();
    return rev;
  };
  const capFor = (state, team) => {
    if (teamCount === 1) return Infinity;
    let otherMax = 0;
    for (let t = 0; t < teamCount; t++) if (t !== team && state.dist[t] > otherMax) otherMax = state.dist[t];
    if (otherMax <= 0) return 360;
    return Math.max(24, BALANCE * otherMax - state.dist[team]);
  };
  const chooseTargets = (start, cap) => {
    const mouths = searchFrom.mouths;
    if (!mouths.length) return [];
    const capMilli = cap === Infinity ? Infinity : cap * PACK_GEO;
    const targets = [];
    for (let i = 0; i < mouths.length; i++){
      const mouth = mouths[i];
      if (settled[mouth] !== gen && mouthAt[mouth] !== mouthGen) continue;
      if (geoOf[mouth] <= capMilli){ targets.push(mouth); continue; }
      const path = pathTo(start, mouth);
      if (!path || !path.length) continue;
      let acc = 0, last = -1;
      for (let p = 0; p < path.length; p++){
        const step = p === 0 ? geoOf[path[0]] : geoOf[path[p]] - geoOf[path[p - 1]];
        if (acc + step > capMilli && last >= 0) break;
        acc += step;
        last = path[p];
      }
      if (last >= 0) targets.push(last);
    }
    return targets;
  };
  const lagging = state => {
    let team = 0;
    for (let t = 1; t < teamCount; t++) if (state.dist[t] < state.dist[team]) team = t;
    return team;
  };
  const expand = state => {
    if (state.covered >= goal) return [];
    const team = lagging(state);
    const start = state.pos[team];
    hotMark(state.got);
    freshGen++;
    if (freshGen > 0x6fffffff){ freshAt.fill(0); freshGen = 1; }
    for (let m = 0; m < spawnN; m++){
      const s = stand[m];
      if (s >= 0 && !state.got[m]) freshAt[s] = freshGen;
    }
    searchFrom(start, state.trail);
    const cap = capFor(state, team);
    const targets = chooseTargets(start, cap);
    const out = [];
    for (let i = 0; i < targets.length; i++){
      const target = targets[i];
      if (target === start) continue;
      const path = pathTo(start, target);
      if (!path || !path.length) continue;
      const got = state.got.slice();
      let covered = state.covered;
      const leg = [];
      const legRet = [];
      let addedMilli = 0;
      let addedTime = 0;
      let prevCell = start;
      for (let p = 0; p < path.length; p++){
        const cell = path[p];
        const retrace = state.trail[cell] && !exemptAt(cell, start) ? 1 : 0;
        const stepT = retrace ? 250 : hot[cell] ? 0 : 1;
        const dx = (cell % cw) - (prevCell % cw);
        const dy = ((cell / cw) | 0) - ((prevCell / cw) | 0);
        const milli = dx && dy ? DIAG : ORTH;
        if (leg.length && cap !== Infinity && (addedMilli + milli) / PACK_GEO > cap + 0.01) break;
        leg.push(cell);
        legRet.push(retrace);
        addedTime += stepT;
        addedMilli += milli;
        prevCell = cell;
        const at = centerOf(cell);
        covered += spawnPaint(got, spawns, at.x, at.y, radius);
        if (covered >= goal) break;
      }
      if (!leg.length) continue;
      const pos = state.pos.slice();
      const dist = state.dist.slice();
      pos[team] = leg[leg.length - 1];
      dist[team] += addedMilli / PACK_GEO;
      const trail = state.trail.slice();
      for (let p = 0; p < leg.length; p++) paintBar(trail, cw, ch, leg[p], reach);
      let travel = 0;
      for (let t = 0; t < teamCount; t++) travel += dist[t];
      out.push({
        parent: state,
        team,
        leg,
        legRet,
        pos,
        dist,
        time: state.time + addedTime,
        travel,
        got,
        covered,
        trail,
      });
    }
    return out;
  };
  const posKey = state => {
    let h = 2166136261;
    for (let t = 0; t < teamCount; t++) h = Math.imul(h ^ state.pos[t], 16777619);
    for (let i = 0; i < spawnN; i++) if (state.got[i]) h = Math.imul(h ^ (i + 1), 16777619);
    return h >>> 0;
  };
  const rankTime = state => {
    if (state.rank == null) state.rank = state.time + behindOf(state) * 2000;
    return state.rank;
  };
  const better = (a, b) => {
    const ta = rankTime(a), tb = rankTime(b);
    if (ta !== tb) return ta < tb;
    return a.travel < b.travel;
  };
  const rootPos = new Int32Array(teamCount);
  const rootDist = new Float64Array(teamCount);
  rootPos.fill(here);
  const rootTrail = new Uint8Array(n);
  paintBar(rootTrail, cw, ch, here, reach);
  let root = {
    parent: null,
    team: -1,
    leg: null,
    legRet: null,
    pos: rootPos,
    dist: rootDist,
    time: 0,
    travel: 0,
    got: got0,
    covered: covered0,
    trail: rootTrail,
  };
  let bestDone = covered0 >= goal ? root : null;
  let bestAny = root;
  const consider = state => {
    if (state.covered > bestAny.covered || (state.covered === bestAny.covered && better(state, bestAny))) bestAny = state;
    if (state.covered >= goal && (!bestDone || better(state, bestDone))) bestDone = state;
  };
  let beam = [root];
  const started = Date.now();
  const dominated = new Map();
  dominated.set(posKey(root), 0);
  for (let iter = 0; iter < 700 && beam.length; iter++){
    if (Date.now() - started > 2000) break;
    const cands = [];
    for (let b = 0; b < beam.length; b++){
      const state = beam[b];
      if (state.covered >= goal) continue;
      if (bestDone && !better(state, bestDone)) continue;
      const nexts = expand(state);
      for (let i = 0; i < nexts.length; i++){
        const nxt = nexts[i];
        const key = posKey(nxt);
        const prevTime = dominated.get(key);
        if (prevTime !== undefined && prevTime <= nxt.time) continue;
        dominated.set(key, nxt.time);
        consider(nxt);
        if (nxt.covered < goal) cands.push(nxt);
      }
    }
    if (!cands.length) break;
    cands.sort((a, b) => rankTime(a) - rankTime(b) || a.travel - b.travel);
    const nextBeam = [];
    const local = new Set();
    for (let i = 0; i < cands.length && nextBeam.length < BEAM; i++){
      if (bestDone && !better(cands[i], bestDone)) continue;
      const key = posKey(cands[i]);
      if (local.has(key)) continue;
      local.add(key);
      nextBeam.push(cands[i]);
    }
    if (!nextBeam.length) break;
    beam = nextBeam;
  }
  let winner = bestDone;
  if (!winner || winner.covered < goal){
    let state = bestAny;
    let stalls = 0;
    for (let guard = 0; guard < 80 && state.covered < goal && Date.now() - started < 2200; guard++){
      const nexts = expand(state);
      if (!nexts.length) break;
      nexts.sort((a, b) => b.covered - a.covered || a.time - b.time || a.travel - b.travel);
      const nxt = nexts[0];
      if (nxt.covered <= state.covered && nxt.travel <= state.travel + 1) break;
      if (nxt.covered <= state.covered) stalls++;
      else stalls = 0;
      if (stalls > teamCount * 3) break;
      state = nxt;
      consider(state);
    }
    winner = bestDone || state;
  }
  const chain = [];
  for (let s = winner; s; s = s.parent) chain.push(s);
  chain.reverse();
  const walked = Array.from({ length: teamCount }, () => ({ cells: [here], ret: [0] }));
  let backs = 0, steps = 0;
  for (let i = 0; i < chain.length; i++){
    const s = chain[i];
    if (!s.leg) continue;
    const bucket = walked[s.team];
    for (let p = 0; p < s.leg.length; p++){
      bucket.cells.push(s.leg[p]);
      bucket.ret.push(s.legRet[p]);
      steps++;
      if (s.legRet[p]) backs++;
    }
  }
  const routes = walked.map(bucket => simplifyRuns(bucket.cells.map((cell, index) => ({
    x: (cell % cw) * CELL + CELL / 2,
    y: ((cell / cw) | 0) * CELL + CELL / 2,
    retrace: !!bucket.ret[index],
  })))).filter(route => route.length > 1);
  const needHits = spawnN * (targetPct / 100 - 0.01);
  const r2 = radius * radius;
  const segDist = (ax, ay, bx, by, x, y) => {
    const dx = bx - ax, dy = by - ay, span = dx * dx + dy * dy;
    const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / span));
    const px = ax + t * dx - x, py = ay + t * dy - y;
    return px * px + py * py;
  };
  let hitNow = winner.covered;
  if (routes.length){
    const countHits = () => {
      let nHit = 0;
      for (let m = 0; m < spawnN; m++){
        const x = spawns[m].x, y = spawns[m].y;
        let ok = false;
        for (let p = 0; p < routes.length && !ok; p++){
          const path = routes[p];
          for (let i = 1; i < path.length; i++){
            if (segDist(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y, x, y) <= r2){ ok = true; break; }
          }
        }
        if (ok) nHit++;
      }
      return nHit;
    };
    hitNow = countHits();
    for (let guard = 0; guard < 4 && hitNow < needHits - 1e-6; guard++){
      let bestM = -1, bestExtra = Infinity, bestPath = -1, bestAt = 1;
      for (let m = 0; m < spawnN; m++){
        if (stand[m] < 0) continue;
        const at = centerOf(stand[m]);
        let covered = false, extra = Infinity, pathI = -1, segI = 1;
        for (let p = 0; p < routes.length && !covered; p++){
          const path = routes[p];
          for (let i = 1; i < path.length; i++){
            if (segDist(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y, spawns[m].x, spawns[m].y) <= r2){ covered = true; break; }
            const ax = path[i - 1].x, ay = path[i - 1].y, bx = path[i].x, by = path[i].y;
            const add = Math.hypot(at.x - ax, at.y - ay) + Math.hypot(bx - at.x, by - at.y) - Math.hypot(bx - ax, by - ay);
            if (add < extra){ extra = add; pathI = p; segI = i; }
          }
        }
        if (!covered && extra < bestExtra){ bestExtra = extra; bestM = m; bestPath = pathI; bestAt = segI; }
      }
      if (bestM < 0 || bestExtra > 180) break;
      const at = centerOf(stand[bestM]);
      const flag = !!routes[bestPath][bestAt].retrace;
      routes[bestPath].splice(bestAt, 0, { x: at.x, y: at.y, retrace: flag });
      hitNow = countHits();
    }
  }
  const points = routes[0] ? routes[0] : [];
  points.teams = routes;
  points.covered = spawnN ? hitNow / spawnN : 0;
  points.backtrack = steps ? backs / steps : 0;
  points.spawns = spawnN;
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
