// ============================================================
// AgeOfTD V2 — bg.js : monde vivant
// Ciel jour/nuit, Fuji, nuages, sol, chemin, décor évolutif par âge,
// lanternes, pétales de sakura, lucioles.
// ============================================================
'use strict';

TD.bg = (() => {
  const U = TD.util, M = TD.map;
  let groundCache = null;
  let dayT = 0.32;                 // 0=minuit, 0.5=midi
  const DAY_LEN = 240;             // secondes par cycle complet
  let petalTimer = 0, fireflyTimer = 0, moteTimer = 0;

  // ── keyframes ciel : [t, haut, bas, lumière] ─────────────
  const SKY = [
    [0.00, '#131a3d', '#2c2a55', 0.20],
    [0.10, '#1c2256', '#473668', 0.28],
    [0.20, '#6a5fa8', '#ffb289', 0.60],
    [0.30, '#7fc4ef', '#d9f2ff', 0.95],
    [0.50, '#8fd3ff', '#eaf9ff', 1.00],
    [0.65, '#84b9f0', '#ffe9c4', 0.95],
    [0.75, '#b06ab8', '#ff9d76', 0.68],
    [0.85, '#3a3a76', '#6e4f96', 0.38],
    [1.00, '#131a3d', '#2c2a55', 0.20],
  ];

  function skyState() {
    let i = 0;
    while (SKY[i + 1][0] < dayT) i++;
    const a = SKY[i], b = SKY[i + 1];
    const k = (dayT - a[0]) / (b[0] - a[0]);
    return {
      top: U.lerpColor(a[1], b[1], k),
      bot: U.lerpColor(a[2], b[2], k),
      light: U.lerp(a[3], b[3], k),
    };
  }

  // ── étoiles, nuages (précalculés) ────────────────────────
  const stars = [];
  for (let i = 0; i < 120; i++) stars.push({ x: U.rand(0, M.W), y: U.rand(0, 330), s: U.rand(0.6, 2), p: U.rand(U.TAU) });

  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const blobs = [];
    const n = U.randi(3, 5);
    for (let j = 0; j < n; j++) blobs.push({ dx: j * U.rand(22, 38) - n * 14, dy: U.rand(-10, 10), r: U.rand(18, 36) });
    clouds.push({ x: U.rand(0, M.W + 120), y: U.rand(30, 240), v: U.rand(4, 11), blobs, back: i < 5 });
  }

  // ── thèmes de carte : palettes sol/chemin/eau + style décor ──
  const THEMES = {
    sakura: {
      grassTop: '#a9df97', grassBot: '#84cc78', pathEdge: '#b89b6c', pathFill: '#ecd9a8',
      rock1: '#9aa3ad', rock2: '#b9c2cc', rockMoss: 'rgba(110,160,90,0.8)',
      water: '#76b5d8', water2: '#9bd1ea', hill1: '#23414a', hill2: '#7cc28a',
      tree: 'sakura', backdrop: 'fuji', ambient: 'petal', ambientColors: ['#ffc7dd', '#ffb3d2', '#ffd9e8'],
    },
    fuji: {
      grassTop: '#bfe6c8', grassBot: '#8fcfa0', pathEdge: '#9b8e74', pathFill: '#e9e3d2',
      rock1: '#9aa3ad', rock2: '#cdd6e0', rockMoss: 'rgba(150,180,150,0.7)',
      water: '#86c4e0', water2: '#b6e0f0', hill1: '#3a5a6e', hill2: '#9fc9d6',
      tree: 'pine', backdrop: 'fuji', ambient: 'snow', ambientColors: ['#ffffff', '#eaf6ff'],
    },
    desert: {
      grassTop: '#ecd6a0', grassBot: '#d8b977', pathEdge: '#b8915a', pathFill: '#f2dfa8',
      rock1: '#c2a878', rock2: '#dccaa0', rockMoss: 'rgba(180,150,90,0.6)',
      water: '#8fc8d8', water2: '#b8e0e8', hill1: '#b88a52', hill2: '#e6c98c',
      tree: 'palm', backdrop: 'dunes', ambient: 'sand', ambientColors: ['#f3e3b0', '#e8d49a'],
    },
    snow: {
      grassTop: '#e8eff6', grassBot: '#cfdeed', pathEdge: '#9aa6b8', pathFill: '#f4f8fc',
      rock1: '#aab4c2', rock2: '#d8e1ec', rockMoss: 'rgba(200,220,235,0.7)',
      water: '#a6d4ea', water2: '#d4eef8', hill1: '#8fa6c0', hill2: '#dde9f4',
      tree: 'pine', backdrop: 'peaks', ambient: 'snow', ambientColors: ['#ffffff', '#dff0ff'],
    },
    swamp: {
      grassTop: '#85ab6e', grassBot: '#5c8050', pathEdge: '#6d5a3e', pathFill: '#b6a06e',
      rock1: '#7e8a72', rock2: '#9aa888', rockMoss: 'rgba(90,120,70,0.85)',
      water: '#5a7d63', water2: '#79a07e', hill1: '#2c4636', hill2: '#5f7e5a',
      tree: 'dead', backdrop: 'none', ambient: 'leaf', ambientColors: ['#9bb06a', '#7c9450', '#b5c47e'],
    },
    koi: {
      grassTop: '#a6e3a2', grassBot: '#7cc88a', pathEdge: '#b89b6c', pathFill: '#ecd9a8',
      rock1: '#9aa3ad', rock2: '#b9c2cc', rockMoss: 'rgba(110,160,90,0.8)',
      water: '#4fa8d4', water2: '#92d2ea', hill1: '#236a52', hill2: '#7cd1a0',
      tree: 'sakura', backdrop: 'fuji', ambient: 'petal', ambientColors: ['#ffc7dd', '#ffd9e8', '#fff0a0'],
    },
  };
  let theme = THEMES.sakura;     // mis à jour par rebuild()
  let lanterns = [];             // le long du chemin (âge 1+)
  let flags = [];                // bannières sashimono aux coudes (âge 2+)

  // Recalcule tout l'état dérivé de la carte courante (chemin, décor, thème).
  // Appelé au boot et à chaque changement de carte (depuis game.selectMap).
  function rebuild() {
    theme = THEMES[M.theme] || THEMES.sakura;
    lanterns = [];
    for (let d = 200; d < M.totalLen - 120; d += 330) {
      const p = M.pointAt(d);
      const side = (lanterns.length % 2 === 0) ? 1 : -1;
      lanterns.push({ x: p.x + Math.cos(p.ang + Math.PI / 2) * 44 * side, y: p.y + Math.sin(p.ang + Math.PI / 2) * 44 * side });
    }
    flags = [];
    for (const i of [2, 4, 6]) {
      if (i >= M.points.length) continue;
      const c = M.points[i];
      flags.push({ x: c.x + 40, y: c.y - 40, hue: i % 2 ? '#ff6b8d' : '#7fd1ff' });
    }
    groundCache = null;          // force la reconstruction du sol/chemin/étang
  }

  // ── cache sol + chemin + étang (statique) ────────────────
  function buildGround() {
    const c = document.createElement('canvas'); c.width = M.W; c.height = M.H;
    const g = c.getContext('2d');
    // herbe / sable / neige selon thème
    const gr = g.createLinearGradient(0, 0, 0, M.H);
    gr.addColorStop(0, theme.grassTop); gr.addColorStop(1, theme.grassBot);
    g.fillStyle = gr; g.fillRect(0, 0, M.W, M.H);
    // touffes / mouchetis
    for (let i = 0; i < 650; i++) {
      g.fillStyle = U.chance(0.5) ? 'rgba(255,255,255,0.10)' : 'rgba(50,50,50,0.07)';
      const x = U.rand(0, M.W), y = U.rand(0, M.H);
      g.beginPath(); g.ellipse(x, y, U.rand(2, 7), U.rand(1.5, 3.5), 0, 0, U.TAU); g.fill();
    }
    // damier très léger sur cases constructibles (lisibilité grille)
    for (let r = 0; r < M.ROWS; r++) for (let col = 0; col < M.COLS; col++) {
      if (!M.isBuildable(col, r) || (col + r) % 2 === 0) continue;
      g.fillStyle = 'rgba(255,255,255,0.045)';
      g.fillRect(M.OX + col * M.CELL, M.OY + r * M.CELL, M.CELL, M.CELL);
    }
    // chemin : bord sombre puis revêtement
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = theme.pathEdge; g.lineWidth = 52;
    pathStroke(g);
    g.strokeStyle = theme.pathFill; g.lineWidth = 44;
    pathStroke(g);
    // pavés
    const paveDark = U.withAlpha(theme.pathEdge, 0.5), paveLight = U.withAlpha(theme.pathFill, 0.6);
    for (let d = 14; d < M.totalLen; d += 26) {
      const p = M.pointAt(d);
      g.fillStyle = U.chance(0.5) ? paveDark : paveLight;
      const off = U.rand(-13, 13);
      g.beginPath();
      g.ellipse(p.x + Math.cos(p.ang + Math.PI / 2) * off, p.y + Math.sin(p.ang + Math.PI / 2) * off, U.rand(4, 7), U.rand(3, 5), U.rand(U.TAU), 0, U.TAU);
      g.fill();
    }
    // étang (si la carte en a un)
    const pc = pondRect();
    if (pc) {
      g.fillStyle = theme.water;
      U.rr(g, pc.x, pc.y, pc.w, pc.h, 26); g.fill();
      g.fillStyle = theme.water2;
      U.rr(g, pc.x + 6, pc.y + 6, pc.w - 12, pc.h - 12, 20); g.fill();
    }
    // (les rochers sont désormais dessinés dynamiquement — voir drawRock/drawRockRubble,
    //  pour partager la même logique actif/épuisé que les arbres, cf. game.depletedRockCells)
    groundCache = c;
  }
  function pathStroke(g) {
    g.beginPath();
    g.moveTo(M.points[0].x, M.points[0].y);
    for (let i = 1; i < M.points.length; i++) g.lineTo(M.points[i].x, M.points[i].y);
    g.stroke();
  }
  function pondRect() {
    const b = M.pondBounds;
    if (!b) return null;
    return { x: b.x0 - 28, y: b.y0 - 26, w: (b.x1 - b.x0) + 56, h: (b.y1 - b.y0) + 52, cx: b.cx, cy: b.cy };
  }

  // ── update : cycle + particules ambiantes ────────────────
  function update(dt, time) {
    dayT = (dayT + dt / DAY_LEN) % 1;
    for (const cl of clouds) {
      cl.x += cl.v * dt * (cl.back ? 0.5 : 1);
      if (cl.x > M.W + 140) { cl.x = -160; cl.y = U.rand(30, 240); }
    }
    // particules ambiantes selon thème (pétales / neige / sable / feuilles)
    petalTimer -= dt;
    if (petalTimer <= 0 && theme.ambient !== 'none') {
      const amb = theme.ambient, col = U.choice(theme.ambientColors);
      if (amb === 'snow') {
        petalTimer = U.rand(0.12, 0.3);
        TD.fx.spawn({
          x: U.rand(-20, M.W - 160), y: U.rand(-30, -10),
          vx: U.rand(-8, 22), vy: U.rand(26, 52),
          life: U.rand(7, 11), size: U.rand(2.5, 5), endSize: U.rand(2, 4),
          color: col, type: 'glow', layer: 2, vr: U.rand(-1, 1), ambient: true, alpha: 0.9,
        });
      } else if (amb === 'sand') {
        petalTimer = U.rand(0.05, 0.16);
        TD.fx.spawn({
          x: U.rand(-40, -10), y: U.rand(570, 930),
          vx: U.rand(130, 230), vy: U.rand(-8, 8),
          life: U.rand(3, 5.5), size: U.rand(1.5, 3.5), endSize: 0,
          color: col, type: 'glow', layer: 2, ambient: true, alpha: 0.45,
        });
      } else {   // petal | leaf
        petalTimer = U.rand(0.25, 0.7);
        TD.fx.spawn({
          x: U.rand(-40, M.W - 180), y: U.rand(-30, -10),
          vx: U.rand(18, 55), vy: U.rand(22, 48),
          life: U.rand(9, 14), size: U.rand(5, 9),
          color: col, type: 'petal', layer: 2, vr: U.rand(-2, 2), ambient: true, alpha: 0.9,
        });
      }
    }
    // lucioles la nuit
    const light = skyState().light;
    if (light < 0.45) {
      fireflyTimer -= dt;
      if (fireflyTimer <= 0) {
        fireflyTimer = U.rand(0.5, 1.4);
        TD.fx.spawn({
          x: U.rand(60, M.W - 60), y: U.rand(300, M.H - 40),
          vx: U.rand(-14, 14), vy: U.rand(-16, -4),
          life: U.rand(3, 6), size: U.rand(2.5, 4), endSize: 0,
          color: '#d8ff7a', type: 'glow', layer: 2, ambient: true,
        });
      }
    }
    // motes arcanes (âge 3) autour du sanctuaire
    if (TD.game && TD.game.age >= 3) {
      moteTimer -= dt;
      if (moteTimer <= 0) {
        moteTimer = U.rand(0.2, 0.5);
        const sc = M.shrineCenter;
        TD.fx.spawn({
          x: sc.x + U.rand(-70, 70), y: sc.y + U.rand(-10, 70),
          vx: U.rand(-8, 8), vy: U.rand(-34, -16),
          life: U.rand(1.5, 3), size: U.rand(2, 4), endSize: 0,
          color: U.choice(['#c79bff', '#8fe3ff']), type: 'glow', layer: 2, ambient: true,
        });
      }
    }
  }

  // ── dessins décor ────────────────────────────────────────
  function drawTree(ctx, x, y, t, seed) {
    const sway = Math.sin(t * 0.8 + seed) * 0.04;
    if (theme.tree === 'pine') { drawPine(ctx, x, y, sway); return; }
    if (theme.tree === 'palm') { drawPalm(ctx, x, y, t, seed, sway); return; }
    if (theme.tree === 'dead') { drawDeadTree(ctx, x, y, sway); return; }
    // sakura (défaut)
    ctx.save();
    ctx.translate(x, y + 18);
    ctx.fillStyle = '#8a6248';
    ctx.beginPath();
    ctx.moveTo(-5, 0); ctx.quadraticCurveTo(-3 + sway * 40, -22, sway * 60 - 2, -34);
    ctx.lineTo(sway * 60 + 4, -34); ctx.quadraticCurveTo(4, -20, 6, 0);
    ctx.fill();
    ctx.rotate(sway);
    const blobs = [[-16, -42, 16], [14, -44, 15], [0, -56, 18], [-2, -38, 14]];
    for (const [bx, by, r] of blobs) {
      ctx.fillStyle = '#ff9ec7';
      ctx.beginPath(); ctx.arc(bx, by + 2, r, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#ffc2db';
      ctx.beginPath(); ctx.arc(bx - 2, by - 2, r * 0.88, 0, U.TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(-8, -54, 7, 0, U.TAU); ctx.fill();
    ctx.restore();
  }

  // conifère (Fuji / neige) — tronc + étages triangulaires, calotte de neige sur thèmes froids
  function drawPine(ctx, x, y, sway) {
    ctx.save();
    ctx.translate(x, y + 18); ctx.rotate(sway * 0.6);
    ctx.fillStyle = '#7a5a3c'; ctx.fillRect(-4, -14, 8, 16);
    const tiers = [[22, -16], [18, -32], [13, -48]];
    for (const [w, by] of tiers) {
      ctx.fillStyle = '#3f7d54';
      ctx.beginPath(); ctx.moveTo(-w, by); ctx.lineTo(0, by - 22); ctx.lineTo(w, by); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#56a06b';
      ctx.beginPath(); ctx.moveTo(-w + 4, by - 3); ctx.lineTo(-2, by - 18); ctx.lineTo(3, by - 4); ctx.closePath(); ctx.fill();
    }
    if (theme.ambient === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.moveTo(-9, -44); ctx.lineTo(0, -64); ctx.lineTo(8, -46); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // palmier / yucca (désert) — tronc courbé + frondes
  function drawPalm(ctx, x, y, t, seed, sway) {
    ctx.save();
    ctx.translate(x, y + 18);
    ctx.strokeStyle = '#9a6e44'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    const tx = sway * 80 + 6, ty = -48;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(tx * 0.6 + 3, -26, tx, ty); ctx.stroke();
    ctx.fillStyle = '#5fa860';
    for (let a = 0; a < 6; a++) {
      const ang = -Math.PI / 2 + (a - 2.5) * 0.52 + Math.sin(t * 0.6 + seed + a) * 0.05;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(20, -5, 36, 2); ctx.quadraticCurveTo(20, 5, 0, 3); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#a6743a';
    ctx.beginPath(); ctx.arc(tx, ty, 5, 0, U.TAU); ctx.fill();
    ctx.restore();
  }

  // arbre mort (marais) — tronc nu + branches anguleuses
  function drawDeadTree(ctx, x, y, sway) {
    ctx.save();
    ctx.translate(x, y + 18); ctx.rotate(sway * 0.5);
    ctx.strokeStyle = '#5b4636'; ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -34); ctx.stroke();
    ctx.lineWidth = 3.2;
    const branches = [[-1, -22, -16, -34], [1, -28, 16, -38], [0, -34, -11, -50], [0, -34, 12, -48]];
    for (const [x1, y1, x2, y2] of branches) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    ctx.restore();
  }

  // souche : arbre épuisé par la récolte (villageois)
  function drawStump(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y + 18);
    ctx.fillStyle = 'rgba(30,20,10,0.18)';
    ctx.beginPath(); ctx.ellipse(0, 2, 16, 6, 0, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#8a6a4a';
    ctx.beginPath(); ctx.ellipse(0, -4, 11, 8, 0, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = '#6e5138'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, -4, 7, 5, 0, 0, U.TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -4, 3.5, 2.5, 0, 0, U.TAU); ctx.stroke();
    ctx.restore();
  }

  // rocher (nœud de pierre actif) — même silhouette que l'ancien rendu statique
  function drawRock(ctx, x, y) {
    ctx.fillStyle = theme.rock1;
    ctx.beginPath(); ctx.ellipse(x, y + 8, 22, 15, 0, 0, U.TAU); ctx.fill();
    ctx.fillStyle = theme.rock2;
    ctx.beginPath(); ctx.ellipse(x - 5, y + 2, 16, 12, -0.3, 0, U.TAU); ctx.fill();
    ctx.fillStyle = theme.rockMoss;
    ctx.beginPath(); ctx.ellipse(x + 12, y + 16, 8, 4, 0, 0, U.TAU); ctx.fill();
  }

  // gravats : rocher épuisé par la récolte
  function drawRockRubble(ctx, x, y) {
    ctx.fillStyle = 'rgba(30,20,10,0.14)';
    ctx.beginPath(); ctx.ellipse(x, y + 10, 20, 7, 0, 0, U.TAU); ctx.fill();
    ctx.fillStyle = U.withAlpha(theme.rock1, 0.6);
    for (const [dx, dy, r] of [[-8, 4, 6], [6, 8, 5], [0, -2, 4], [12, 2, 4.5]]) {
      ctx.beginPath(); ctx.ellipse(x + dx, y + dy, r, r * 0.7, 0, 0, U.TAU); ctx.fill();
    }
  }

  function drawTorii(ctx, x, y, s = 1, glow = false) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = '#e84e4e';
    ctx.fillRect(-26, -14, 8, 50);
    ctx.fillRect(18, -14, 8, 50);
    ctx.fillRect(-30, -16, 60, 7);
    ctx.beginPath();
    ctx.moveTo(-38, -28); ctx.quadraticCurveTo(0, -38, 38, -28);
    ctx.lineTo(38, -21); ctx.quadraticCurveTo(0, -30, -38, -21);
    ctx.fill();
    ctx.fillStyle = '#262633';
    ctx.fillRect(-40, -30, 80, 4);
    if (glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(TD.fx.glowSprite('#ff8a7a'), -40, -45, 80, 80);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawStoneLantern(ctx, x, y) {
    ctx.fillStyle = '#aab2bc';
    ctx.fillRect(x - 3, y - 12, 6, 14);
    ctx.fillStyle = '#c4ccd6';
    U.rr(ctx, x - 7, y - 22, 14, 11, 3); ctx.fill();
    ctx.fillStyle = '#98a0aa';
    ctx.beginPath();
    ctx.moveTo(-11 + x, y - 21); ctx.lineTo(x, y - 30); ctx.lineTo(x + 11, y - 21);
    ctx.fill();
    ctx.fillStyle = '#ffe9b0';
    ctx.fillRect(x - 3.5, y - 20, 7, 7);
  }

  function drawShrine(ctx, t, age) {
    const x = M.shrineCenter.x, y = M.shrineCenter.y + 40;
    ctx.save();
    // socle
    ctx.fillStyle = '#cfd6de';
    U.rr(ctx, x - 64, y - 8, 128, 26, 8); ctx.fill();
    ctx.fillStyle = '#e6ecf2';
    U.rr(ctx, x - 56, y - 12, 112, 18, 8); ctx.fill();
    if (age === 0) {
      // hokora de pierre
      ctx.fillStyle = '#b9c2cc';
      U.rr(ctx, x - 22, y - 52, 44, 42, 5); ctx.fill();
      ctx.fillStyle = '#8d959f';
      ctx.beginPath(); ctx.moveTo(x - 32, y - 50); ctx.lineTo(x, y - 72); ctx.lineTo(x + 32, y - 50); ctx.fill();
      ctx.fillStyle = '#5d646e';
      U.rr(ctx, x - 9, y - 38, 18, 26, 3); ctx.fill();
    } else {
      // pagode : nombre d'étages = âge
      const tiers = Math.min(age, 3);
      let w = 96, yy = y - 6;
      ctx.fillStyle = '#f5e8d8';
      for (let i = 0; i < tiers; i++) {
        const h = 34 - i * 4;
        ctx.fillStyle = i % 2 ? '#fdf3e4' : '#f5e3cc';
        U.rr(ctx, x - w / 2 + 10, yy - h, w - 20, h, 4); ctx.fill();
        // toit incurvé rouge
        ctx.fillStyle = '#d94f4f';
        ctx.beginPath();
        ctx.moveTo(x - w / 2 - 8, yy - h + 4);
        ctx.quadraticCurveTo(x, yy - h - 26, x + w / 2 + 8, yy - h + 4);
        ctx.quadraticCurveTo(x, yy - h - 12, x - w / 2 - 8, yy - h + 4);
        ctx.fill();
        yy -= h + 12; w -= 18;
      }
      // flèche dorée
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(x - 2, yy - 6, 4, 14);
      ctx.beginPath(); ctx.arc(x, yy - 9, 4, 0, U.TAU); ctx.fill();
    }
    if (age >= 1) {
      drawTorii(ctx, x - 86, y - 18, 0.8, age >= 3);
      drawStoneLantern(ctx, x + 78, y + 6);
    }
    if (age >= 3) {
      // cristaux flottants
      for (let i = 0; i < 3; i++) {
        const a = t * 0.7 + i * U.TAU / 3;
        const cx = x + Math.cos(a) * 78, cy = y - 64 + Math.sin(a * 1.3) * 14;
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(t + i);
        ctx.fillStyle = i % 2 ? '#b388ff' : '#7adcff';
        ctx.beginPath();
        ctx.moveTo(0, -11); ctx.lineTo(7, 0); ctx.lineTo(0, 11); ctx.lineTo(-7, 0);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawFlag(ctx, f, t) {
    ctx.strokeStyle = '#6d5230'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(f.x, f.y + 38); ctx.lineTo(f.x, f.y - 30); ctx.stroke();
    const w1 = Math.sin(t * 3.1 + f.x) * 4, w2 = Math.sin(t * 3.1 + f.x + 1.2) * 5;
    ctx.fillStyle = f.hue;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y - 30);
    ctx.quadraticCurveTo(f.x + 12 + w1, f.y - 22, f.x + 22 + w2, f.y - 28);
    ctx.lineTo(f.x + 22 + w2, f.y + 4);
    ctx.quadraticCurveTo(f.x + 12 + w1, f.y - 2, f.x, f.y + 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(f.x + 11 + w1, f.y - 12, 4, 0, U.TAU); ctx.fill();
  }

  // ── draw principal (sous les entités) ────────────────────
  function draw(ctx, t) {
    if (!groundCache) buildGround();
    const sky = skyState();
    // ciel
    const gr = ctx.createLinearGradient(0, 0, 0, 400);
    gr.addColorStop(0, sky.top); gr.addColorStop(1, sky.bot);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, M.W, 400);
    // étoiles
    if (sky.light < 0.5) {
      const a = (0.5 - sky.light) * 2;
      for (const s of stars) {
        ctx.globalAlpha = a * (0.4 + 0.6 * U.pulse(t * 0.4 + s.p));
        ctx.fillStyle = '#fff7e0';
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      ctx.globalAlpha = 1;
    }
    // soleil / lune
    const sunT = (dayT - 0.18) / 0.62;
    if (sunT > 0 && sunT < 1) {
      const sx = U.lerp(80, M.W - 80, sunT), sy = 300 - Math.sin(sunT * Math.PI) * 240;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(TD.fx.glowSprite('#ffd98a'), sx - 70, sy - 70, 140, 140);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(sx, sy, 26, 0, U.TAU); ctx.fill();
    }
    const moonT = (((dayT + 0.5) % 1) - 0.18) / 0.62;
    if (moonT > 0 && moonT < 1 && sky.light < 0.6) {
      const mx = U.lerp(80, M.W - 80, moonT), my = 280 - Math.sin(moonT * Math.PI) * 220;
      ctx.fillStyle = '#f4f0ff';
      ctx.beginPath(); ctx.arc(mx, my, 20, 0, U.TAU); ctx.fill();
      ctx.fillStyle = sky.top;
      ctx.beginPath(); ctx.arc(mx + 8, my - 5, 16, 0, U.TAU); ctx.fill();
    }
    // nuages arrière
    drawClouds(ctx, true, sky.light);
    // arrière-plan (montagne / dunes / pics) + collines, selon thème
    drawBackdrop(ctx, sky.light);
    // nuages avant
    drawClouds(ctx, false, sky.light);
    // sol + chemin (cache)
    ctx.drawImage(groundCache, 0, 0);
    // étang : reflets animés + koi (âge 2+) — seulement si la carte en a un
    const pr = pondRect();
    if (pr) {
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = 0.4 + 0.3 * U.pulse(t * 0.7 + i * 1.7);
        ctx.strokeStyle = U.lerpColor(theme.water2, '#ffffff', 0.5); ctx.lineWidth = 2;
        ctx.beginPath();
        const gx = pr.cx + Math.sin(i * 2.3) * 30, gy = pr.cy + Math.cos(i * 1.9) * 18;
        ctx.moveTo(gx - 8, gy); ctx.quadraticCurveTo(gx, gy - 3, gx + 8, gy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (TD.game && TD.game.age >= 2) {
        const ka = t * 0.9;
        const kx = pr.cx + Math.cos(ka) * 26, ky = pr.cy + Math.sin(ka * 2) * 14;
        ctx.save();
        ctx.translate(kx, ky); ctx.rotate(ka + Math.PI / 2);
        ctx.fillStyle = '#ff7a59';
        ctx.beginPath(); ctx.ellipse(0, 0, 5, 9, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(0, 4, 4, 5, 0, 0, U.TAU); ctx.fill();
        ctx.restore();
      }
      // nénuphar
      ctx.fillStyle = '#6fbe6f';
      ctx.beginPath(); ctx.ellipse(pr.x + 22, pr.y + 16, 11, 7, 0.3, 0.25, U.TAU); ctx.fill();
      ctx.fillStyle = '#ffb3d2';
      ctx.beginPath(); ctx.arc(pr.x + 22, pr.y + 13, 4, 0, U.TAU); ctx.fill();
    }

    // torii d'entrée
    const sp = M.points[0];
    drawTorii(ctx, sp.x + 70, sp.y - 4, 1.15, sky.light < 0.5);

    // arbres (souche si le nœud a été épuisé par la récolte)
    const depTrees = TD.game ? TD.game.depletedTreeCells : null;
    M.TREES.forEach(([c, r], i) => {
      const ctr = M.cellCenter(c, r);
      if (depTrees && depTrees.has(c + ',' + r)) drawStump(ctx, ctr.x, ctr.y);
      else drawTree(ctx, ctr.x, ctr.y, t, i * 1.7);
    });
    // rochers (dessinés dynamiquement — actif ou gravats si épuisé — voir game.depletedRockCells)
    const depRocks = TD.game ? TD.game.depletedRockCells : null;
    M.ROCKS.forEach(([c, r]) => {
      const ctr = M.cellCenter(c, r);
      if (depRocks && depRocks.has(c + ',' + r)) drawRockRubble(ctx, ctr.x, ctr.y);
      else drawRock(ctx, ctr.x, ctr.y);
    });
    // nœuds de bois/pierre réapparus en cours de partie (respawnNodes), hors décor de carte d'origine
    if (TD.game && TD.game.extraNodes) {
      for (const n of TD.game.extraNodes) {
        if (n.type === 'wood') drawTree(ctx, n.x, n.y, t, n.x * 0.01);
        else drawRock(ctx, n.x, n.y);
      }
    }

    // décor par âge
    const age = TD.game ? TD.game.age : 0;
    if (age >= 1) for (const l of lanterns) drawStoneLantern(ctx, l.x, l.y);
    if (age >= 2) for (const f of flags) drawFlag(ctx, f, t);
    drawShrine(ctx, t, age);
  }

  function drawClouds(ctx, back, light) {
    const col = U.lerpColor('#42466e', '#ffffff', light);
    ctx.fillStyle = col;
    for (const cl of clouds) {
      if (cl.back !== back) continue;
      ctx.globalAlpha = back ? 0.5 : 0.82;
      for (const b of cl.blobs) {
        ctx.beginPath(); ctx.arc(cl.x + b.dx, cl.y + b.dy, b.r, 0, U.TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ── arrière-plan lointain selon thème ────────────────────
  function drawBackdrop(ctx, light) {
    // les silhouettes ci-dessous sont dessinées à la main pour un canvas 1280 de large ;
    // on les réétale uniformément sur la largeur réelle plutôt que de refaire chaque courbe.
    ctx.save();
    ctx.scale(M.W / 1280, 1);
    const b = theme.backdrop;
    if (b === 'fuji') {
      ctx.fillStyle = U.lerpColor('#2e3258', '#b9c6e2', light);
      ctx.beginPath();
      ctx.moveTo(120, 360);
      ctx.quadraticCurveTo(330, 130, 430, 118);
      ctx.lineTo(470, 118);
      ctx.quadraticCurveTo(570, 130, 790, 360);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = U.lerpColor('#cdd4ea', '#ffffff', light);
      ctx.beginPath();
      ctx.moveTo(372, 168);
      ctx.quadraticCurveTo(430, 122, 470, 118); ctx.lineTo(430, 118);
      ctx.quadraticCurveTo(500, 124, 532, 168);
      ctx.quadraticCurveTo(505, 152, 488, 172);
      ctx.quadraticCurveTo(468, 150, 450, 174);
      ctx.quadraticCurveTo(430, 152, 410, 172);
      ctx.quadraticCurveTo(392, 154, 372, 168);
      ctx.fill();
    } else if (b === 'peaks') {
      const base = U.lerpColor('#2e3a52', '#9fb6cf', light);
      const snow = U.lerpColor('#cdd8ea', '#ffffff', light);
      for (const [x0, x1, py] of [[120, 360, 96], [400, 700, 140], [720, 1040, 110], [980, 1280, 150]]) {
        const ax = (x0 + x1) / 2;
        ctx.fillStyle = base;
        ctx.beginPath(); ctx.moveTo(x0, 360); ctx.lineTo(ax, py); ctx.lineTo(x1, 360); ctx.closePath(); ctx.fill();
        ctx.fillStyle = snow;
        ctx.beginPath();
        ctx.moveTo(ax, py);
        ctx.lineTo(ax - 34, py + 64); ctx.lineTo(ax - 14, py + 50);
        ctx.lineTo(ax, py + 70); ctx.lineTo(ax + 14, py + 50);
        ctx.lineTo(ax + 34, py + 64); ctx.closePath(); ctx.fill();
      }
    } else if (b === 'dunes') {
      ctx.fillStyle = U.lerpColor('#a9753f', '#e9c98c', light);
      ctx.beginPath();
      ctx.moveTo(0, 360);
      ctx.quadraticCurveTo(300, 250, 600, 320);
      ctx.quadraticCurveTo(900, 380, 1280, 280);
      ctx.lineTo(1280, 380); ctx.lineTo(0, 380); ctx.fill();
      ctx.fillStyle = U.lerpColor('#8a5d31', '#d8b072', light);
      ctx.beginPath();
      ctx.moveTo(0, 384);
      ctx.quadraticCurveTo(380, 304, 760, 360);
      ctx.quadraticCurveTo(1040, 398, 1280, 338);
      ctx.lineTo(1280, 412); ctx.lineTo(0, 412); ctx.fill();
    }
    // collines de premier plan (toujours)
    ctx.fillStyle = U.lerpColor(theme.hill1, theme.hill2, light);
    ctx.beginPath();
    ctx.moveTo(0, 400);
    ctx.quadraticCurveTo(250, 300, 520, 372);
    ctx.quadraticCurveTo(800, 430, 1280, 330);
    ctx.lineTo(1280, 460); ctx.lineTo(0, 460);
    ctx.fill();
    ctx.restore();
  }

  // assombrissement nocturne (après entités), puis lueurs chaudes
  function applyLight(ctx) {
    const light = skyState().light;
    if (light >= 0.99) return;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = U.lerpColor('#46509e', '#ffffff', light);
    ctx.fillRect(0, 0, M.W, M.H);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawGlows(ctx, t) {
    const light = skyState().light;
    const age = TD.game ? TD.game.age : 0;
    if (light < 0.62 && age >= 1) {
      ctx.globalCompositeOperation = 'lighter';
      const a = (0.62 - light) / 0.62;
      for (const l of lanterns) {
        ctx.globalAlpha = a * (0.55 + 0.18 * U.pulse(t * 1.3 + l.x));
        ctx.drawImage(TD.fx.glowSprite('#ffbe5e'), l.x - 34, l.y - 50, 68, 68);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  rebuild();   // état initial (carte par défaut déjà chargée par map.js)

  return {
    update, draw, applyLight, drawGlows, rebuild,
    get light() { return skyState().light; },
    get dayT() { return dayT; },
    set dayT(v) { dayT = v; },
  };
})();
