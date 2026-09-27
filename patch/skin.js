(function globes(){
  const list = [...document.querySelectorAll('canvas.globe')]; if (!list.length) return;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COL = {life: {hi: [255, 92, 70], mid: [176, 18, 16], lo: [40, 2, 4], glow: 'rgba(255,70,40,'},
               mana: {hi: [110, 140, 255], mid: [24, 44, 190], lo: [4, 6, 44], glow: 'rgba(80,110,255,'}};
  const G = list.map((cv, i) => ({cv, k: cv.dataset.kind, seed: i * 1.7, bubbles: Array.from({length: 9}, () => ({x: Math.random(), y: Math.random(), r: .01 + Math.random() * .025, v: .0006 + Math.random() * .0012}))}));
  const rgb = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a === undefined ? 1 : a})`;
  function draw(o, t){
    const cv = o.cv, dpr = Math.min(window.devicePixelRatio || 1, 2), css = cv.clientWidth || 80, S = Math.round(css * dpr);
    if (cv.width !== S){ cv.width = S; cv.height = S; }
    const g = cv.getContext('2d'), c = COL[o.k]; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2, R = S * 0.40, ring = S * 0.075;
    // glass interior
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.clip();
    const bg = g.createRadialGradient(cx, cy - R * .2, R * .1, cx, cy, R); bg.addColorStop(0, '#16100c'); bg.addColorStop(1, '#050303'); g.fillStyle = bg; g.fillRect(0, 0, S, S);
    // liquid with a moving surface
    const level = cy - R * 0.62 + Math.sin(t * .0007 + o.seed) * R * .03;
    g.beginPath(); g.moveTo(cx - R - 2, S);
    for (let x = -R - 2; x <= R + 2; x += R / 24){
      const y = level + Math.sin(x / R * 5 + t * .0022 + o.seed) * R * .035 + Math.sin(x / R * 9 - t * .0031) * R * .018;
      g.lineTo(cx + x, y);
    }
    g.lineTo(cx + R + 2, S); g.closePath();
    const lg = g.createLinearGradient(0, level, 0, cy + R); lg.addColorStop(0, rgb(c.hi)); lg.addColorStop(.35, rgb(c.mid)); lg.addColorStop(1, rgb(c.lo));
    g.fillStyle = lg; g.fill();
    // slow swirls inside the liquid
    g.save(); g.clip(); g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++){
      const a = t * .0004 * (k % 2 ? 1 : -1) + k * 2.1 + o.seed, rx = cx + Math.cos(a) * R * .45, ry = cy + R * .25 + Math.sin(a * 1.3) * R * .3;
      const sg = g.createRadialGradient(rx, ry, 0, rx, ry, R * .55); sg.addColorStop(0, rgb(c.hi, .22)); sg.addColorStop(1, rgb(c.hi, 0)); g.fillStyle = sg; g.fillRect(0, 0, S, S);
    }
    g.globalCompositeOperation = 'source-over';
    for (const b of o.bubbles){
      if (!reduce){ b.y -= b.v; if (b.y < 0){ b.y = 1; b.x = Math.random(); } }
      const bx = cx + (b.x - .5) * R * 1.4, by = level + (cy + R - level) * b.y;
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, S * .004); g.beginPath(); g.arc(bx, by, b.r * S, 0, 6.2832); g.stroke();
    }
    g.restore();
    // surface sheen
    g.strokeStyle = rgb(c.hi, .55); g.lineWidth = Math.max(1, S * .006); g.beginPath();
    for (let x = -R; x <= R; x += R / 24){ const y = level + Math.sin(x / R * 5 + t * .0022 + o.seed) * R * .035 + Math.sin(x / R * 9 - t * .0031) * R * .018; x === -R ? g.moveTo(cx + x, y) : g.lineTo(cx + x, y); }
    g.stroke();
    // glass shading: dark edge, soft inner glow, highlights
    const vg = g.createRadialGradient(cx, cy, R * .55, cx, cy, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = vg; g.fillRect(0, 0, S, S);
    const hl = g.createRadialGradient(cx - R * .35, cy - R * .45, 0, cx - R * .35, cy - R * .45, R * .55); hl.addColorStop(0, 'rgba(255,255,255,.55)'); hl.addColorStop(.35, 'rgba(255,255,255,.12)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.beginPath(); g.ellipse(cx - R * .3, cy - R * .42, R * .42, R * .26, -0.5, 0, 6.2832); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = S * .012; g.beginPath(); g.arc(cx, cy, R * .86, 0.35, 1.35); g.stroke();
    g.restore();
    // gilded ring
    const rg = g.createLinearGradient(0, cy - R - ring, 0, cy + R + ring);
    rg.addColorStop(0, '#fff2c4'); rg.addColorStop(.25, '#c9a24f'); rg.addColorStop(.5, '#6d5222'); rg.addColorStop(.75, '#b88f3e'); rg.addColorStop(1, '#3a2a10');
    g.lineWidth = ring; g.strokeStyle = rg; g.beginPath(); g.arc(cx, cy, R + ring / 2, 0, 6.2832); g.stroke();
    g.lineWidth = Math.max(1, S * .008); g.strokeStyle = '#000'; g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.stroke(); g.beginPath(); g.arc(cx, cy, R + ring, 0, 6.2832); g.stroke();
    g.strokeStyle = 'rgba(255,240,200,.35)'; g.beginPath(); g.arc(cx, cy, R + ring * .72, -2.6, -0.6); g.stroke();
    for (let k = 0; k < 8; k++){                      // studs
      const a = k / 8 * 6.2832 + Math.PI / 8, sx = cx + Math.cos(a) * (R + ring / 2), sy = cy + Math.sin(a) * (R + ring / 2), sr = ring * .28;
      const sgd = g.createRadialGradient(sx - sr * .4, sy - sr * .4, 0, sx, sy, sr); sgd.addColorStop(0, '#fff5cf'); sgd.addColorStop(.5, '#b08a3a'); sgd.addColorStop(1, '#2a1d08');
      g.fillStyle = sgd; g.beginPath(); g.arc(sx, sy, sr, 0, 6.2832); g.fill();
    }
    // faint glow of the liquid through the glass
    g.globalCompositeOperation = 'destination-over'; const og = g.createRadialGradient(cx, cy, R * .8, cx, cy, S * .5); og.addColorStop(0, c.glow + '.35)'); og.addColorStop(1, c.glow + '0)'); g.fillStyle = og; g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'source-over';
  }
  function frame(t){ for (const o of G) draw(o, t); if (!reduce) requestAnimationFrame(frame); }
  frame(0); addEventListener('resize', () => { for (const o of G) draw(o, performance.now()); });
})();

// ---------- procedural stone texture and embers (original, generated at load) ----------
(function skin(){
  function stone(size, base, spread, cracks){
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    const img = g.createImageData(size, size); let s = 1234567;
    const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
    // value noise, a few octaves, tileable
    const grid = (n) => { const a = []; for (let i = 0; i < n * n; i++) a.push(rnd()); return a; };
    const oct = [[8,.5],[16,.25],[32,.15],[64,.1]].map(([n,w]) => ({n, w, g: grid(n)}));
    const smooth = t => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){
      let v = 0;
      for (const o of oct){ const fx = x / size * o.n, fy = y / size * o.n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
        const at = (i, j) => o.g[((j % o.n + o.n) % o.n) * o.n + ((i % o.n + o.n) % o.n)];
        const a = at(x0,y0) + (at(x0+1,y0) - at(x0,y0)) * tx, b = at(x0,y0+1) + (at(x0+1,y0+1) - at(x0,y0+1)) * tx;
        v += (a + (b - a) * ty) * o.w; }
      const k = (y * size + x) * 4, l = base + (v - .5) * spread;
      img.data[k] = l * 1.05; img.data[k+1] = l * .95; img.data[k+2] = l * .82; img.data[k+3] = 255;
    }
    g.putImageData(img, 0, 0);
    // hairline cracks
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1;
    for (let i = 0; i < cracks; i++){ let x = rnd() * size, y = rnd() * size; g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 7; j++){ x += (rnd() - .5) * 40; y += (rnd() - .5) * 40; g.lineTo(x, y); } g.stroke(); }
    return c.toDataURL('image/png');
  }
  try {
    document.documentElement.style.setProperty('--stone-tex', `url(${stone(256, 22, 26, 10)})`);
    document.documentElement.style.setProperty('--stone-tex2', `url(${stone(256, 30, 22, 6)})`);
  } catch(e){}
  const cv = document.getElementById('embers'); if (!cv || !cv.getContext) return;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = cv.getContext('2d'); let W = 0, H = 0; const P = [];
  function size(){ W = cv.width = innerWidth; H = cv.height = innerHeight; }
  size(); addEventListener('resize', size);
  const spawn = () => ({x: Math.random() * W, y: H + 10, vy: .3 + Math.random() * .7, vx: (Math.random() - .5) * .3, r: .6 + Math.random() * 1.6, a: .3 + Math.random() * .6, t: Math.random() * 6});
  for (let i = 0; i < 38; i++){ const p = spawn(); p.y = Math.random() * H; P.push(p); }
  function frame(){
    ctx.clearRect(0, 0, W, H);
    for (const p of P){ p.y -= p.vy; p.t += .02; p.x += p.vx + Math.sin(p.t) * .25; if (p.y < -10){ Object.assign(p, spawn()); }
      const fade = Math.min(1, p.y / H * 1.6) * p.a;
      ctx.beginPath(); ctx.fillStyle = `rgba(255,${120 + (p.r * 40 | 0)},40,${fade})`; ctx.shadowColor = 'rgba(255,120,30,.9)'; ctx.shadowBlur = 8; ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); }
    if (!reduce) requestAnimationFrame(frame);
  }
  frame();
})();

