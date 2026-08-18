// ============================================================
// AgeOfTD V2 — charms.js : Omamori (porte-bonheur) — un choix
// parmi trois toutes les 5 vagues. Effets globaux permanents.
// ============================================================
'use strict';

TD.charms = (() => {
  const LIST = [
    { key: 'daruma',   icon: '💪', name: 'Daruma de Force',    desc: '+12% de dégâts pour toutes les tours', apply: () => TD.mods.dmgMul += 0.12 },
    { key: 'koban',    icon: '🪙', name: 'Pièce Koban',        desc: "+15% d'or sur les éliminations",       apply: () => TD.mods.goldMul += 0.15 },
    { key: 'eventail', icon: '🪭', name: 'Éventail Céleste',   desc: "+10% de vitesse d'attaque",            apply: () => TD.mods.rateMul += 0.10 },
    { key: 'coeur',    icon: '💖', name: 'Cœur de Tanuki',     desc: '+6 vies immédiatement',                apply: () => { TD.game.maxLives += 6; TD.game.lives += 6; } },
    { key: 'marchand', icon: '🏷️', name: 'Marchand Honnête',   desc: 'Améliorations 15% moins chères',       apply: () => TD.mods.upgCostMul -= 0.15 },
    { key: 'givre',    icon: '🧊', name: 'Souffle Givré',      desc: 'Ralentissements +10 points',           apply: () => TD.mods.slowBonus += 0.10 },
    { key: 'oeil',     icon: '👁️', name: 'Œil du Kitsune',     desc: '10% de chance de critique (dégâts ×2)', apply: () => TD.mods.critChance += 0.10 },
    { key: 'foudre',   icon: '⚡', name: 'Talisman Foudre',    desc: '+1 rebond pour la foudre en chaîne',   apply: () => TD.mods.chainBonus += 1 },
    { key: 'encens',   icon: '🌫️', name: 'Encens Toxique',     desc: 'Nuages de poison +30% de rayon',       apply: () => TD.mods.cloudMul += 0.30 },
    { key: 'miroir',   icon: '🪞', name: 'Miroir Solaire',     desc: 'Les rayons chargent 2× plus vite',     apply: () => TD.mods.beamRampMul += 1 },
    { key: 'tirelire', icon: '🐱', name: 'Maneki-Neko',        desc: "Intérêts : +5% de l'or en banque par vague (max 60)", apply: () => TD.mods.interest += 0.05 },
    { key: 'cloche',   icon: '🔔', name: 'Cloche Sacrée',      desc: "Bonus d'appel anticipé doublé",        apply: () => TD.mods.callBonusMul += 1 },
  ];

  const owned = [];

  function offer() {
    const pool = LIST.filter(c => !owned.includes(c.key));
    if (!pool.length) return;
    const picks = [];
    while (picks.length < Math.min(3, pool.length)) {
      const c = TD.util.choice(pool);
      if (!picks.includes(c)) picks.push(c);
    }
    // l'IA alliée peut décider à la place des humains (co-op)
    if (TD.ai && TD.ai.wantsCharm && TD.ai.wantsCharm()) {
      pick(TD.ai.chooseCharm(picks).key);
      return;
    }
    TD.ui.showCharms(picks, c => {
      pick(c.key);
      TD.audio.sfx('charm');
    });
  }

  // application programmatique d'un porte-bonheur (réseau / IA / modale)
  function pick(key) {
    const c = LIST.find(x => x.key === key);
    if (!c || owned.includes(key)) return;
    owned.push(key);
    c.apply();
    TD.ui.refreshCharmsBar(ownedDefs());
  }

  const ownedDefs = () => owned.map(k => LIST.find(c => c.key === k));
  const ownedKeys = () => owned.slice();
  function setOwned(keys) {                 // côté invité : reflète l'état de l'hôte
    owned.length = 0;
    for (const k of keys) owned.push(k);
    TD.ui.refreshCharmsBar(ownedDefs());
  }

  function reset() { owned.length = 0; }

  return { LIST, offer, pick, reset, ownedDefs, ownedKeys, setOwned };
})();
