// ============================================================
// AgeOfTD V2 — util.js : maths, easing, helpers
// ============================================================
'use strict';
window.TD = window.TD || {};

TD.util = (() => {
  const TAU = Math.PI * 2;

  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
  const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const choice = arr => arr[Math.floor(Math.random() * arr.length)];
  const chance = p => Math.random() < p;

  // easing
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeOutBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const pulse = (t, speed = 1) => (Math.sin(t * TAU * speed) + 1) / 2;

  // couleurs : '#rrggbb' <-> [r,g,b], lerp
  function hexToRgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function rgbStr(r, g, b, a = 1) {
    return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
  }
  function lerpColor(h1, h2, t) {
    const a = hexToRgb(h1), b = hexToRgb(h2);
    return rgbStr(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
  }
  function withAlpha(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return rgbStr(r, g, b, a);
  }

  // angle le plus court
  function angleLerp(a, b, t) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return a + d * t;
  }

  const fmtGold = n => n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n));

  // arrondi joli pour stats
  const fmt1 = n => (Math.round(n * 10) / 10).toString();

  // rect arrondi (fallback inutile sur navigateurs modernes mais sûr)
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  return {
    TAU, clamp, lerp, dist, dist2, rand, randi, choice, chance,
    easeOutCubic, easeOutBack, easeInOut, pulse,
    hexToRgb, rgbStr, lerpColor, withAlpha, angleLerp, fmtGold, fmt1, rr,
  };
})();
