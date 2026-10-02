// ============================================================
// AgeOfTD V2 — fx.js : particules, dégâts flottants, shake, hitstop
// Tout le "juice" passe par ici.
// ============================================================
'use strict';

TD.fx = (() => {
  const U = TD.util;
  const parts = [];          // particules
  const floats = [];         // textes flottants
  let trauma = 0;            // screen shake
  let timescale = 1, hitstopT = 0;
  let density = 'normal';    // low | normal | max
  let shakeEnabled = true;
  const MAXP = { low: 240, normal: 520, max: 1000 };

  // ── sprites pré-rendus (glow + pétale) ───────────────────
  const glowCache = {};
  function glowSprite(color) {
    if (glowCache[color]) return glowCache[color];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.25, U.withAlpha(color, 0.9));
    gr.addColorStop(1, U.withAlpha(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowCache[color] = c;
    return c;
  }
  const petalCache = {};
  function petalSprite(color) {
    if (petalCache[color]) return petalCache[color];
    const c = document.createElement('canvas'); c.width = 22; c.height = 18;
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(11, 1);
    g.bezierCurveTo(20, 3, 21, 13, 11, 17);   // côté droit
    g.bezierCurveTo(1, 13, 2, 3, 9, 2);       // côté gauche
    g.quadraticCurveTo(11, 5, 11, 1);         // encoche sakura
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.ellipse(13, 7, 4, 2.5, -0.5, 0, U.TAU); g.fill();
    petalCache[color] = c;
    return c;
  }

  // ── spawn générique ──────────────────────────────────────
  // type: spark | glow | smoke | ring | petal | star | coin | ghost | snow | leaf | bubble
  function spawn(o) {
    const max = MAXP[density];
    if (parts.length >= max) { if (o.ambient) return; parts.shift(); }
    parts.push({
      x: o.x, y: o.y,
      vx: o.vx || 0, vy: o.vy || 0,
      life: o.life || 1, maxLife: o.life || 1,
      size: o.size || 4, endSize: o.endSize !== undefined ? o.endSize : (o.size || 4),
      color: o.color || '#ffffff', alpha: o.alpha !== undefined ? o.alpha : 1,
      type: o.type || 'spark', layer: o.layer !== undefined ? o.layer : 1,
      grav: o.grav || 0, drag: o.drag !== undefined ? o.drag : 1,
      rot: o.rot || U.rand(U.TAU), vr: o.vr || 0,
      phase: U.rand(U.TAU), ambient: !!o.ambient, data: o.data || null,
    });
  }

  // ── recettes ─────────────────────────────────────────────
  function sparks(x, y, color, n = 6, speed = 140, size = 4) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(U.TAU), s = U.rand(speed * 0.3, speed);
      spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: U.rand(0.25, 0.55), size: U.rand(size * 0.6, size), endSize: 0, color, type: 'spark', drag: 0.92, grav: 60 });
    }
  }
  function ring(x, y, color, radius = 50, life = 0.4, width = 4) {
    spawn({ x, y, life, size: 6, endSize: radius, color, type: 'ring', data: { width } });
  }
  function explosion(x, y, color, r = 60, big = false) {
    ring(x, y, '#ffffff', r * 1.1, 0.3, 5);
    ring(x, y, color, r * 1.5, 0.5, 3);
    spawn({ x, y, life: 0.28, size: r * 0.9, endSize: r * 1.4, color, type: 'glow' });
    sparks(x, y, color, big ? 22 : 12, big ? 320 : 200, 5);
    for (let i = 0; i < (big ? 6 : 3); i++)
      spawn({ x: x + U.rand(-10, 10), y: y + U.rand(-10, 10), vx: U.rand(-30, 30), vy: U.rand(-70, -20), life: U.rand(0.6, 1.1), size: U.rand(8, 16), endSize: 30, color: '#7a7a8c', alpha: 0.4, type: 'smoke' });
    shake(big ? 0.45 : 0.2);
  }
  function petalBurst(x, y, color, n = 9) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(U.TAU), s = U.rand(40, 130);
      spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: U.rand(0.7, 1.3), size: U.rand(6, 10), color, type: 'petal', drag: 0.94, grav: 55, vr: U.rand(-6, 6) });
    }
  }
  function coinFly(x, y, n = 1) {
    for (let i = 0; i < n; i++)
      spawn({ x, y, vx: U.rand(-60, 60), vy: U.rand(-160, -90), life: 2.2, size: 7, color: '#ffd24a', type: 'coin', grav: 0, data: { t: 0 } });
  }
  function ghostRise(x, y, color = '#ffffff') {
    spawn({ x, y, vy: -38, life: 0.9, size: 13, color, type: 'ghost', alpha: 0.85 });
  }
  function floatText(x, y, txt, color = '#ffffff', size = 16, crit = false) {
    if (floats.length > 46) floats.shift();
    floats.push({ x: x + U.rand(-7, 7), y, txt, color, size: crit ? size * 1.5 : size, life: crit ? 1.1 : 0.85, maxLife: crit ? 1.1 : 0.85, vy: -46, crit });
  }
  function shake(amount) { if (shakeEnabled) trauma = Math.min(1, trauma + amount); }
  function hitstop(d) { timescale = 0.07; hitstopT = d; }

  // ── update / draw ────────────────────────────────────────
  function update(simDt, realDt) {
    if (hitstopT > 0) { hitstopT -= realDt; if (hitstopT <= 0) timescale = 1; }
    else if (timescale < 1) timescale = Math.min(1, timescale + realDt * 4);
    trauma = Math.max(0, trauma - realDt * 1.5);

    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= simDt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      if (p.type === 'coin') {
        // monte, puis file vers le compteur d'or
        p.data.t += simDt;
        if (p.data.t > 0.35) {
          const tgt = TD.ui.goldTargetPos();
          const dx = tgt.x - p.x, dy = tgt.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 26) { TD.ui.bumpGold(); parts.splice(i, 1); continue; }
          const sp = 950;
          p.vx = U.lerp(p.vx, dx / d * sp, simDt * 7);
          p.vy = U.lerp(p.vy, dy / d * sp, simDt * 7);
        }
      }
      if (p.type === 'petal' || p.type === 'leaf' || p.type === 'snow') {
        p.vx += Math.sin(p.phase + p.life * 3.2) * 16 * simDt * (p.type === 'snow' ? 0.6 : 1);
      }
      p.vy += p.grav * simDt;
      p.vx *= Math.pow(p.drag, simDt * 60);
      p.vy *= Math.pow(p.drag, simDt * 60);
      p.x += p.vx * simDt;
      p.y += p.vy * simDt;
      p.rot += p.vr * simDt;
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= simDt;
      if (f.life <= 0) { floats.splice(i, 1); continue; }
      f.y += f.vy * simDt;
      f.vy *= 0.96;
    }
  }

  function draw(ctx, layer) {
    for (const p of parts) {
      if (p.layer !== layer) continue;
      const k = p.life / p.maxLife;
      const size = U.lerp(p.endSize, p.size, k);
      const a = p.alpha * (k < 0.35 ? k / 0.35 : 1);
      ctx.globalAlpha = a;
      switch (p.type) {
        case 'spark':
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(glowSprite(p.color), p.x - size * 1.6, p.y - size * 1.6, size * 3.2, size * 3.2);
          ctx.globalCompositeOperation = 'source-over';
          break;
        case 'glow':
          ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(glowSprite(p.color), p.x - size, p.y - size, size * 2, size * 2);
          ctx.globalCompositeOperation = 'source-over';
          break;
        case 'smoke':
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, U.TAU); ctx.fill();
          break;
        case 'ring': {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = (p.data ? p.data.width : 3) * k + 0.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, U.TAU); ctx.stroke();
          break;
        }
        case 'petal': case 'leaf': {
          const spr = petalSprite(p.color);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot + Math.sin(p.phase + p.life * 2.5) * 0.6);
          ctx.scale(size / 11, size / 11);
          ctx.drawImage(spr, -11, -9);
          ctx.restore();
          break;
        }
        case 'snow':
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, size * 0.5, 0, U.TAU); ctx.fill();
          break;
        case 'star': {
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.lineTo(0, -size); ctx.quadraticCurveTo(size * 0.22, -size * 0.22, size, 0);
          }
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'coin': {
          ctx.fillStyle = '#ffd24a';
          ctx.strokeStyle = '#c8920a'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, U.TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.beginPath(); ctx.arc(p.x - 2, p.y - 2, size * 0.3, 0, U.TAU); ctx.fill();
          break;
        }
        case 'ghost': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, size, Math.PI, 0);
          ctx.lineTo(size, size * 0.7);
          for (let i = 2; i >= -2; i--) ctx.quadraticCurveTo(size * (i + 0.5) / 2.5, size * (i % 2 ? 0.45 : 0.95), size * i / 2.5, size * 0.7);
          ctx.fill();
          ctx.fillStyle = '#3a3a4a';
          // petits yeux x_x
          ctx.font = `bold ${Math.max(6, size * 0.55)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('×  ×', 0, 2);
          ctx.restore();
          break;
        }
        case 'bubble':
          ctx.strokeStyle = p.color; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, U.TAU); ctx.stroke();
          break;
      }
      ctx.globalAlpha = 1;
    }
    if (layer === 1) {
      // textes flottants au-dessus du combat
      ctx.textAlign = 'center';
      for (const f of floats) {
        const k = f.life / f.maxLife;
        ctx.globalAlpha = Math.min(1, k * 2);
        const wob = f.crit ? Math.sin(f.life * 40) * 2 : 0;
        ctx.font = `900 ${f.size}px 'Segoe UI', sans-serif`;
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(40,30,50,0.85)';
        ctx.strokeText(f.txt, f.x + wob, f.y);
        ctx.fillStyle = f.color;
        ctx.fillText(f.txt, f.x + wob, f.y);
      }
      ctx.globalAlpha = 1;
    }
  }

  function shakeOffset(t) {
    if (trauma <= 0) return { x: 0, y: 0 };
    const m = trauma * trauma * 16;
    return { x: Math.sin(t * 113.7) * m, y: Math.cos(t * 127.1) * m };
  }

  function clear() { parts.length = 0; floats.length = 0; trauma = 0; timescale = 1; hitstopT = 0; }
  function setDensity(d) { density = d; }
  function setShake(b) { shakeEnabled = b; }

  return {
    spawn, sparks, ring, explosion, petalBurst, coinFly, ghostRise, floatText,
    shake, hitstop, shakeOffset, update, draw, clear, setDensity, setShake,
    glowSprite, petalSprite,
    get timescale() { return timescale; },
    get count() { return parts.length; },
  };
})();
