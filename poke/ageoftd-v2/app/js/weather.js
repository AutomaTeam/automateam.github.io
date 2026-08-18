// ============================================================
// AgeOfTD V2 — weather.js : météo tactique (port V1)
// ------------------------------------------------------------
// Au-delà du cycle jour/nuit cosmétique (bg.js), une MÉTÉO est tirée
// à chaque vague selon le thème de la carte. Elle a des effets de
// jeu (portée/cadence des tours, vitesse des yokai) + un rendu dédié.
// Hôte-autoritaire : l'hôte tire la météo (waves.start) ; l'invité la
// reçoit dans le snapshot (`wx`) — effets côté hôte, visuel partout.
// ============================================================
'use strict';

TD.weather = (() => {
  const U = TD.util, M = TD.map;

  const TYPES = {
    clear: { name: 'Ciel clair',  icon: '☀️', rangeMul: 1,    rateMul: 1,    enemy: 1,    desc: 'Aucun effet' },
    rain:  { name: 'Pluie',       icon: '🌧️', rangeMul: 0.92, rateMul: 1,    enemy: 0.94, desc: 'Portée des tours −8% · yokai ralentis' },
    fog:   { name: 'Brouillard',  icon: '🌫️', rangeMul: 0.82, rateMul: 1,    enemy: 1,    desc: 'Portée des tours −18%' },
    wind:  { name: 'Grand vent',  icon: '💨', rangeMul: 1.12, rateMul: 1,    enemy: 1.08, desc: 'Portée +12% · yokai accélérés' },
    storm: { name: 'Orage',       icon: '⛈️', rangeMul: 0.95, rateMul: 1,    enemy: 1,    desc: 'Éclairs qui foudroient les yokai', lightning: true },
    snow:  { name: 'Neige',       icon: '❄️', rangeMul: 1,    rateMul: 0.92, enemy: 0.88, desc: 'Cadence −8% · yokai gelés ralentis' },
  };
  // pool pondéré par thème de carte (clear répété = plus fréquent)
  const AFFINITY = {
    sakura: ['clear', 'clear', 'rain', 'wind', 'fog'],
    fuji:   ['clear', 'snow', 'wind', 'fog', 'snow'],
    desert: ['clear', 'clear', 'wind', 'storm', 'wind'],
    snow:   ['snow', 'snow', 'fog', 'clear', 'snow'],
    swamp:  ['fog', 'fog', 'rain', 'storm', 'rain'],
    koi:    ['clear', 'rain', 'clear', 'fog', 'wind'],
  };

  let cur = 'clear';
  let forced = false;            // météo verrouillée (défi du jour)
  let lightT = U.rand(1.6, 3);

  // gouttes / flocons précalculés (cosmétique → Math.random OK)
  const drops = [];
  for (let i = 0; i < 150; i++) drops.push({ x: U.rand(0, M.W + 20), y: U.rand(0, M.H + 20), v: U.rand(0.7, 1.3), p: U.rand(U.TAU) });

  function announce() {
    const w = TYPES[cur];
    if (cur === 'clear') return;
    TD.ui.banner(`${w.icon} ${w.name}`, w.desc, w.lightning ? 'boss' : 'clear', 2600);
  }

  // tirage d'une météo pour la vague (hôte / solo)
  // verrouille une météo pour toute la partie (défi du jour)
  function force(id) { if (TYPES[id]) { cur = id; forced = true; announce(); } }

  function roll() {
    if (forced) return;
    const pool = AFFINITY[TD.map.theme] || AFFINITY.sakura;
    const next = U.choice(pool);
    const changed = next !== cur;
    cur = next;
    lightT = U.rand(1.4, 2.6);
    if (changed) announce();
  }

  // application d'un état reçu (invité) — annonce au changement
  function setRemote(id) {
    if (!id || !TYPES[id] || id === cur) return;
    cur = id;
    if (TD.net.role === 'guest') announce();
  }

  // effets de jeu (lus par Tower.stats / Enemy.currentSpeed, hôte/solo)
  const rangeMul = () => TYPES[cur].rangeMul;
  const rateMul = () => TYPES[cur].rateMul;
  const enemySpeedMul = () => TYPES[cur].enemy;

  // simulation : éclairs d'orage (hôte/solo seulement — appelée dans step)
  function update(dt) {
    if (!TYPES[cur].lightning) return;
    lightT -= dt;
    if (lightT <= 0) {
      lightT = U.rand(1.5, 2.8);
      const list = TD.game.enemies.filter(e => !e.dead);
      if (list.length) {
        const e = list[Math.floor(U.rand(0, list.length))];
        TD.game.dealDamage(e, 38 + (TD.game.wave || 0) * 2, 'magic', { tag: 'lantern' });
        TD.fx.ring(e.x, e.y, '#dff0ff', 52, 0.4, 5);
        TD.fx.sparks(e.x, e.y, '#cfe6ff', 9, 190, 4);
        TD.audio.sfx('zap');
      }
    }
  }

  // ── rendu (au-dessus des entités) — déterministe sur `t` ──
  function draw(ctx, t) {
    const w = TYPES[cur];
    if (cur === 'clear') return;

    if (cur === 'fog') {
      ctx.fillStyle = 'rgba(216,222,232,0.16)';
      ctx.fillRect(0, 0, M.W, M.H);
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 5; i++) {
        const bx = ((i * 320 + t * 14 * (i % 2 ? 1 : -1)) % (M.W + 220)) - 110;
        const by = 180 + i * 150;
        ctx.fillStyle = 'rgba(230,234,242,0.10)';
        ctx.beginPath(); ctx.ellipse(bx, by, 240, 70, 0, 0, U.TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (cur === 'rain' || cur === 'storm') {
      ctx.strokeStyle = 'rgba(170,200,235,0.45)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const d of drops) {
        const y = (d.y + t * M.H * d.v) % (M.H + 20);
        const x = (d.x + y * 0.18) % (M.W + 20);
        ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 13 * d.v);
      }
      ctx.stroke();
    }

    if (cur === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const d of drops) {
        const y = (d.y + t * 95 * d.v) % (M.H + 20);
        const x = (d.x + Math.sin(t * 0.7 + d.p) * 22) % (M.W + 20);
        ctx.beginPath(); ctx.arc(x, y, 1.6 * d.v, 0, U.TAU); ctx.fill();
      }
    }

    if (cur === 'wind') {
      ctx.strokeStyle = 'rgba(220,238,232,0.30)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const d = drops[i];
        const x = ((d.x + t * 520 * d.v) % (M.W + 120)) - 60;
        const y = (d.y * 0.9) % M.H;
        ctx.moveTo(x, y); ctx.lineTo(x + 34 * d.v, y);
      }
      ctx.stroke();
    }

    if (w.lightning) {
      // flash plein écran périodique (déterministe)
      const ph = t % 3.0;
      if (ph < 0.16) {
        ctx.fillStyle = `rgba(220,230,255,${(1 - ph / 0.16) * 0.35})`;
        ctx.fillRect(0, 0, M.W, M.H);
      }
    }
  }

  function reset() { cur = 'clear'; forced = false; lightT = U.rand(1.4, 2.6); }

  return { roll, force, setRemote, update, draw, reset, rangeMul, rateMul, enemySpeedMul, id: () => cur, info: () => TYPES[cur] };
})();
