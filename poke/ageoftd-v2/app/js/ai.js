// ============================================================
// AgeOfTD V2 — ai.js : bot allié co-op
// ------------------------------------------------------------
// Tourne UNIQUEMENT côté hôte (appelé dans game.step). Il joue à
// côté des humains : pose et améliore des tours en gardant une
// réserve d'or pour ne pas vider la banque de l'équipe. Il laisse
// les Omamori aux humains.
// ============================================================
'use strict';

TD.ai = (() => {
  const M = TD.map;
  const INTERVAL = 1.1;                 // une décision toutes les ~1,1 s
  let active = false, timer = 0;
  const owned = new Set();              // ids des tours posées par le bot
  let candidates = null;

  // cellules constructibles adjacentes au chemin (bonne couverture)
  function buildCandidates() {
    const list = [];
    for (let r = 0; r < M.ROWS; r++) {
      for (let c = 0; c < M.COLS; c++) {
        if (!M.isBuildable(c, r)) continue;
        let near = false;
        for (let dc = -1; dc <= 1 && !near; dc++)
          for (let dr = -1; dr <= 1; dr++)
            if (M.pathCells.has((c + dc) + ',' + (r + dr))) { near = true; break; }
        if (near) list.push({ c, r });
      }
    }
    for (let i = list.length - 1; i > 0; i--) {       // mélange → répartition le long du chemin
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function enable() {
    active = true; timer = 0; owned.clear(); candidates = buildCandidates();
    TD.ui.banner('🤖 Bot allié en renfort', 'Il construit à vos côtés', 'clear', 2600);
  }
  function disable() { active = false; owned.clear(); }

  const reserve = () => 40 + 30 * TD.game.humanCount() + TD.game.wave * 4;   // or laissé aux humains
  // le bot piochait bois/pierre dans le même pool que les humains sans aucune marge
  // (contrairement à l'or, protégé par reserve()) — il aggravait la contention des
  // nœuds en co-op ; on lui applique la même logique de réserve sur wood/stone.
  const woodReserve = () => 15 + TD.game.wave * 0.6;
  const stoneReserve = () => 10 + TD.game.wave * 0.5;

  function freeCell() {
    if (!candidates) candidates = buildCandidates();
    for (const cell of candidates)
      if (M.isBuildable(cell.c, cell.r) && !TD.game.towerCells.has(TD.game.cellKey(cell.c, cell.r))) return cell;
    return null;
  }

  const unlocked = () => TD.towers.ORDER.filter(k => TD.towers.DEFS[k].age <= TD.game.age);
  const ownsKind = key => TD.game.towers.some(t => owned.has(t.id) && t.key === key);

  function update(dt) {
    if (!active || TD.game.state !== 'playing') return;
    timer += dt;
    if (timer < INTERVAL) return;
    timer = 0;
    think();
  }

  function think() {
    const g = TD.game, gold = g.gold, res = reserve();
    const afford = cost => gold - cost >= res;
    const D = TD.towers.DEFS;

    // 1) montée d'âge opportuniste (gros surplus seulement)
    if (g.age < 3 && gold >= g.AGES[g.age + 1].cost * 2.2 + res) {
      TD.game.cmd({ k: 'age' }, { remote: true });
      return;
    }

    const cell = freeCell();

    // 2) améliorer une de ses tours (souvent, ou si plus de place libre)
    const upgradable = TD.game.towers.filter(t => owned.has(t.id) && t.upgradeCost() !== null);
    if (upgradable.length && (!cell || Math.random() < 0.34)) {
      upgradable.sort((a, b) => a.upgradeCost() - b.upgradeCost());
      const t = upgradable[0];
      if (afford(t.upgradeCost())) { TD.game.cmd({ k: 'upgrade', id: t.id }, { remote: true }); return; }
    }

    // 3) construire
    if (cell) {
      const canBuild = k => { const d = D[k]; return d.age <= g.age && g.gold - d.cost >= res && g.wood - (d.wood || 0) >= woodReserve() && g.stone - (d.stone || 0) >= stoneReserve(); };
      let pick = null;
      const ownsK = k => TD.game.towers.some(t => owned.has(t.id) && t.key === k);
      const hasBarracks = TD.game.towers.some(t => owned.has(t.id) && t.def.kind === 'barracks' && t.key !== 'townhall');
      if (!ownsK('townhall') && canBuild('townhall') && Math.random() < 0.5) pick = 'townhall';   // économie
      else if (!ownsKind('yuki') && canBuild('yuki')) pick = 'yuki';                              // un ralentisseur
      else if (!hasBarracks && canBuild('dojo') && Math.random() < 0.4) pick = 'dojo';            // une ligne de front
      else {
        const aff = unlocked().filter(canBuild).sort((a, b) => D[b].cost - D[a].cost);
        pick = aff[0] || null;                                                                    // sinon la plus forte abordable
      }
      if (pick) {
        const tw = TD.game.placeTower(pick, cell.c, cell.r, { remote: true });
        // le bot n'a pas de villageois à lui (il n'en recrute/dirige aucun) — sans ça,
        // ses tours resteraient des chantiers inachevés pour toujours (placeTower() en
        // crée un pour TOUT appelant depuis la conversion en économie villageois), ce qui
        // casserait complètement "il construit à vos côtés". Il pose donc toujours fini.
        if (tw) { owned.add(tw.id); TD.game.completeConstruction(tw); }
      }
    }
  }

  // en co-op, les Omamori restent un choix humain
  function wantsCharm() { return false; }
  function chooseCharm(picks) { return picks[0]; }

  return { update, enable, disable, wantsCharm, chooseCharm, get active() { return active; } };
})();
