// ============================================================
// AgeOfTD V2 — synergy.js : synergies & auras de tours (port V1)
// ------------------------------------------------------------
// Profondeur de placement sur la grille :
//  • AURAS : certaines tours projettent une aura qui RENFORCE les
//    tours d'attaque voisines (cadence / dégâts / portée).
//  • ADJACENCE : une tour gagne +dégâts par voisin orthogonal d'un
//    TYPE DIFFÉRENT (« armes combinées »).
// Calculé côté hôte/solo (alimente Tower.stats via `tower._buff`).
// Les anneaux d'aura sont dessinés partout (hôte + invité) à partir
// des positions de tours (déterministe, aucun état réseau requis).
// ============================================================
'use strict';

TD.synergy = (() => {
  const U = TD.util;

  // tours « de soutien » → aura sur les tours d'attaque proches
  const AURAS = {
    taiko:   { range: 122, rateMul: 1.12, color: '#ffb45c', label: '🥁 Rythme de guerre (+cadence)' },
    kitsune: { range: 122, dmgMul: 1.12,  color: '#ff8a5c', label: '🦊 Feu galvanisant (+dégâts)' },
    lantern: { range: 134, rangeMul: 1.12, color: '#ffe08a', label: '🏮 Lumière céleste (+portée)' },
  };
  // +9% dég / voisin différent, max 3 (au lieu de 7%/2 = 14% plafond) : l'adjacence
  // ne coûte aucune case dédiée contrairement aux tours d'aura (12%/aura, elles-
  // mêmes cumulables), mais restait trop en retrait pour peser dans le placement.
  const ADJ_DMG = 0.09, ADJ_MAX = 3;                  // plafond 27% au lieu de 14%
  const CAP = { dmgMul: 1.5, rateMul: 1.4, rangeMul: 1.3 };
  let discovered = false;

  const isAttack = t => t.def.kind !== 'barracks';

  // Recalcule tower._buff pour toutes les tours (hôte / solo).
  function recompute() {
    const towers = TD.game.towers;
    for (const t of towers) { t._buff = null; t._buffLabels = null; }
    let anyBuff = false;

    for (const t of towers) {
      if (!isAttack(t)) continue;
      let dmgMul = 1, rateMul = 1, rangeMul = 1;
      const labels = [];

      // auras des autres tours
      for (const o of towers) {
        if (o === t) continue;
        const a = AURAS[o.key]; if (!a) continue;
        if (U.dist2(t.x, t.y, o.x, o.y) > a.range * a.range) continue;
        if (a.dmgMul) dmgMul *= a.dmgMul;
        if (a.rateMul) rateMul *= a.rateMul;
        if (a.rangeMul) rangeMul *= a.rangeMul;
        labels.push(a.label);
      }

      // adjacence orthogonale : voisins de type différent
      let diff = 0;
      for (const [nc, nr] of [[t.c - 1, t.r], [t.c + 1, t.r], [t.c, t.r - 1], [t.c, t.r + 1]]) {
        const o = TD.game.towerCells.get(nc + ',' + nr);
        if (o && isAttack(o) && o.key !== t.key) diff++;
      }
      diff = Math.min(diff, ADJ_MAX);
      if (diff > 0) { dmgMul *= 1 + ADJ_DMG * diff; labels.push('⚔️ Armes combinées ×' + diff); }

      dmgMul = Math.min(dmgMul, CAP.dmgMul);
      rateMul = Math.min(rateMul, CAP.rateMul);
      rangeMul = Math.min(rangeMul, CAP.rangeMul);

      if (dmgMul !== 1 || rateMul !== 1 || rangeMul !== 1) {
        t._buff = { dmgMul, rateMul, rangeMul };
        t._buffLabels = labels;
        anyBuff = true;
      }
    }

    if (anyBuff && !discovered) {
      discovered = true;
      TD.ui.banner('✨ Synergie de tours !', 'Auras et armes combinées renforcent tes tours proches', 'age', 2800);
    }
  }

  // Anneaux d'aura (sous les tours) — tourne aussi côté invité.
  function drawAuras(ctx, t) {
    for (const tw of TD.game.towers) {
      const a = AURAS[tw.key]; if (!a) continue;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.05 + 0.025 * U.pulse(t * 0.8 + tw.x);
      ctx.fillStyle = a.color;
      ctx.beginPath(); ctx.arc(tw.x, tw.y, a.range, 0, U.TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.16 + 0.08 * U.pulse(t * 0.8 + tw.x);
      ctx.strokeStyle = a.color; ctx.lineWidth = 1.5; ctx.setLineDash([6, 7]);
      ctx.beginPath(); ctx.arc(tw.x, tw.y, a.range, 0, U.TAU); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }

  function reset() { discovered = false; }

  return { recompute, drawAuras, reset, AURAS };
})();
