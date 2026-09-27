/* Boss and entrance markers from each layout's DS1 presets (subtile coordinates, same grid as the map).
   Shared by the scenario map and the loot mini game map. */
(function(){
'use strict';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function portal(ctx, x, y, r){
  ctx.save();
  ctx.shadowColor = 'rgba(255,70,40,.85)'; ctx.shadowBlur = r * 1.2;
  const g = ctx.createRadialGradient(x, y, r * .1, x, y, r);
  g.addColorStop(0, '#ffd9a8'); g.addColorStop(.35, '#ff5a2e'); g.addColorStop(.75, '#a3160f'); g.addColorStop(1, '#3a0604');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r * .62, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,220,170,.55)'; ctx.lineWidth = Math.max(1, r * .12);
  ctx.beginPath(); ctx.ellipse(x, y, r * .34, r * .62, 0, .6, 5.2); ctx.stroke();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y, r * .62, r, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#c9a24f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, r * .62 + 1.5, r + 1.5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
function skull(ctx, x, y, r){
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 6;
  const ring = ctx.createLinearGradient(0, y - r, 0, y + r);
  ring.addColorStop(0, '#fff2c4'); ring.addColorStop(.45, '#c9a24f'); ring.addColorStop(1, '#5c4520');
  ctx.fillStyle = '#1a0907'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = Math.max(1.5, r * .18); ctx.strokeStyle = ring; ctx.stroke();
  const s = r * .62;                                     // skull inside the ring
  ctx.fillStyle = '#efe6cf';
  ctx.beginPath(); ctx.arc(x, y - s * .18, s * .72, Math.PI, 0); ctx.lineTo(x + s * .72, y + s * .2);
  ctx.lineTo(x + s * .42, y + s * .35); ctx.lineTo(x + s * .42, y + s * .72); ctx.lineTo(x - s * .42, y + s * .72);
  ctx.lineTo(x - s * .42, y + s * .35); ctx.lineTo(x - s * .72, y + s * .2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b3261c';
  ctx.beginPath(); ctx.arc(x - s * .3, y - s * .05, s * .2, 0, Math.PI * 2); ctx.arc(x + s * .3, y - s * .05, s * .2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a0907'; ctx.fillRect(x - s * .05, y + s * .3, s * .1, s * .42);
  ctx.restore();
}
function label(ctx, text, x, y){
  ctx.save();
  ctx.font = '700 11px Cinzel, Georgia, serif'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.9)'; ctx.strokeText(text, x, y);
  ctx.fillStyle = '#e6d39a'; ctx.fillText(text, x, y);
  ctx.restore();
}
function legend(m){
  const el = document.getElementById('mapMarkerLegend'); if (!el) return;
  const key = m ? m.id + (m.custom_geometry ? ':custom' : '') : '';
  if (el.dataset.key === key) return; el.dataset.key = key;
  const k = m && !m.custom_geometry && window.PD2MapMarkers[m.id];
  const bosses = k ? k.boss.map(b => b.name) : [];
  el.replaceChildren();
  const item = (cls, text) => { const s = document.createElement('span'); const i = document.createElement('i'); i.className = cls; s.append(i, document.createTextNode(text)); el.append(s); };
  if (!k){ item('mk-none', 'Entrance and boss positions are only known for the reference layouts.'); return; }
  item('mk-portal', k.entrance ? (k.entrance.source === 'portal' ? 'Entrance portal' : 'Entrance (arrival point)') : 'No entrance recorded');
  item('mk-boss', bosses.length ? 'Boss: ' + bosses.join(', ') : 'No boss preset in this map file (spawned by game code)');
}
window.drawMapMarkers = function(ctx, m, ox, oy, scale){
  legend(m);
  const k = m && !m.custom_geometry && window.PD2MapMarkers && window.PD2MapMarkers[m.id]; if (!k) return;
  const at = p => [ox + (p.x + .5) * scale, oy + (p.y + .5) * scale];
  const showNames = scale >= 1.6;
  if (k.entrance){ const [x, y] = at(k.entrance), r = clamp(scale * 5, 7, 20); portal(ctx, x, y, r); if (showNames) label(ctx, 'Entrance', x + r * .8 + 5, y); }
  for (const b of k.boss){ const [x, y] = at(b), r = clamp(scale * 4.5, 7, 18); skull(ctx, x, y, r); if (showNames) label(ctx, b.name, x + r + 5, y); }
};
})();
