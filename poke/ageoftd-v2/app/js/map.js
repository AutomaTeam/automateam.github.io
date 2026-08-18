// ============================================================
// AgeOfTD V2 — map.js : registre de cartes (grille, chemin, décor)
// ------------------------------------------------------------
// Plusieurs cartes jouables, chacune définie par son chemin (en
// cellules), son décor et son thème visuel. `load(id)` recalcule
// l'état dérivé EN PLACE sur le même objet `TD.map` — les alias
// `const M = TD.map` posés au chargement des autres modules restent
// donc valides (ils relisent les propriétés au runtime).
// ============================================================
'use strict';

TD.map = (() => {
  const U = TD.util;
  const CELL = 64, COLS = 26, ROWS = 15;
  const OX = 0, OY = 0;             // grille 26×15×64 = 1664×960 = canvas pile, pas de marge
  const W = 1664, H = 960;

  // Bloc « sanctuaire » commun (côté est) — toutes les cartes sortent à l'est.
  const EAST_SHRINE = [[24, 6], [25, 6], [24, 7], [25, 7], [24, 8], [25, 8]];

  // ── catalogue ────────────────────────────────────────────
  // waypoints : segments TOUJOURS axiaux (chaque paire partage c ou r).
  // fly : [ligne d'entrée, ligne de sortie] du chemin de vol (tengu).
  const MAPS = [
    {
      id: 'hanami', name: 'Jardin Hanami', icon: '🌸', theme: 'sakura',
      waypoints: [[-1, 3], [4, 3], [4, 12], [9, 12], [9, 2], [14, 2], [14, 12], [19, 12], [19, 3], [22, 3], [22, 7], [26, 7]],
      fly: [3, 7],
      trees: [[1, 0], [6, 0], [11, 0], [16, 0], [21, 0], [3, 1], [13, 1], [23, 1], [2, 13], [9, 13], [17, 13], [7, 14], [15, 14], [20, 14]],
      rocks: [[4, 0], [14, 0], [19, 0], [8, 1], [18, 1], [5, 13], [12, 13], [21, 13], [10, 14]],
      pond: [[11, 6], [12, 6], [11, 7], [12, 7]],
      shrine: EAST_SHRINE, base: [24, 7],
    },
    {
      id: 'fuji', name: 'Mont Fuji', icon: '🗻', theme: 'fuji',
      waypoints: [[-1, 5], [3, 5], [3, 1], [8, 1], [8, 13], [13, 13], [13, 2], [17, 2], [17, 12], [21, 12], [21, 4], [22, 4], [22, 7], [26, 7]],
      fly: [5, 7],
      trees: [[2, 0], [7, 0], [9, 0], [12, 0], [16, 0], [20, 0], [23, 0], [1, 14], [5, 14], [11, 14], [13, 14], [15, 14], [18, 14], [22, 14]],
      rocks: [[4, 0], [10, 0], [14, 0], [19, 0], [3, 14], [6, 14], [8, 14], [17, 14], [21, 14]],
      pond: [],
      shrine: EAST_SHRINE, base: [24, 7],
    },
    {
      id: 'desert', name: 'Désert Yokai', icon: '🏜️', theme: 'desert',
      waypoints: [[-1, 8], [5, 8], [5, 2], [10, 2], [10, 12], [15, 12], [15, 3], [19, 3], [19, 7], [26, 7]],
      fly: [8, 7],
      trees: [[2, 0], [7, 0], [12, 0], [16, 0], [17, 0], [21, 0], [23, 0], [1, 14], [4, 14], [6, 14], [9, 14], [13, 14], [18, 14], [23, 14]],
      rocks: [[4, 0], [9, 0], [14, 0], [19, 0], [3, 14], [8, 14], [11, 14], [16, 14], [20, 14]],
      pond: [],
      shrine: EAST_SHRINE, base: [24, 7],
    },
    {
      id: 'snow', name: 'Vallée Enneigée', icon: '❄️', theme: 'snow',
      waypoints: [[-1, 2], [21, 2], [21, 6], [4, 6], [4, 10], [21, 10], [21, 7], [26, 7]],
      fly: [2, 7],
      trees: [[2, 0], [7, 0], [12, 0], [17, 0], [22, 0], [5, 1], [10, 1], [15, 1], [20, 1], [3, 13], [8, 13], [14, 13], [19, 13], [1, 14]],
      rocks: [[9, 0], [19, 0], [2, 1], [13, 1], [23, 1], [11, 13], [22, 13], [6, 14], [16, 14]],
      pond: [[11, 8], [12, 8], [11, 9], [12, 9]],
      shrine: EAST_SHRINE, base: [24, 7],
    },
    {
      id: 'swamp', name: 'Marais Hanté', icon: '🐸', theme: 'swamp',
      waypoints: [[-1, 9], [4, 9], [4, 1], [8, 1], [8, 13], [12, 13], [12, 1], [16, 1], [16, 13], [20, 13], [20, 7], [26, 7]],
      fly: [9, 7],
      trees: [[1, 0], [5, 0], [9, 0], [13, 0], [17, 0], [21, 0], [23, 0], [3, 14], [7, 14], [11, 14], [15, 14], [19, 14], [23, 14], [1, 14]],
      rocks: [[3, 0], [11, 0], [15, 0], [19, 0], [5, 14], [9, 14], [13, 14], [17, 14], [21, 14]],
      pond: [[9, 6], [10, 6], [9, 7], [10, 7]],
      shrine: EAST_SHRINE, base: [24, 7],
    },
    {
      id: 'koi', name: 'Étang Koï', icon: '🎏', theme: 'koi',
      waypoints: [[-1, 2], [6, 2], [6, 12], [15, 12], [15, 2], [20, 2], [20, 7], [26, 7]],
      fly: [2, 7],
      trees: [[2, 0], [9, 0], [13, 0], [17, 0], [22, 0], [4, 1], [11, 1], [19, 1], [23, 1], [3, 13], [10, 13], [16, 13], [21, 13], [7, 14]],
      rocks: [[5, 0], [18, 0], [2, 1], [14, 1], [21, 1], [6, 13], [13, 13], [19, 13], [2, 14]],
      pond: [[8, 5], [9, 5], [10, 5], [8, 6], [9, 6], [10, 6]],
      shrine: EAST_SHRINE, base: [24, 7],
    },
  ];

  const cellCenter = (c, r) => ({ x: OX + c * CELL + CELL / 2, y: OY + r * CELL + CELL / 2 });
  const cellAt = (x, y) => ({ c: Math.floor((x - OX) / CELL), r: Math.floor((y - OY) / CELL) });
  const inGrid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;

  // ── état de la carte courante (réécrit par load) ─────────
  let cur = null;
  let points = [], segLen = [], cum = [0], totalLen = 0;
  let flyA = { x: -40, y: 0 }, flyB = { x: W + 40, y: 0 }, flyLen = 0;
  let pathCells = new Set(), blockedCells = new Set();
  let TREES = [], ROCKS = [], POND = [], SHRINE = [];
  let shrineCenter = { x: 1216, y: 380 };

  function pointAt(t) {
    t = U.clamp(t, 0, totalLen);
    let i = 0;
    while (i < segLen.length - 1 && cum[i + 1] < t) i++;
    const k = segLen[i] ? (t - cum[i]) / segLen[i] : 0;
    const a = points[i], b = points[i + 1];
    return {
      x: U.lerp(a.x, b.x, k),
      y: U.lerp(a.y, b.y, k),
      ang: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  function flyPointAt(t) {
    const k = U.clamp(t / flyLen, 0, 1);
    return {
      x: U.lerp(flyA.x, flyB.x, k),
      y: U.lerp(flyA.y, flyB.y, k) + Math.sin(t * 0.012) * 26,
      ang: Math.atan2(flyB.y - flyA.y, flyB.x - flyA.x),
    };
  }

  const isPath = (c, r) => pathCells.has(c + ',' + r);
  const isBlocked = (c, r) => blockedCells.has(c + ',' + r);
  const isBuildable = (c, r) => inGrid(c, r) && !isPath(c, r) && !isBlocked(c, r);
  // nœuds de ressource apparus EN COURS DE PARTIE (respawnNodes) : bloquent la
  // case comme le décor d'origine, jusqu'à la fin de la partie (reset par load()).
  const blockCell = (c, r) => blockedCells.add(c + ',' + r);

  // bornes (en px) d'un groupe contigu de cellules — sert au rendu de l'étang
  function cellsBounds(cells) {
    if (!cells.length) return null;
    let minC = Infinity, minR = Infinity, maxC = -Infinity, maxR = -Infinity;
    for (const [c, r] of cells) { minC = Math.min(minC, c); maxC = Math.max(maxC, c); minR = Math.min(minR, r); maxR = Math.max(maxR, r); }
    const a = cellCenter(minC, minR), b = cellCenter(maxC, maxR);
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, x0: a.x, y0: a.y, x1: b.x, y1: b.y };
  }

  function load(idOrDef) {
    const def = typeof idOrDef === 'string'
      ? (MAPS.find(m => m.id === idOrDef) || MAPS[0])
      : (idOrDef || MAPS[0]);
    cur = def;

    // points + longueurs cumulées
    points = def.waypoints.map(([c, r]) => cellCenter(c, r));
    segLen = []; cum = [0];
    for (let i = 0; i < points.length - 1; i++) {
      const L = U.dist(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
      segLen.push(L); cum.push(cum[i] + L);
    }
    totalLen = cum[cum.length - 1];

    // chemin de vol (ligne droite + ondulation)
    const fr = def.fly || [2, 5];
    flyA = { x: -40, y: cellCenter(0, fr[0]).y };
    flyB = { x: W + 40, y: cellCenter(0, fr[1]).y };
    flyLen = U.dist(flyA.x, flyA.y, flyB.x, flyB.y);

    // cellules du chemin
    pathCells = new Set();
    for (let i = 0; i < def.waypoints.length - 1; i++) {
      let [c1, r1] = def.waypoints[i], [c2, r2] = def.waypoints[i + 1];
      c1 = U.clamp(c1, 0, COLS - 1); c2 = U.clamp(c2, 0, COLS - 1);
      const dc = Math.sign(c2 - c1), dr = Math.sign(r2 - r1);
      let c = c1, r = r1;
      pathCells.add(c + ',' + r);
      while (c !== c2 || r !== r2) { c += dc; r += dr; pathCells.add(c + ',' + r); }
    }

    // décor bloquant
    TREES = def.trees || []; ROCKS = def.rocks || []; POND = def.pond || []; SHRINE = def.shrine || [];
    blockedCells = new Set();
    for (const [c, r] of [...TREES, ...ROCKS, ...POND, ...SHRINE]) blockedCells.add(c + ',' + r);

    // centre du sanctuaire (moyenne des cellules SHRINE, sinon cellule de base)
    if (SHRINE.length) {
      let sx = 0, sy = 0;
      for (const [c, r] of SHRINE) { const p = cellCenter(c, r); sx += p.x; sy += p.y; }
      shrineCenter = { x: sx / SHRINE.length, y: sy / SHRINE.length - 8 };
    } else {
      const b = def.base || [18, 5];
      shrineCenter = cellCenter(b[0], b[1]);
    }

    // propriétés vivantes (relues au runtime par les autres modules)
    api.points = points;
    api.totalLen = totalLen;
    api.flyLen = flyLen;
    api.pathCells = pathCells;
    api.TREES = TREES; api.ROCKS = ROCKS; api.POND = POND; api.SHRINE = SHRINE;
    api.pondBounds = cellsBounds(POND);
    api.shrineCenter = shrineCenter;
    api.theme = def.theme; api.id = def.id; api.name = def.name; api.icon = def.icon;
    api.basePoint = def.base ? cellCenter(def.base[0], def.base[1]) : { ...shrineCenter };
  }

  const api = {
    CELL, COLS, ROWS, OX, OY, W, H,
    cellCenter, cellAt, inGrid, isPath, isBlocked, isBuildable, blockCell,
    pointAt, flyPointAt, cellsBounds,
    load, MAPS,
    list: () => MAPS.map(m => ({ id: m.id, name: m.name, icon: m.icon, theme: m.theme })),
    current: () => cur,
    // remplies par load() :
    points, totalLen, flyLen, pathCells, TREES, ROCKS, POND, SHRINE,
    pondBounds: null, shrineCenter, theme: null, id: null, name: null, icon: null, basePoint: null,
  };

  load(MAPS[0]);
  return api;
})();
